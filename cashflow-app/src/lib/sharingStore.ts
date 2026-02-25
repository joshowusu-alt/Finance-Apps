/**
 * sharingStore — household / partner plan sharing via invite codes.
 *
 * Flow:
 *   1. Owner: POST /api/shared → generates a 6-char SHARE_CODE, returns it.
 *   2. Partner: POST /api/shared/join { code } → server finds plan by code,
 *      generates a JOIN_TOKEN, stores sha256(token) → plan mapping,
 *      returns { joinToken }.
 *   3. Partner stores joinToken in localStorage (key: CF_JOIN_TOKEN_KEY).
 *   4. Plan API calls from the partner include X-Join-Token header.
 *   5. Plan API resolves joinToken → planHash → loads/saves correct plan.
 */

import { randomBytes } from "crypto";
import { getSQL } from "@/lib/db";
import { hashToken, generateToken } from "@/lib/tokenPlanBase";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous O/0/I/1

function randomShareCode(len = 6): string {
  const bytes = randomBytes(len);
  let code = "";
  for (const b of bytes) code += CODE_CHARS[b % CODE_CHARS.length];
  return code;
}

/** Idempotent — alters main_plans and creates join_tokens table once. */
async function ensureSharingSchema() {
  const sql = getSQL();
  await sql`
    ALTER TABLE main_plans
    ADD COLUMN IF NOT EXISTS share_code VARCHAR(16) UNIQUE
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS join_tokens (
      token_hash  VARCHAR(64)  PRIMARY KEY,
      plan_hash   VARCHAR(64)  NOT NULL,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
}

/**
 * Returns the share code for the given owner token hash, creating one if
 * it doesn't exist yet.
 */
export async function getOrCreateShareCode(ownerTokenHash: string): Promise<string> {
  await ensureSharingSchema();
  const sql = getSQL();

  const rows = await sql`
    SELECT share_code FROM main_plans WHERE token_hash = ${ownerTokenHash}
  `;
  if (rows.length === 0) throw new Error("Plan not found for this token");

  if (rows[0].share_code) return rows[0].share_code;

  // Generate a collision-free code
  let code = "";
  for (let i = 0; i < 10; i++) {
    const candidate = randomShareCode();
    const clash = await sql`
      SELECT 1 FROM main_plans WHERE share_code = ${candidate} LIMIT 1
    `;
    if (clash.length === 0) { code = candidate; break; }
  }
  if (!code) code = randomShareCode(8); // fallback — longer

  await sql`
    UPDATE main_plans SET share_code = ${code} WHERE token_hash = ${ownerTokenHash}
  `;
  return code;
}

/**
 * Looks up the plan by share_code, generates a join token for the caller,
 * and stores it.  Returns the plaintext join token on success or null if
 * the code is invalid.
 */
export async function joinByShareCode(shareCode: string): Promise<string | null> {
  await ensureSharingSchema();
  const sql = getSQL();

  const rows = await sql`
    SELECT token_hash FROM main_plans WHERE share_code = ${shareCode.toUpperCase().trim()} LIMIT 1
  `;
  if (rows.length === 0) return null;

  const planHash = rows[0].token_hash;
  const joinToken = generateToken();
  const joinTokenHash = hashToken(joinToken);

  await sql`
    INSERT INTO join_tokens (token_hash, plan_hash, created_at)
    VALUES (${joinTokenHash}, ${planHash}, NOW())
    ON CONFLICT (token_hash) DO NOTHING
  `;

  return joinToken;
}

/**
 * Given the plaintext join token, returns the plan's token_hash so the
 * plan API can load/save the correct row.
 */
export async function resolvePlanHashFromJoinToken(joinToken: string): Promise<string | null> {
  const sql = getSQL();
  const joinTokenHash = hashToken(joinToken);

  try {
    const rows = await sql`
      SELECT plan_hash FROM join_tokens WHERE token_hash = ${joinTokenHash} LIMIT 1
    `;
    return rows.length > 0 ? rows[0].plan_hash : null;
  } catch {
    // join_tokens may not exist yet on first deploy — return null gracefully
    return null;
  }
}

/**
 * Revoke all join tokens for a plan (when owner wants to reset sharing).
 */
export async function revokeShareCode(ownerTokenHash: string): Promise<void> {
  const sql = getSQL();
  // Remove all join tokens that reference this plan
  try {
    await sql`DELETE FROM join_tokens WHERE plan_hash = ${ownerTokenHash}`;
  } catch { /* table may not exist */ }
  // Clear the share code
  await sql`
    UPDATE main_plans SET share_code = NULL WHERE token_hash = ${ownerTokenHash}
  `;
}
