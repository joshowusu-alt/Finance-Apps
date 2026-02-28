/**
 * Excel import — parse an uploaded .xlsx file into a Plan.
 */

import ExcelJS from "exceljs";
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

/** Resolve a CellValue to a plain JS value suitable for our parsers. */
function resolveCellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return v.result ?? "";
    if ("text" in v) return v.text;
    if (v instanceof Date) return v;
  }
  return v;
}

/** Read all data rows from a worksheet, keyed by the header row. */
function readWorksheet(worksheet: ExcelJS.Worksheet): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  let headers: string[] = [];
  worksheet.eachRow((row, rowNumber) => {
    const rawValues = (row.values as ExcelJS.CellValue[]).slice(1); // drop index-0 (always undefined)
    const values = rawValues.map(resolveCellValue);
    if (rowNumber === 1) {
      headers = values.map((v) => String(v ?? ""));
    } else {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] ?? "";
      });
      rows.push(obj);
    }
  });
  return rows;
}

function findWorksheet(workbook: ExcelJS.Workbook, names: string[]): ExcelJS.Worksheet | null {
  const lowerNames = names.map((n) => n.trim().toLowerCase());
  for (const ws of workbook.worksheets) {
    if (lowerNames.includes(ws.name.trim().toLowerCase())) return ws;
  }
  return null;
}

function readSheet(workbook: ExcelJS.Workbook, names: string[]): Record<string, unknown>[] | null {
  const ws = findWorksheet(workbook, names);
  if (!ws) return null;
  return readWorksheet(ws).map((row) => {
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
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(Buffer.from(new Uint8Array(arrayBuffer)) as any);

  const setupRows = readSheet(workbook, ["setup", "plan", "meta"]);
  const periodRows = readSheet(workbook, ["periods"]);
  const incomeRows = readSheet(workbook, ["incomerules", "income rules", "income_rules", "income"]);
  const outflowRows = readSheet(workbook, ["outflowrules", "outflow rules", "outflow_rules", "outflows"]);
  const billRows = readSheet(workbook, ["bills", "bill"]);
  const periodOverrideRows = readSheet(workbook, ["periodoverrides", "period overrides", "period_overrides"]);
  const overrideRows = readSheet(workbook, ["overrides", "cashflowoverrides", "manualoverrides"]);
  const eventOverrideRows = readSheet(workbook, ["eventoverrides", "event overrides", "event_overrides"]);
  const transactionRows = readSheet(workbook, ["transactions", "txns", "txn"]);

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
  } else if (workbook.worksheets.length === 1) {
    const firstWorksheet = workbook.worksheets[0];
    const rawRows = readWorksheet(firstWorksheet);
    const normalized = rawRows.map((row) => {
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
