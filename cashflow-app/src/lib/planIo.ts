import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  CashflowCategory,
  CashflowType,
  IncomeRule,
  OutflowRule,
  Period,
  Plan,
  Transaction,
} from "@/data/plan";
import { PLAN_VERSION } from "@/data/plan";
import { generateEvents, getPeriod } from "@/lib/cashflowEngine";
import { getReportBranding } from "@/lib/branding";

type ImportResult = {
  plan: Plan;
  warnings: string[];
};

const setupHeaders = [
  "version",
  "selectedPeriodId",
  "asOfDate",
  "windowDays",
  "startingBalance",
  "rollForwardBalance",
  "expectedMinBalance",
  "variableCap",
];

const periodHeaders = ["id", "label", "start", "end"];
const incomeHeaders = ["id", "label", "amount", "cadence", "seedDate", "enabled"];
const outflowHeaders = ["id", "label", "amount", "cadence", "seedDate", "category", "enabled"];
const billHeaders = ["id", "label", "amount", "dueDay", "category", "enabled"];
const periodOverrideHeaders = ["periodId", "startingBalance", "disabledBills"];
const overrideHeaders = ["id", "ruleId", "date", "label", "amount", "type", "category"];
const eventOverrideHeaders = ["id", "eventId", "date", "amount", "disabled"];
const transactionHeaders = [
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

const categorySet: Set<CashflowCategory> = new Set([
  "income",
  "bill",
  "giving",
  "savings",
  "allowance",
  "buffer",
  "other",
]);

const typeSet: Set<CashflowType> = new Set(["income", "outflow", "transfer"]);

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value || 0);
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const num = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(num) ? num : fallback;
  }
  return fallback;
}

function parseIntValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const num = Number(value.replace(/[^0-9-]/g, ""));
    return Number.isFinite(num) ? Math.round(num) : fallback;
  }
  return fallback;
}

function parseBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(v)) return true;
    if (["false", "no", "n", "0"].includes(v)) return false;
  }
  return fallback;
}

