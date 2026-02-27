/**
 * Excel import — parse an uploaded .xlsx file into a Plan.
 */

import type { WorkBook as XLSXWorkBook } from "xlsx";
import type {
  IncomeRule,
  OutflowRule,
  Period,
  Plan,
  Transaction,
} from "@/data/plan";
import { PLAN_VERSION } from "@/data/plan";
import {
  normalizeKey,
  parseNumber,
  parseIntValue,
  parseBool,
  parseString,
  parseDate,
  parseList,
  makeId,
  normalizeCategory,
  normalizeType,
} from "@/lib/planIoUtils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportResult = {
  plan: Plan;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function getSheet(workbook: XLSXWorkBook, names: string[]) {
  const map = new Map<string, string>();
  workbook.SheetNames.forEach((name) => map.set(name.trim().toLowerCase(), name));
  for (const alias of names) {
    const key = alias.trim().toLowerCase();
    if (map.has(key)) return workbook.Sheets[map.get(key)!];
  }
  return null;
}

async function readSheet(workbook: XLSXWorkBook, names: string[]) {
  const XLSX = await import("xlsx");
  const sheet = getSheet(workbook, names);
  if (!sheet) return null;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  return rows.map((row) => {
    const normalized: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
      normalized[normalizeKey(key)] = value;
    });
    return normalized;
  });
}

function normalizePeriodLabel(period: Period) {
  if (period.label && period.label.trim()) return period.label;
  return `P${period.id}: ${period.start}-${period.end}`;
}

