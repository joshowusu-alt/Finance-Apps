/**
 * Excel export — build a workbook from a Plan and download it.
 */

import ExcelJS from "exceljs";
import type { Plan } from "@/data/plan";
import { PLAN_VERSION } from "@/data/plan";
import { getReportBranding } from "@/lib/branding";
import {
  setupHeaders,
  periodHeaders,
  incomeHeaders,
  outflowHeaders,
  billHeaders,
  periodOverrideHeaders,
  overrideHeaders,
  eventOverrideHeaders,
  transactionHeaders,
  downloadBlob,
} from "@/lib/planIoUtils";

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function addSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: Record<string, unknown>[],
  headers: string[]
): void {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = headers.map((h) => ({ header: h, key: h }));
  rows.forEach((row) => sheet.addRow(row));
}

function addTemplateSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  headers: string[]
): void {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = headers.map((h) => ({ header: h, key: h }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function buildPlanWorkbook(plan: Plan): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();

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

  addSheet(workbook, "Setup", setupRows, setupHeaders);
  addSheet(
    workbook,
    "Periods",
    plan.periods.map((p) => ({
      id: p.id,
      label: p.label,
      start: p.start,
      end: p.end,
    })),
    periodHeaders
  );
  addSheet(
    workbook,
    "IncomeRules",
    plan.incomeRules.map((r) => ({
      id: r.id,
      label: r.label,
      amount: r.amount,
      cadence: r.cadence,
      seedDate: r.seedDate,
      enabled: r.enabled,
    })),
    incomeHeaders
  );
  addSheet(
    workbook,
    "OutflowRules",
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
  );
  addSheet(
    workbook,
    "Bills",
    plan.bills.map((b) => ({
      id: b.id,
      label: b.label,
      amount: b.amount,
      dueDay: b.dueDay,
      category: b.category,
      enabled: b.enabled,
    })),
    billHeaders
  );
  addSheet(
    workbook,
    "PeriodOverrides",
    plan.periodOverrides.map((o) => ({
      periodId: o.periodId,
      startingBalance: typeof o.startingBalance === "number" ? o.startingBalance : "",
      disabledBills: (o.disabledBills ?? []).join(", "),
    })),
    periodOverrideHeaders
  );
  addSheet(
    workbook,
    "Overrides",
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
  );
  addSheet(
    workbook,
    "EventOverrides",
    plan.eventOverrides.map((o) => ({
      id: o.id,
      eventId: o.eventId,
      date: o.date ?? "",
      amount: typeof o.amount === "number" ? o.amount : "",
      disabled: Boolean(o.disabled),
    })),
    eventOverrideHeaders
  );
  addSheet(
    workbook,
    "Transactions",
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
  );

  return workbook;
}

export async function buildPlanTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  addTemplateSheet(workbook, "Setup", setupHeaders);
  addTemplateSheet(workbook, "Periods", periodHeaders);
  addTemplateSheet(workbook, "IncomeRules", incomeHeaders);
  addTemplateSheet(workbook, "OutflowRules", outflowHeaders);
  addTemplateSheet(workbook, "Bills", billHeaders);
  addTemplateSheet(workbook, "PeriodOverrides", periodOverrideHeaders);
  addTemplateSheet(workbook, "Overrides", overrideHeaders);
  addTemplateSheet(workbook, "EventOverrides", eventOverrideHeaders);
  addTemplateSheet(workbook, "Transactions", transactionHeaders);
  return workbook;
}

export async function downloadPlanXlsx(plan: Plan) {
  const workbook = await buildPlanWorkbook(plan);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const { filenamePrefix } = getReportBranding();
  downloadBlob(blob, `${filenamePrefix}-plan-${stamp}.xlsx`);
}

export async function downloadPlanTemplate() {
  const workbook = await buildPlanTemplateWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const { filenamePrefix } = getReportBranding();
  downloadBlob(blob, `${filenamePrefix}-import-template.xlsx`);
}
