import { createHash, randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { PLAN, Plan } from "@/data/plan";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "main.sqlite");
const TOKEN_BYTES = 32;
const RETENTION_MS = 1000 * 60 * 60 * 24 * 365;

export const MAIN_COOKIE_NAME = "cf_main_token";
export const MAIN_COOKIE_MAX_AGE = Math.floor(RETENTION_MS / 1000);

let db: Database.Database | null = null;

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

function getDb() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS main_plans (
      token_hash TEXT PRIMARY KEY,
      plan_json TEXT NOT NULL,
      prev_plan_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_main_last_seen ON main_plans(last_seen_at);
  `);
  const columns = db.prepare("PRAGMA table_info(main_plans)").all() as { name: string }[];
  const hasPrev = columns.some((col) => col.name === "prev_plan_json");
  if (!hasPrev) {
    db.exec("ALTER TABLE main_plans ADD COLUMN prev_plan_json TEXT");
  }
  return db;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function pruneExpired(dbConn: Database.Database, now = Date.now()) {
  const cutoff = now - RETENTION_MS;
  dbConn.prepare("DELETE FROM main_plans WHERE last_seen_at < ?").run(cutoff);
}

function parsePlan(raw: string) {
  try {
    return JSON.parse(raw) as Plan;
  } catch {
    return createMainPlan();
  }
}

export function ensureMainPlan(token?: string) {
  const dbConn = getDb();
  const now = Date.now();
  pruneExpired(dbConn, now);

  let activeToken = token?.trim();
  if (!activeToken) activeToken = generateToken();

  const tokenHash = hashToken(activeToken);
  const row = dbConn
    .prepare("SELECT plan_json, prev_plan_json, updated_at FROM main_plans WHERE token_hash = ?")
    .get(tokenHash) as
      | { plan_json: string; prev_plan_json?: string | null; updated_at: number }
      | undefined;

  if (!row) {
    const plan = createMainPlan();
    dbConn
      .prepare(
        "INSERT INTO main_plans (token_hash, plan_json, prev_plan_json, created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(tokenHash, JSON.stringify(plan), null, now, now, now);
    return { token: activeToken, plan, prevPlan: null, updatedAt: now, created: true };
  }

  dbConn
    .prepare("UPDATE main_plans SET last_seen_at = ? WHERE token_hash = ?")
    .run(now, tokenHash);

  const prevPlan = row.prev_plan_json ? parsePlan(row.prev_plan_json) : null;
  return {
    token: activeToken,
    plan: parsePlan(row.plan_json),
    prevPlan,
    updatedAt: row.updated_at,
    created: false,
  };
}

export function saveMainPlan(token: string, plan: Plan, prevPlan?: Plan | null) {
  const dbConn = getDb();
  const now = Date.now();
  const tokenHash = hashToken(token);
  const planJson = JSON.stringify(plan);
  const prevJson = prevPlan ? JSON.stringify(prevPlan) : null;
  const row = dbConn
    .prepare("SELECT plan_json FROM main_plans WHERE token_hash = ?")
    .get(tokenHash) as { plan_json: string } | undefined;

  if (!row) {
    dbConn
      .prepare(
        "INSERT INTO main_plans (token_hash, plan_json, prev_plan_json, created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(tokenHash, planJson, prevJson, now, now, now);
    return now;
  }

  if (row.plan_json === planJson) {
    if (prevJson && prevJson !== planJson) {
      dbConn
        .prepare("UPDATE main_plans SET prev_plan_json = ?, last_seen_at = ? WHERE token_hash = ?")
        .run(prevJson, now, tokenHash);
    } else {
      dbConn
        .prepare("UPDATE main_plans SET last_seen_at = ? WHERE token_hash = ?")
        .run(now, tokenHash);
    }
    return now;
  }

  dbConn
    .prepare(
      "UPDATE main_plans SET prev_plan_json = plan_json, plan_json = ?, updated_at = ?, last_seen_at = ? WHERE token_hash = ?"
    )
    .run(planJson, now, now, tokenHash);

  if (prevJson && prevJson !== planJson) {
    dbConn
      .prepare("UPDATE main_plans SET prev_plan_json = ? WHERE token_hash = ?")
      .run(prevJson, tokenHash);
  }
  return now;
}

export function resetMainPlan(token: string) {
  const plan = createMainPlan();
  saveMainPlan(token, plan);
  return plan;
}
