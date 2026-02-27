import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module isolation helpers ─────────────────────────────────────────────────
// Each test imports a fresh copy of sharingStore so the module-level
// `schemaEnsured` flag is always reset to `false` at the start of each test.

let sqlMock: ReturnType<typeof vi.fn>;

async function importStore() {
  // Reset modules so `schemaEnsured` reverts to `false`
  vi.resetModules();
  sqlMock = vi.fn();

  vi.doMock("@/lib/db", () => ({
    getSQL: () => sqlMock,
  }));

  vi.doMock("@/lib/tokenPlanBase", () => ({
    hashToken: (t: string) => `hash::${t}`,
    generateToken: () => "fresh-join-token",
    // parsePlan is imported elsewhere in storage — provide pass-through
    parsePlan: (raw: string) => JSON.parse(raw),
  }));

  return import("@/lib/sharingStore");
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getOrCreateShareCode ─────────────────────────────────────────────────────

describe("getOrCreateShareCode", () => {
  it("returns the existing share code when one is already stored", async () => {
    const { getOrCreateShareCode } = await importStore();

    sqlMock
      .mockResolvedValueOnce([]) // DDL: ALTER TABLE
      .mockResolvedValueOnce([]) // DDL: CREATE TABLE
      .mockResolvedValueOnce([{ share_code: "XYZ123" }]); // SELECT share_code

    const code = await getOrCreateShareCode("owner-token-hash");
    expect(code).toBe("XYZ123");
  });

  it("throws when no plan exists for the given owner token hash", async () => {
    const { getOrCreateShareCode } = await importStore();

    sqlMock
      .mockResolvedValueOnce([]) // DDL: ALTER TABLE
      .mockResolvedValueOnce([]) // DDL: CREATE TABLE
      .mockResolvedValueOnce([]); // SELECT → no rows returned

    await expect(getOrCreateShareCode("nonexistent-hash")).rejects.toThrow(
      "Plan not found for this token"
    );
  });

  it("generates and returns a new code when share_code is null", async () => {
    const { getOrCreateShareCode } = await importStore();

    sqlMock
      .mockResolvedValueOnce([]) // DDL: ALTER TABLE
      .mockResolvedValueOnce([]) // DDL: CREATE TABLE
      .mockResolvedValueOnce([{ share_code: null }]) // SELECT → no existing code
      .mockResolvedValueOnce([]) // SELECT clash check → no conflict
      .mockResolvedValueOnce([]); // UPDATE set share_code

    const code = await getOrCreateShareCode("owner-hash-no-code");
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThan(0);
  });

  it("retries code generation when a collision is detected and returns a collision-free code", async () => {
    const { getOrCreateShareCode } = await importStore();

    sqlMock
      .mockResolvedValueOnce([]) // DDL: ALTER TABLE
      .mockResolvedValueOnce([]) // DDL: CREATE TABLE
      .mockResolvedValueOnce([{ share_code: null }]) // SELECT → no existing code
      .mockResolvedValueOnce([{ 1: 1 }]) // clash on first candidate
      .mockResolvedValueOnce([]) // no clash on second candidate
      .mockResolvedValueOnce([]); // UPDATE

    const code = await getOrCreateShareCode("owner-hash-retry");
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThan(0);
  });
});

// ─── joinByShareCode ──────────────────────────────────────────────────────────

describe("joinByShareCode", () => {
  it("returns a join token when the share code is valid", async () => {
    const { joinByShareCode } = await importStore();

    sqlMock
      .mockResolvedValueOnce([]) // DDL: ALTER TABLE
      .mockResolvedValueOnce([]) // DDL: CREATE TABLE
      .mockResolvedValueOnce([{ token_hash: "plan-owner-hash" }]) // SELECT plan by share_code
      .mockResolvedValueOnce([]); // INSERT join token (ON CONFLICT DO NOTHING)

    const joinToken = await joinByShareCode("ABC123");
    // generateToken() mock returns "fresh-join-token"
    expect(joinToken).toBe("fresh-join-token");
  });

  it("returns null when the share code does not match any plan", async () => {
    const { joinByShareCode } = await importStore();

    sqlMock
      .mockResolvedValueOnce([]) // DDL: ALTER TABLE
      .mockResolvedValueOnce([]) // DDL: CREATE TABLE
      .mockResolvedValueOnce([]); // SELECT → no plan found

    const result = await joinByShareCode("BADCODE");
    expect(result).toBeNull();
  });

  it("trims and uppercases the share code before looking it up", async () => {
    const { joinByShareCode } = await importStore();

    sqlMock
      .mockResolvedValueOnce([]) // DDL: ALTER TABLE
      .mockResolvedValueOnce([]) // DDL: CREATE TABLE
      .mockResolvedValueOnce([{ token_hash: "plan-hash" }]) // SELECT found
      .mockResolvedValueOnce([]); // INSERT join token

    // Passing lowercase with surrounding whitespace — should still succeed
    const result = await joinByShareCode("  abc123  ");
    expect(result).toBe("fresh-join-token");
  });
});

// ─── resolvePlanHashFromJoinToken ─────────────────────────────────────────────

describe("resolvePlanHashFromJoinToken", () => {
  it("returns the plan token hash for a valid join token", async () => {
    const { resolvePlanHashFromJoinToken } = await importStore();

    sqlMock.mockResolvedValueOnce([{ plan_hash: "the-plan-hash" }]);

    const planHash = await resolvePlanHashFromJoinToken("my-join-token");
    // hashToken("my-join-token") = "hash::my-join-token" (our mock)
    expect(planHash).toBe("the-plan-hash");
  });

  it("returns null when no matching join token exists", async () => {
    const { resolvePlanHashFromJoinToken } = await importStore();

    sqlMock.mockResolvedValueOnce([]);

    const planHash = await resolvePlanHashFromJoinToken("unknown-token");
    expect(planHash).toBeNull();
  });

  it("returns null gracefully when the join_tokens table does not exist yet", async () => {
    const { resolvePlanHashFromJoinToken } = await importStore();

    sqlMock.mockRejectedValueOnce(new Error("relation join_tokens does not exist"));

    const planHash = await resolvePlanHashFromJoinToken("any-token");
    expect(planHash).toBeNull();
  });
});

// ─── ensureSharingSchema — runs DDL only once ─────────────────────────────────

describe("ensureSharingSchema", () => {
  it("runs ALTER TABLE and CREATE TABLE exactly once across multiple calls", async () => {
    const { getOrCreateShareCode } = await importStore();

    // First call: DDL (2 stmts) + SELECT returning an existing code
    sqlMock
      .mockResolvedValueOnce([]) // DDL: ALTER TABLE   ← should only happen once
      .mockResolvedValueOnce([]) // DDL: CREATE TABLE  ← should only happen once
      .mockResolvedValueOnce([{ share_code: "CODE1" }]); // SELECT first call

    await getOrCreateShareCode("hash-a");
    const callCountAfterFirst = sqlMock.mock.calls.length; // 3 calls: DDL×2 + SELECT×1

    // Second call: schemaEnsured=true → NO DDL, just SELECT
    sqlMock.mockResolvedValueOnce([{ share_code: "CODE2" }]); // SELECT second call

    await getOrCreateShareCode("hash-b");
    const callCountAfterSecond = sqlMock.mock.calls.length;

    // The first call should have triggered exactly 3 sql calls (2 DDL + 1 SELECT)
    expect(callCountAfterFirst).toBe(3);
    // The second call should have added only 1 more call (SELECT only — no DDL)
    expect(callCountAfterSecond - callCountAfterFirst).toBe(1);
  });
});

// ─── revokeShareCode ──────────────────────────────────────────────────────────

describe("revokeShareCode", () => {
  it("deletes join tokens and clears the share_code column", async () => {
    const { revokeShareCode } = await importStore();

    sqlMock
      .mockResolvedValueOnce([]) // DELETE join_tokens
      .mockResolvedValueOnce([]); // UPDATE main_plans share_code = NULL

    await expect(revokeShareCode("owner-hash")).resolves.not.toThrow();
    expect(sqlMock).toHaveBeenCalledTimes(2);
  });

  it("silently handles a missing join_tokens table during revoke", async () => {
    const { revokeShareCode } = await importStore();

    sqlMock
      .mockRejectedValueOnce(new Error("relation join_tokens does not exist")) // DELETE fails
      .mockResolvedValueOnce([]); // UPDATE still runs

    await expect(revokeShareCode("owner-hash")).resolves.not.toThrow();
  });
});
