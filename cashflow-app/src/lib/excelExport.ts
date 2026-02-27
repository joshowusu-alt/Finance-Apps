/**
 * Excel export — build a workbook from a Plan and download it.
 */

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

async function buildSheet(rows: Record<string, unknown>[], headers: string[]) {
  const XLSX = await import("xlsx");
  return XLSX.utils.json_to_sheet(rows, { header: headers, skipHeader: false });
}

async function buildTemplateSheet(headers: string[]) {
  const XLSX = await import("xlsx");
  return XLSX.utils.json_to_sheet([], { header: headers, skipHeader: false });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function buildPlanWorkbook(plan: Plan) {
  const XLSX = await import("xlsx");
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

  XLSX.utils.book_append_sheet(workbook, await buildSheet(setupRows, setupHeaders), "Setup");
  XLSX.utils.book_append_sheet(
    workbook,
    await buildSheet(
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
    await buildSheet(
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
    await buildSheet(
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
    await buildSheet(
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
    await buildSheet(
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
    await buildSheet(
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
    await buildSheet(
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
    await buildSheet(
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

export async function buildPlanTemplateWorkbook() {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, await buildTemplateSheet(setupHeaders), "Setup");
  XLSX.utils.book_append_sheet(workbook, await buildTemplateSheet(periodHeaders), "Periods");
  XLSX.utils.book_append_sheet(workbook, await buildTemplateSheet(incomeHeaders), "IncomeRules");
  XLSX.utils.book_append_sheet(workbook, await buildTemplateSheet(outflowHeaders), "OutflowRules");
  XLSX.utils.book_append_sheet(workbook, await buildTemplateSheet(billHeaders), "Bills");
  XLSX.utils.book_append_sheet(workbook, await buildTemplateSheet(periodOverrideHeaders), "PeriodOverrides");
  XLSX.utils.book_append_sheet(workbook, await buildTemplateSheet(overrideHeaders), "Overrides");
  XLSX.utils.book_append_sheet(workbook, await buildTemplateSheet(eventOverrideHeaders), "EventOverrides");
  XLSX.utils.book_append_sheet(workbook, await buildTemplateSheet(transactionHeaders), "Transactions");
  return workbook;
}

export async function downloadPlanXlsx(plan: Plan) {
  const XLSX = await import("xlsx");
  const workbook = await buildPlanWorkbook(plan);
  const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const { filenamePrefix } = getReportBranding();
  downloadBlob(blob, `${filenamePrefix}-plan-${stamp}.xlsx`);
}

export async function downloadPlanTemplate() {
  const XLSX = await import("xlsx");
  const workbook = await buildPlanTemplateWorkbook();
  const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const { filenamePrefix } = getReportBranding();
  downloadBlob(blob, `${filenamePrefix}-import-template.xlsx`);
}