function ensureSelectedPeriod(plan: Plan) {
  if (!plan.periods.length) return;
  const exists = plan.periods.some((p) => p.id === plan.setup.selectedPeriodId);
  if (!exists) {
    plan.setup.selectedPeriodId = plan.periods[0].id;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function importPlanFromFile(file: File, currentPlan: Plan): Promise<ImportResult> {
  const warnings: string[] = [];
  const buffer = await file.arrayBuffer();
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  const setupRows = await readSheet(workbook, ["setup", "plan", "meta"]);
  const periodRows = await readSheet(workbook, ["periods"]);
  const incomeRows = await readSheet(workbook, ["incomerules", "income rules", "income_rules", "income"]);
  const outflowRows = await readSheet(workbook, ["outflowrules", "outflow rules", "outflow_rules", "outflows"]);
  const billRows = await readSheet(workbook, ["bills", "bill"]);
  const periodOverrideRows = await readSheet(workbook, ["periodoverrides", "period overrides", "period_overrides"]);
  const overrideRows = await readSheet(workbook, ["overrides", "cashflowoverrides", "manualoverrides"]);
  const eventOverrideRows = await readSheet(workbook, ["eventoverrides", "event overrides", "event_overrides"]);
  const transactionRows = await readSheet(workbook, ["transactions", "txns", "txn"]);

  const next: Plan = {
    ...currentPlan,
    setup: { ...currentPlan.setup },
    periods: [...currentPlan.periods],
    incomeRules: [...currentPlan.incomeRules],
    outflowRules: [...currentPlan.outflowRules],
    bills: [...currentPlan.bills],
    periodOverrides: [...currentPlan.periodOverrides],
    overrides: [...currentPlan.overrides],
    eventOverrides: [...currentPlan.eventOverrides],
    transactions: [...currentPlan.transactions],
  };

  if (setupRows) {
    const row = setupRows[0] ?? {};
    const version = parseIntValue(row.version, PLAN_VERSION);
    next.version = version || PLAN_VERSION;
    next.setup.selectedPeriodId = parseIntValue(row.selectedperiodid, next.setup.selectedPeriodId);
    next.setup.asOfDate = parseDate(row.asofdate) || next.setup.asOfDate;
    next.setup.windowDays = parseIntValue(row.windowdays, next.setup.windowDays);
    next.setup.startingBalance = parseNumber(row.startingbalance, next.setup.startingBalance);
    next.setup.rollForwardBalance = parseBool(
      row.rollforwardbalance,
      next.setup.rollForwardBalance
    );
    next.setup.expectedMinBalance = parseNumber(
      row.expectedminbalance,
      next.setup.expectedMinBalance
    );
    next.setup.variableCap = parseNumber(row.variablecap, next.setup.variableCap);
  }

  if (periodRows) {
    const parsed: Period[] = periodRows
      .map((row, idx) => {
        const id = parseIntValue(row.id, idx + 1);
        const start = parseDate(row.start);
        const end = parseDate(row.end);
        if (!start || !end) return null;
        const label = parseString(row.label) || `P${id}: ${start}-${end}`;
        return { id, start, end, label };
      })
      .filter((row): row is Period => Boolean(row));
    if (parsed.length > 0) {
      next.periods = parsed.map((p) => ({ ...p, label: normalizePeriodLabel(p) }));
    } else if (periodRows.length > 0) {
      warnings.push("No valid periods found in import. Kept existing periods.");
    }
  }

  if (incomeRows) {
    next.incomeRules = incomeRows.map((row, idx) => ({
      id: parseString(row.id) || makeId("income", idx),
      label: parseString(row.label) || "Income",
      amount: parseNumber(row.amount, 0),
      cadence: (parseString(row.cadence) || "monthly") as IncomeRule["cadence"],
      seedDate: parseDate(row.seeddate) || currentPlan.periods[0]?.start || "2026-01-01",
      enabled: parseBool(row.enabled, true),
    }));
  }

  if (outflowRows) {
    next.outflowRules = outflowRows.map((row, idx) => ({
      id: parseString(row.id) || makeId("outflow", idx),
      label: parseString(row.label) || "Outflow",
      amount: parseNumber(row.amount, 0),
      cadence: (parseString(row.cadence) || "monthly") as OutflowRule["cadence"],
      seedDate: parseDate(row.seeddate) || currentPlan.periods[0]?.start || "2026-01-01",
      category: normalizeCategory(row.category),
      enabled: parseBool(row.enabled, true),
    }));
  }

  if (billRows) {
    next.bills = billRows.map((row, idx) => ({
      id: parseString(row.id) || makeId("bill", idx),
      label: parseString(row.label) || "Bill",
      amount: parseNumber(row.amount, 0),
      dueDay: parseIntValue(row.dueday, 1),
      category: normalizeCategory(row.category),
      enabled: parseBool(row.enabled, true),
    }));
  }

  if (periodOverrideRows) {
    next.periodOverrides = periodOverrideRows.map((row) => ({
      periodId: parseIntValue(row.periodid, 0),
      startingBalance:
        row.startingbalance === "" ? undefined : parseNumber(row.startingbalance, 0),
      disabledBills: parseList(row.disabledbills),
    }));
  }

  if (overrideRows) {
    next.overrides = overrideRows.map((row, idx) => ({
      id: parseString(row.id) || makeId("override", idx),
      ruleId: parseString(row.ruleid) || undefined,
      date: parseDate(row.date) || currentPlan.periods[0]?.start || "2026-01-01",
      label: parseString(row.label) || "Manual item",
      amount: parseNumber(row.amount, 0),
      type: normalizeType(row.type),
      category: normalizeCategory(row.category),
    }));
  }

  if (eventOverrideRows) {
    next.eventOverrides = eventOverrideRows.map((row, idx) => ({
      id: parseString(row.id) || makeId("event", idx),
      eventId: parseString(row.eventid) || "",
      date: parseDate(row.date) || undefined,
      amount: row.amount === "" ? undefined : parseNumber(row.amount, 0),
      disabled: parseBool(row.disabled, false),
    }));
  }

  if (transactionRows) {
    const parsed: Transaction[] = [];
    transactionRows.forEach((row, idx) => {
      const date = parseDate(row.date);
      const label = parseString(row.label);
      const amount = parseNumber(row.amount, NaN);
      if (!date || !label || !Number.isFinite(amount)) {
        warnings.push(`Skipped transaction row ${idx + 1} (missing date/label/amount).`);
        return;
      }
      parsed.push({
        id: parseString(row.id) || makeId("txn", idx),
        date,
        label,
        amount,
        type: normalizeType(row.type),
        category: normalizeCategory(row.category),
        notes: parseString(row.notes) || undefined,
        linkedRuleId: parseString(row.linkedruleid) || undefined,
        linkedBillId: parseString(row.linkedbillid) || undefined,
      });
    });
    next.transactions = parsed;
  } else if (workbook.SheetNames.length === 1) {
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
      defval: "",
      raw: true,
    });
    const normalized = rows.map((row) => {
      const out: Record<string, unknown> = {};
      Object.entries(row).forEach(([key, value]) => {
        out[normalizeKey(key)] = value;
      });
      return out;
    });
    if (normalized.length > 0) {
      const parsed: Transaction[] = [];
      normalized.forEach((row, idx) => {
        const date = parseDate(row.date);
        const label = parseString(row.label);
        const amount = parseNumber(row.amount, NaN);
        if (!date || !label || !Number.isFinite(amount)) {
          warnings.push(`Skipped row ${idx + 1} (missing date/label/amount).`);
          return;
        }
        parsed.push({
          id: makeId("txn", idx),
          date,
          label,
          amount,
          type: normalizeType(row.type),
          category: normalizeCategory(row.category),
          notes: parseString(row.notes) || undefined,
          linkedRuleId: parseString(row.linkedruleid) || undefined,
          linkedBillId: parseString(row.linkedbillid) || undefined,
        });
      });
      if (parsed.length) {
        next.transactions = parsed;
      }
    }
  }

  ensureSelectedPeriod(next);
  return { plan: next, warnings };
}
