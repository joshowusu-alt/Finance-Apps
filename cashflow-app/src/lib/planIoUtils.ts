/**
 * Shared constants and low-level utilities used by the planIo family of modules.
 * Nothing in here should import from plan-domain modules to keep the dep graph clean.
 */

import type { CashflowCategory, CashflowType } from "@/data/plan";

// ---------------------------------------------------------------------------
// Sheet header definitions (shared between import and export)
// ---------------------------------------------------------------------------

export const setupHeaders = [
  "version",
  "selectedPeriodId",
  "asOfDate",
  "windowDays",
  "startingBalance",
  "rollForwardBalance",
  "expectedMinBalance",
  "variableCap",
];

export const periodHeaders = ["id", "label", "start", "end"];
export const incomeHeaders = ["id", "label", "amount", "cadence", "seedDate", "enabled"];
export const outflowHeaders = ["id", "label", "amount", "cadence", "seedDate", "category", "enabled"];
export const billHeaders = ["id", "label", "amount", "dueDay", "category", "enabled"];
export const periodOverrideHeaders = ["periodId", "startingBalance", "disabledBills"];
export const overrideHeaders = ["id", "ruleId", "date", "label", "amount", "type", "category"];
export const eventOverrideHeaders = ["id", "eventId", "date", "amount", "disabled"];
export const transactionHeaders = [
  "id",
  "date",
  "label",
  "amount",
  "type",
  "category",
  "notes",
  "linkedRuleId",
  "linkedBillId",
];

// ---------------------------------------------------------------------------
// Allowed-value sets
// ---------------------------------------------------------------------------

export const categorySet: Set<CashflowCategory> = new Set([
  "income",
  "bill",
  "giving",
  "savings",
  "allowance",
  "buffer",
  "other",
]);

export const typeSet: Set<CashflowType> = new Set(["income", "outflow", "transfer"]);

// ---------------------------------------------------------------------------
// Browser download helper
// ---------------------------------------------------------------------------

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

export function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function parseNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const num = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(num) ? num : fallback;
  }
  return fallback;
}

export function parseIntValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const num = Number(value.replace(/[^0-9-]/g, ""));
    return Number.isFinite(num) ? Math.round(num) : fallback;
  }
  return fallback;
}

export function parseBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(v)) return true;
    if (["false", "no", "n", "0"].includes(v)) return false;
  }
  return fallback;
}

export function parseString(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function parseDate(value: unknown) {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number") {
    // Convert Excel date serial to ISO date (days since 1900-01-01 with Lotus leap-year bug)
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) {
      const yyyy = String(date.getUTCFullYear()).padStart(4, "0");
      const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(date.getUTCDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    // Parse as local date and extract Y/M/D to avoid timezone shift (C4 fix)
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  return "";
}

export function parseList(value: unknown) {
  if (Array.isArray(value)) return value.map((v) => parseString(v)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,|;]/g)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

export function makeId(prefix: string, index: number) {
  return `${prefix}-${Date.now()}-${index}`;
}

export function normalizeCategory(value: unknown): CashflowCategory {
  const raw = parseString(value).toLowerCase();
  return categorySet.has(raw as CashflowCategory) ? (raw as CashflowCategory) : "other";
}

export function normalizeType(value: unknown): CashflowType {
  const raw = parseString(value).toLowerCase();
  return typeSet.has(raw as CashflowType) ? (raw as CashflowType) : "outflow";
}
