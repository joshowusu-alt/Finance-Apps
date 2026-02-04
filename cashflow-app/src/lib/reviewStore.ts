import { createHash, randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { PLAN, Plan } from "@/data/plan";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "review.sqlite");
const TOKEN_BYTES = 32;
const RETENTION_MS = 1000 * 60 * 60 * 24 * 28;

export const REVIEW_COOKIE_NAME = "cf_review_token";
export const REVIEW_COOKIE_MAX_AGE = Math.floor(RETENTION_MS / 1000);

let db: Database.Database | null = null;

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

function getDb() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_plans (
      token_hash TEXT PRIMARY KEY,
      plan_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_review_last_seen ON review_plans(last_seen_at);
  `);
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
  dbConn.prepare("DELETE FROM review_plans WHERE last_seen_at < ?").run(cutoff);
}

function parsePlan(raw: string) {
  try {
    return JSON.parse(raw) as Plan;
  } catch {
    return createReviewPlan();
  }
}

export function ensureReviewPlan(token?: string) {
  const dbConn = getDb();
  const now = Date.now();
  pruneExpired(dbConn, now);

  let activeToken = token?.trim();
  if (!activeToken) activeToken = generateToken();

  const tokenHash = hashToken(activeToken);
  const row = dbConn
    .prepare("SELECT plan_json FROM review_plans WHERE token_hash = ?")
    .get(tokenHash) as { plan_json: string } | undefined;

  if (!row) {
    const plan = createReviewPlan();
    dbConn
      .prepare(
        "INSERT INTO review_plans (token_hash, plan_json, created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(tokenHash, JSON.stringify(plan), now, now, now);
    return { token: activeToken, plan, created: true };
  }

  dbConn
    .prepare("UPDATE review_plans SET last_seen_at = ? WHERE token_hash = ?")
    .run(now, tokenHash);

  return { token: activeToken, plan: parsePlan(row.plan_json), created: false };
}

export function saveReviewPlan(token: string, plan: Plan) {
  const dbConn = getDb();
  const now = Date.now();
  const tokenHash = hashToken(token);
  const planJson = JSON.stringify(plan);
  const updated = dbConn
    .prepare(
      "UPDATE review_plans SET plan_json = ?, updated_at = ?, last_seen_at = ? WHERE token_hash = ?"
    )
    .run(planJson, now, now, tokenHash);

  if (updated.changes === 0) {
    dbConn
      .prepare(
        "INSERT INTO review_plans (token_hash, plan_json, created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(tokenHash, planJson, now, now, now);
  }
}

export function resetReviewPlan(token: string) {
  const plan = createReviewPlan();
  saveReviewPlan(token, plan);
  return plan;
}