function parseString(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function parseDate(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) {
      const yyyy = String(d.y).padStart(4, "0");
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return "";
}

function parseList(value: unknown) {
  if (Array.isArray(value)) return value.map((v) => parseString(v)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,|;]/g)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function makeId(prefix: string, index: number) {
  return `${prefix}-${Date.now()}-${index}`;
}

function normalizeCategory(value: unknown): CashflowCategory {
  const raw = parseString(value).toLowerCase();
  return categorySet.has(raw as CashflowCategory) ? (raw as CashflowCategory) : "other";
}

function normalizeType(value: unknown): CashflowType {
  const raw = parseString(value).toLowerCase();
  return typeSet.has(raw as CashflowType) ? (raw as CashflowType) : "outflow";
}

function getSheet(workbook: XLSX.WorkBook, names: string[]) {
  const map = new Map<string, string>();
  workbook.SheetNames.forEach((name) => map.set(name.trim().toLowerCase(), name));
  for (const alias of names) {
    const key = alias.trim().toLowerCase();
    if (map.has(key)) return workbook.Sheets[map.get(key)!];
  }
  return null;
}

function readSheet(workbook: XLSX.WorkBook, names: string[]) {
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

function buildSheet(rows: Record<string, unknown>[], headers: string[]) {
  return XLSX.utils.json_to_sheet(rows, { header: headers, skipHeader: false });
}

function buildTemplateSheet(headers: string[]) {
  return XLSX.utils.json_to_sheet([], { header: headers, skipHeader: false });
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

export function buildPlanWorkbook(plan: Plan) {
  const workbook = XLSX.utils.book_new();

  const setupRows = [
    {
      version: plan.version ?? PLAN_VERSION,
      selectedPeriodId: plan.setup.selectedPeriodId,
      asOfDate: plan.setup.asOfDate,
      windowDays: plan.setup.windowDays,
      startingBalance: plan.setup.startingBalance,
      rollForwardBalance: plan.setup.rollForwardBalance,
      expectedMinBalance: plan.setup.expectedMinBalance,
      variableCap: plan.setup.variableCap,
    },
  ];

  XLSX.utils.book_append_sheet(workbook, buildSheet(setupRows, setupHeaders), "Setup");
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(
      plan.periods.map((p) => ({
        id: p.id,
        label: p.label,
        start: p.start,
        end: p.end,
      })),
      periodHeaders
    ),
    "Periods"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(
      plan.incomeRules.map((r) => ({
        id: r.id,
        label: r.label,
        amount: r.amount,
        cadence: r.cadence,
        seedDate: r.seedDate,
        enabled: r.enabled,
      })),
      incomeHeaders
    ),
    "IncomeRules"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(
      plan.outflowRules.map((r) => ({
        id: r.id,
        label: r.label,
        amount: r.amount,
        cadence: r.cadence,
        seedDate: r.seedDate,
        category: r.category,
        enabled: r.enabled,
      })),
      outflowHeaders
    ),
    "OutflowRules"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(
      plan.bills.map((b) => ({
        id: b.id,
        label: b.label,
        amount: b.amount,
        dueDay: b.dueDay,
        category: b.category,
        enabled: b.enabled,
      })),
      billHeaders
    ),
    "Bills"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(
      plan.periodOverrides.map((o) => ({
        periodId: o.periodId,
        startingBalance: typeof o.startingBalance === "number" ? o.startingBalance : "",
        disabledBills: (o.disabledBills ?? []).join(", "),
      })),
      periodOverrideHeaders
    ),
    "PeriodOverrides"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(
      plan.overrides.map((o) => ({
        id: o.id,
        ruleId: o.ruleId ?? "",
        date: o.date,
        label: o.label,
        amount: o.amount,
        type: o.type,
        category: o.category,
      })),
      overrideHeaders
    ),
    "Overrides"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(
      plan.eventOverrides.map((o) => ({
        id: o.id,
        eventId: o.eventId,
        date: o.date ?? "",
        amount: typeof o.amount === "number" ? o.amount : "",
        disabled: Boolean(o.disabled),
      })),
      eventOverrideHeaders
    ),
    "EventOverrides"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildSheet(
      plan.transactions.map((t) => ({
        id: t.id,
        date: t.date,
        label: t.label,
        amount: t.amount,
        type: t.type,
        category: t.category,
        notes: t.notes ?? "",
        linkedRuleId: t.linkedRuleId ?? "",
        linkedBillId: t.linkedBillId ?? "",
      })),
      transactionHeaders
    ),
    "Transactions"
  );

  return workbook;
}

export function buildPlanTemplateWorkbook() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildTemplateSheet(setupHeaders), "Setup");
  XLSX.utils.book_append_sheet(workbook, buildTemplateSheet(periodHeaders), "Periods");
  XLSX.utils.book_append_sheet(workbook, buildTemplateSheet(incomeHeaders), "IncomeRules");
  XLSX.utils.book_append_sheet(workbook, buildTemplateSheet(outflowHeaders), "OutflowRules");
  XLSX.utils.book_append_sheet(workbook, buildTemplateSheet(billHeaders), "Bills");
  XLSX.utils.book_append_sheet(workbook, buildTemplateSheet(periodOverrideHeaders), "PeriodOverrides");
  XLSX.utils.book_append_sheet(workbook, buildTemplateSheet(overrideHeaders), "Overrides");
  XLSX.utils.book_append_sheet(workbook, buildTemplateSheet(eventOverrideHeaders), "EventOverrides");
  XLSX.utils.book_append_sheet(workbook, buildTemplateSheet(transactionHeaders), "Transactions");
  return workbook;
}

export function downloadPlanXlsx(plan: Plan) {
  const workbook = buildPlanWorkbook(plan);
  const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const { filenamePrefix } = getReportBranding();
  downloadBlob(blob, `${filenamePrefix}-plan-${stamp}.xlsx`);
}

export function downloadPlanTemplate() {
  const workbook = buildPlanTemplateWorkbook();
  const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const { filenamePrefix } = getReportBranding();
  downloadBlob(blob, `${filenamePrefix}-import-template.xlsx`);
}

function addSectionTitle(doc: jsPDF, text: string, y: number) {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(text, 40, y);
  doc.setFont("helvetica", "normal");
  return y + 10;
}

function nextTableY(doc: jsPDF, fallback: number) {
  const table = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
  if (table?.finalY) return table.finalY + 18;
  return fallback;
}

