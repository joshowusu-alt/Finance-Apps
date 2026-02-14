import { getSQL } from "@/lib/db";
import { Plan } from "@/data/plan";
import {
  hashToken,
  generateToken,
  createBlankPlan,
  parsePlan,
  pruneExpired,
} from "@/lib/tokenPlanBase";

const RETENTION_MS = 1000 * 60 * 60 * 24 * 28;

export const REVIEW_COOKIE_NAME = "cf_review_token";
export const REVIEW_COOKIE_MAX_AGE = Math.floor(RETENTION_MS / 1000);

export async function ensureReviewPlan(token?: string) {
  const sql = getSQL();
  const now = new Date();
  await pruneExpired("review_plans", RETENTION_MS, now);

  let activeToken = token?.trim();
  if (!activeToken) activeToken = generateToken();

  const tokenHash = hashToken(activeToken);

  const result = await sql`
    SELECT plan_json
    FROM review_plans
    WHERE token_hash = ${tokenHash}
  `;

  if (result.length === 0) {
    const plan = createBlankPlan();
    await sql`
      INSERT INTO review_plans
      (token_hash, plan_json, created_at, updated_at, last_seen_at)
      VALUES (${tokenHash}, ${JSON.stringify(plan)}, ${now}, ${now}, ${now})
    `;
    return { token: activeToken, plan, created: true };
  }

  await sql`
    UPDATE review_plans
    SET last_seen_at = ${now}
    WHERE token_hash = ${tokenHash}
  `;

  return { token: activeToken, plan: parsePlan(result[0].plan_json), created: false };
}

export async function saveReviewPlan(token: string, plan: Plan) {
  const sql = getSQL();
  const now = new Date();
  const tokenHash = hashToken(token);
  const planJson = JSON.stringify(plan);

  const result = await sql`
    UPDATE review_plans
    SET plan_json = ${planJson}, updated_at = ${now}, last_seen_at = ${now}
    WHERE token_hash = ${tokenHash}
    RETURNING token_hash
  `;

  if (result.length === 0) {
    await sql`
      INSERT INTO review_plans
      (token_hash, plan_json, created_at, updated_at, last_seen_at)
      VALUES (${tokenHash}, ${planJson}, ${now}, ${now}, ${now})
    `;
  }
}

export async function resetReviewPlan(token: string) {
  const plan = createBlankPlan();
  await saveReviewPlan(token, plan);
  return plan;
}
