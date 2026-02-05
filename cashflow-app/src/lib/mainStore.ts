import { createHash, randomBytes } from "crypto";
import { neon } from "@neondatabase/serverless";
import { PLAN, Plan } from "@/data/plan";

const TOKEN_BYTES = 32;
const RETENTION_MS = 1000 * 60 * 60 * 24 * 365;

export const MAIN_COOKIE_NAME = "cf_main_token";
export const MAIN_COOKIE_MAX_AGE = Math.floor(RETENTION_MS / 1000);

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

function createMainPlan(): Plan {
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
  await sql`DELETE FROM main_plans WHERE last_seen_at < ${cutoff}`;
}

function parsePlan(raw: any): Plan {
  try {
    // Handle both JSONB (object) and TEXT (string) from Postgres
    if (typeof raw === "string") {
      return JSON.parse(raw) as Plan;
    }
    return raw as Plan;
  } catch {
    return createMainPlan();
  }
}

export async function ensureMainPlan(token?: string) {
  const sql = getSQL();
  const now = new Date();
  await pruneExpired(now);

  let activeToken = token?.trim();
  if (!activeToken) activeToken = generateToken();

  const tokenHash = hashToken(activeToken);

  const result = await sql`
    SELECT plan_json, prev_plan_json, updated_at
    FROM main_plans
    WHERE token_hash = ${tokenHash}
  `;

  if (result.length === 0) {
    const plan = createMainPlan();
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

  const result = await sql`
    SELECT plan_json
    FROM main_plans
    WHERE token_hash = ${tokenHash}
  `;

  if (result.length === 0) {
    await sql`
      INSERT INTO main_plans
      (token_hash, plan_json, prev_plan_json, created_at, updated_at, last_seen_at)
      VALUES (${tokenHash}, ${planJson}, ${prevJson}, ${now}, ${now}, ${now})
    `;
    return now.getTime();
  }

  const row = result[0];
  const existingPlanJson = typeof row.plan_json === "string"
    ? row.plan_json
    : JSON.stringify(row.plan_json);

  if (existingPlanJson === planJson) {
    if (prevJson && prevJson !== planJson) {
      await sql`
        UPDATE main_plans
        SET prev_plan_json = ${prevJson}, last_seen_at = ${now}
        WHERE token_hash = ${tokenHash}
      `;
    } else {
      await sql`
        UPDATE main_plans
        SET last_seen_at = ${now}
        WHERE token_hash = ${tokenHash}
      `;
    }
    return now.getTime();
  }

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

export async function resetMainPlan(token: string) {
  const plan = createMainPlan();
  await saveMainPlan(token, plan);
  return plan;
}