export function downloadPlanPdf(plan: Plan, periodId: number) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const { brand, accentRgb, filenamePrefix } = getReportBranding();
  const headStyles = { fillColor: accentRgb };
  let y = 50;
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(`${brand.name} Plan Report`, 40, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  y += 16;
  if (brand.tagline) {
    doc.text(brand.tagline, 40, y);
    y += 14;
  }
  doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, 40, y);
  y += 18;

  const period = getPeriod(plan, periodId);
  const events = generateEvents(plan, periodId);
  const transactions = plan.transactions.filter((t) => t.date >= period.start && t.date <= period.end);

  const budgetIncome = events.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
  const budgetOutflows = events.filter((e) => e.type === "outflow").reduce((sum, e) => sum + e.amount, 0);
  const budgetSavings = events
    .filter((e) => e.type === "outflow" && e.category === "savings")
    .reduce((sum, e) => sum + e.amount, 0);
  const budgetSpending = budgetOutflows - budgetSavings;
  const budgetLeftover = budgetIncome - budgetOutflows;

  const actualIncome = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const actualSavings = transactions.filter((t) => t.category === "savings").reduce((sum, t) => sum + t.amount, 0);
  const actualSpending = transactions
    .filter((t) => t.type === "outflow" && t.category !== "savings")
    .reduce((sum, t) => sum + t.amount, 0);
  const actualLeftover = actualIncome - actualSpending - actualSavings;

  y = addSectionTitle(doc, "Plan setup", y);
  autoTable(doc, {
    startY: y,
    head: [["Key", "Value"]],
    body: [
      ["As of date", plan.setup.asOfDate],
      ["Window days", String(plan.setup.windowDays)],
      ["Starting balance", formatMoney(plan.setup.startingBalance)],
      ["Roll forward balance", plan.setup.rollForwardBalance ? "Yes" : "No"],
      ["Expected minimum", formatMoney(plan.setup.expectedMinBalance)],
      ["Variable cap", formatMoney(plan.setup.variableCap)],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles,
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Selected period", y);
  autoTable(doc, {
    startY: y,
    head: [["Label", "Start", "End"]],
    body: [[period.label, period.start, period.end]],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles,
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Budget vs actual", y);
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Budget", "Actual"]],
    body: [
      ["Income", formatMoney(budgetIncome), formatMoney(actualIncome)],
      ["Spending", formatMoney(budgetSpending), formatMoney(actualSpending)],
      ["Savings", formatMoney(budgetSavings), formatMoney(actualSavings)],
      ["Leftover", formatMoney(budgetLeftover), formatMoney(actualLeftover)],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles,
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Income rules", y);
  autoTable(doc, {
    startY: y,
    head: [["Label", "Cadence", "Amount", "Seed", "Enabled"]],
    body: plan.incomeRules.map((rule) => [
      rule.label,
      rule.cadence,
      formatMoney(rule.amount),
      formatDate(new Date(rule.seedDate)),
      rule.enabled ? "Yes" : "No",
    ]),
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles,
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Outflow rules", y);
  autoTable(doc, {
    startY: y,
    head: [["Label", "Cadence", "Category", "Amount", "Seed", "Enabled"]],
    body: plan.outflowRules.map((rule) => [
      rule.label,
      rule.cadence,
      rule.category,
      formatMoney(rule.amount),
      formatDate(new Date(rule.seedDate)),
      rule.enabled ? "Yes" : "No",
    ]),
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles,
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Bills", y);
  autoTable(doc, {
    startY: y,
    head: [["Label", "Due day", "Category", "Amount", "Enabled"]],
    body: plan.bills.map((bill) => [
      bill.label,
      String(bill.dueDay),
      bill.category,
      formatMoney(bill.amount),
      bill.enabled ? "Yes" : "No",
    ]),
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles,
  });

  if (brand.reportFooter) {
    const pageCount = doc.getNumberOfPages();
    doc.setPage(pageCount);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(brand.reportFooter, 40, pageHeight - 30);
    doc.setTextColor(0);
  }

  const filenameSafe = period.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`${filenamePrefix}-report-${filenameSafe || "period"}.pdf`);
}

export async function importPlanFromFile(file: File, currentPlan: Plan): Promise<ImportResult> {
  const warnings: string[] = [];
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

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
