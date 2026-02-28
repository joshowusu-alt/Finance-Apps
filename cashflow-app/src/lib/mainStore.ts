import "server-only";
import { getSQL } from "@/lib/db";
import { Plan } from "@/data/plan";
import {
  hashToken,
  generateToken,
  createBlankPlan,
  parsePlan,
  pruneExpired,
} from "@/lib/tokenPlanBase";

const RETENTION_MS = 1000 * 60 * 60 * 24 * 365;

export const MAIN_COOKIE_NAME = "cf_main_token";
export const MAIN_COOKIE_MAX_AGE = Math.floor(RETENTION_MS / 1000);

export async function ensureMainPlan(token?: string) {
  const sql = getSQL();
  const now = new Date();
  await pruneExpired("main_plans", RETENTION_MS, now);

  let activeToken = token?.trim();
  if (!activeToken) activeToken = generateToken();

  const tokenHash = hashToken(activeToken);

  const result = await sql`
    SELECT plan_json, prev_plan_json, updated_at
    FROM main_plans
    WHERE token_hash = ${tokenHash}
  `;

  if (result.length === 0) {
    const plan = createBlankPlan();
    await sql`
      INSERT INTO main_plans
      (token_hash, plan_json, prev_plan_json, created_at, updated_at, last_seen_at)
      VALUES (${tokenHash}, ${JSON.stringify(plan)}, NULL, ${now}, ${now}, ${now})
    `;
    return {
      token: activeToken,
      plan,
      prevPlan: null,
      updatedAt: now.getTime(),
      created: true
    };
  }

  await sql`
    UPDATE main_plans
    SET last_seen_at = ${now}
    WHERE token_hash = ${tokenHash}
  `;

  const row = result[0];
  const prevPlan = row.prev_plan_json ? parsePlan(row.prev_plan_json) : null;

  return {
    token: activeToken,
    plan: parsePlan(row.plan_json),
    prevPlan,
    updatedAt: new Date(row.updated_at).getTime(),
    created: false,
  };
}

export async function saveMainPlan(token: string, plan: Plan, prevPlan?: Plan | null) {
  const sql = getSQL();
  const now = new Date();
  const tokenHash = hashToken(token);
  const planJson = JSON.stringify(plan);
  const prevJson = prevPlan ? JSON.stringify(prevPlan) : null;

  await sql`
    INSERT INTO main_plans
      (token_hash, plan_json, prev_plan_json, created_at, updated_at, last_seen_at)
    VALUES (${tokenHash}, ${planJson}, ${prevJson}, ${now}, ${now}, ${now})
    ON CONFLICT (token_hash) DO UPDATE SET
      prev_plan_json = main_plans.plan_json,
      plan_json      = EXCLUDED.plan_json,
      updated_at     = EXCLUDED.updated_at,
      last_seen_at   = EXCLUDED.last_seen_at
  `;

  return now.getTime();
}

export async function resetMainPlan(token: string) {
  const plan = createBlankPlan();
  await saveMainPlan(token, plan);
  return plan;
}

/**
 * Save a plan when you already know the tokenHash (e.g. resolved via join token).
 * Used by the household sharing plan API route.
 */
export async function saveMainPlanByHash(tokenHash: string, plan: Plan, prevPlan?: Plan | null) {
  const sql = getSQL();
  const now = new Date();
  const planJson = JSON.stringify(plan);
  const prevJson = prevPlan ? JSON.stringify(prevPlan) : null;

  await sql`
    UPDATE main_plans
    SET prev_plan_json = plan_json, plan_json = ${planJson}, updated_at = ${now}, last_seen_at = ${now}
    WHERE token_hash = ${tokenHash}
  `;

  if (prevJson && prevJson !== planJson) {
    await sql`
      UPDATE main_plans
      SET prev_plan_json = ${prevJson}
      WHERE token_hash = ${tokenHash}
    `;
  }

  return now.getTime();
}
