import { createHash, randomBytes } from "crypto";
import { neon } from "@neondatabase/serverless";
import { PLAN, Plan } from "@/data/plan";

const TOKEN_BYTES = 32;
const RETENTION_MS = 1000 * 60 * 60 * 24 * 28;

export const REVIEW_COOKIE_NAME = "cf_review_token";
export const REVIEW_COOKIE_MAX_AGE = Math.floor(RETENTION_MS / 1000);

// Get SQL client
function getSQL() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return neon(databaseUrl);
}

function todayISO() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function createReviewPlan(): Plan {
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

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

async function pruneExpired(now = new Date()) {
  const sql = getSQL();
  const cutoff = new Date(now.getTime() - RETENTION_MS);
  await sql`DELETE FROM review_plans WHERE last_seen_at < ${cutoff}`;
}

function parsePlan(raw: any): Plan {
  try {
    // Handle both JSONB (object) and TEXT (string) from Postgres
    if (typeof raw === "string") {
      return JSON.parse(raw) as Plan;
    }
    return raw as Plan;
  } catch {
    return createReviewPlan();
  }
}

export async function ensureReviewPlan(token?: string) {
  const sql = getSQL();
  const now = new Date();
  await pruneExpired(now);

  let activeToken = token?.trim();
  if (!activeToken) activeToken = generateToken();

  const tokenHash = hashToken(activeToken);

  const result = await sql`
    SELECT plan_json
    FROM review_plans
    WHERE token_hash = ${tokenHash}
  `;

  if (result.length === 0) {
    const plan = createReviewPlan();
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
  const plan = createReviewPlan();
  await saveReviewPlan(token, plan);
  return plan;
}
