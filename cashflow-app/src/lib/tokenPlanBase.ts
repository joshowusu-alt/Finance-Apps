/**
 * Shared primitives for token-based plan stores (main & review).
 *
 * Eliminates ~70% code duplication between mainStore.ts and reviewStore.ts.
 * Each concrete store only needs to define its table name, retention,
 * cookie name, and any store-specific save semantics.
 */

import { createHash, randomBytes } from "crypto";
import { getSQL } from "@/lib/db";
import { todayISO } from "@/lib/dateUtils";
import { PLAN, type Plan } from "@/data/plan";

const TOKEN_BYTES = 32;

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

// ---------------------------------------------------------------------------
// Plan helpers
// ---------------------------------------------------------------------------

/** Create a blank plan with today's date. */
export function createBlankPlan(): Plan {
  return {
    ...PLAN,
    setup: { ...PLAN.setup, asOfDate: todayISO() },
    incomeRules: [],
    outflowRules: [],
    bills: [],
    periodOverrides: [],
    eventOverrides: [],
    overrides: [],
    transactions: [],
  };
}

/** Safely parse plan from Postgres (handles JSONB objects & TEXT strings). */
export function parsePlan(raw: unknown, fallback?: () => Plan): Plan {
  try {
    if (typeof raw === "string") return JSON.parse(raw) as Plan;
    return raw as Plan;
  } catch {
    return fallback ? fallback() : createBlankPlan();
  }
}

// ---------------------------------------------------------------------------
// Prune helper
// ---------------------------------------------------------------------------

/** Delete rows older than `retentionMs` from given table. */
export async function pruneExpired(
  tableName: string,
  retentionMs: number,
  now = new Date(),
) {
  const sql = getSQL();
  const cutoff = new Date(now.getTime() - retentionMs);
  // SQL tagged template doesn't support dynamic table names, so we use
  // a conditional here. Both values are compile-time constants.
  if (tableName === "main_plans") {
    await sql`DELETE FROM main_plans WHERE last_seen_at < ${cutoff}`;
  } else {
    await sql`DELETE FROM review_plans WHERE last_seen_at < ${cutoff}`;
  }
}
