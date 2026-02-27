/**
 * PDF report — generate a PDF report from plan data using jsPDF / jspdf-autotable.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Plan } from "@/data/plan";
import { deriveApp } from "@/lib/derive";
import { getReportBranding } from "@/lib/branding";
import { formatMoney } from "@/lib/currency";

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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

  const derived = deriveApp({ ...plan, setup: { ...plan.setup, selectedPeriodId: periodId } });
  const period = derived.period;
  const transactions = plan.transactions.filter((t) => t.date >= period.start && t.date <= period.end);

  const budgetIncome = derived.totals.incomeExpected;
  const budgetOutflows = derived.totals.committedBills + derived.totals.allocationsTotal;
  const budgetSavings = derived.savingsHealth.savingsThisPeriod;
  const budgetSpending = budgetOutflows - budgetSavings;
  const budgetLeftover = derived.totals.remaining;

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
      ["Forecast range (days)", String(plan.setup.windowDays)],
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
