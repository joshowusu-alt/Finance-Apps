import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney } from "@/lib/currency";
import type { InsightsSnapshot } from "@/lib/insightsSnapshot";

function csvEscape(value: string) {
  if (value.includes(",") || value.includes("\n") || value.includes("\"")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function downloadTextFile(content: string, filename: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function addSectionTitle(doc: jsPDF, text: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(text, 40, y);
  doc.setFont("helvetica", "normal");
  return y + 8;
}

function nextTableY(doc: jsPDF, fallback: number) {
  const table = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return table ? table.finalY + 20 : fallback;
}

function periodLabelAt(periods: InsightsSnapshot["sortedPeriods"], idx: number) {
  if (idx < 0 || idx >= periods.length) return "Unknown";
  return periods[idx]?.label ?? "Unknown";
}

export function downloadInsightsCsv(snapshot: InsightsSnapshot) {
  const rows: string[][] = [];
  const pushSection = (title: string) => rows.push([`-- ${title} --`]);
  const pushBlank = () => rows.push([]);

  pushSection("Meta");
  rows.push(["Base period", snapshot.basePeriod.label]);
  rows.push(["Period range", `${snapshot.basePeriod.start} to ${snapshot.basePeriod.end}`]);
  rows.push(["As of date", snapshot.asOfDate]);
  if (snapshot.comparePeriod) {
    rows.push(["Compare period", snapshot.comparePeriod.label]);
  }
  pushBlank();

  pushSection("Budget vs Actual");
  rows.push(["Metric", "Budget", "Actual"]);
  rows.push(["Income", formatMoney(snapshot.baseStats.budgetIncome), formatMoney(snapshot.baseStats.actualIncome)]);
  rows.push(["Spending", formatMoney(snapshot.baseStats.budgetSpending), formatMoney(snapshot.baseStats.actualSpending)]);
  rows.push(["Savings", formatMoney(snapshot.baseStats.budgetSavings), formatMoney(snapshot.baseStats.actualSavings)]);
  rows.push(["Leftover", formatMoney(snapshot.baseStats.budgetLeftover), formatMoney(snapshot.baseStats.actualLeftover)]);
  if (snapshot.compareStats) {
    rows.push(["Delta vs compare", "", ""]);
    rows.push(["Income delta", formatMoney(snapshot.baseStats.actualIncome - snapshot.compareStats.actualIncome)]);
    rows.push(["Spending delta", formatMoney(snapshot.baseStats.actualSpending - snapshot.compareStats.actualSpending)]);
    rows.push(["Savings delta", formatMoney(snapshot.baseStats.actualSavings - snapshot.compareStats.actualSavings)]);
    rows.push(["Leftover delta", formatMoney(snapshot.baseStats.actualLeftover - snapshot.compareStats.actualLeftover)]);
  }
  pushBlank();

  pushSection("Pace & Forecast");
  rows.push(["Time progress", formatPercent(snapshot.timeProgress)]);
  rows.push(["Days elapsed", String(snapshot.daysElapsed)]);
  rows.push(["Period days", String(snapshot.periodDays)]);
  rows.push(["Projected leftover", formatMoney(snapshot.projectedLeftover)]);
  rows.push(["Projected end balance", formatMoney(snapshot.endBalance)]);
  rows.push(["Lowest balance", snapshot.lowestPoint ? formatMoney(snapshot.lowestPoint.balance) : "0"]);
  rows.push(["Risk days", String(snapshot.riskDays)]);
  if (snapshot.firstRisk) {
    rows.push(["First risk date", snapshot.firstRisk.date]);
  }
  pushBlank();

  pushSection("Forecast scenarios");
  rows.push(["Scenario", "End balance", "Leftover", "Buffer delta"]);
  snapshot.forecastScenarios.forEach((scenario) => {
    rows.push([
      scenario.label,
      formatMoney(scenario.endBalance),
      formatMoney(scenario.leftover),
      formatMoney(scenario.bufferDelta),
    ]);
  });
  pushBlank();

  pushSection("Variance by category");
  rows.push(["Category", "Budgeted", "Actual", "Variance", "Status"]);
  Object.values(snapshot.varianceByCategory)
    .filter(Boolean)
    .sort((a, b) => Math.abs((b?.variance ?? 0)) - Math.abs((a?.variance ?? 0)))
    .forEach((row) => {
      if (!row) return;
      rows.push([
        row.category,
        formatMoney(row.budgeted),
        formatMoney(row.actual),
        formatMoney(row.variance),
        row.status,
      ]);
    });
  pushBlank();

  pushSection("Variable cap");
  rows.push(["Variable cap", formatMoney(snapshot.variableCap)]);
  rows.push(["Variable spend", formatMoney(snapshot.variableSpend)]);
  rows.push(["Variable delta", formatMoney(snapshot.variableDelta)]);
  pushBlank();

  pushSection("Overspent items");
  rows.push(["Label", "Amount", "Category"]);
  snapshot.overspendItems.forEach((item) => {
    rows.push([item.label || "Unlabeled", formatMoney(item.amount), item.category]);
  });
  pushBlank();

  pushSection("Bill variance");
  rows.push(["Bill", "Budget", "Actual", "Variance"]);
  snapshot.billVariance.forEach((row) => {
    rows.push([
      row.label,
      formatMoney(row.budget),
      formatMoney(row.actual),
      formatMoney(row.variance),
    ]);
  });
  pushBlank();

  pushSection("Top merchants");
  rows.push(["Merchant", "Total", "Delta vs compare"]);
  snapshot.merchantRows.forEach((row) => {
    rows.push([row.label, formatMoney(row.total), formatMoney(row.delta)]);
  });
  pushBlank();

  pushSection("Income stability");
  rows.push(["Average income", formatMoney(snapshot.incomeAverage)]);
  rows.push(["Income volatility", formatMoney(snapshot.incomeVolatility)]);
  rows.push(["Stability score", snapshot.stabilityScore === null ? "N/A" : `${snapshot.stabilityScore}/100`]);
  rows.push(["Reliable income", formatMoney(snapshot.incomeSplit.reliable)]);
  rows.push(["Irregular income", formatMoney(snapshot.incomeSplit.irregular)]);
  if (snapshot.incomeSourceChanges) {
    rows.push(["New sources", snapshot.incomeSourceChanges.newSources.join("; ") || "None"]);
    rows.push(["Missing sources", snapshot.incomeSourceChanges.missingSources.join("; ") || "None"]);
  }
  pushBlank();

  pushSection("Savings health");
  rows.push(["Savings rate", formatPercent(snapshot.savingsRate)]);
  rows.push(["Savings streak (periods)", String(snapshot.savingsStreak)]);
  pushBlank();

  pushSection("Recommendations");
  snapshot.recommendations.forEach((rec) => rows.push([rec]));
  pushBlank();

  pushSection("Period highlights");
  rows.push([
    "Highest income",
    `${formatMoney(snapshot.periodHighlights.incomePeak.value)} (${periodLabelAt(snapshot.sortedPeriods, snapshot.periodHighlights.incomePeak.index)})`,
  ]);
  rows.push([
    "Highest spending",
    `${formatMoney(snapshot.periodHighlights.spendingPeak.value)} (${periodLabelAt(snapshot.sortedPeriods, snapshot.periodHighlights.spendingPeak.index)})`,
  ]);
  rows.push([
    "Best leftover",
    `${formatMoney(snapshot.periodHighlights.bestLeftover.value)} (${periodLabelAt(snapshot.sortedPeriods, snapshot.periodHighlights.bestLeftover.index)})`,
  ]);
  rows.push([
    "Lowest leftover",
    `${formatMoney(snapshot.periodHighlights.worstLeftover.value)} (${periodLabelAt(snapshot.sortedPeriods, snapshot.periodHighlights.worstLeftover.index)})`,
  ]);
  pushBlank();

  pushSection("Period trends");
  rows.push(["Period", "Income", "Spending"]);
  snapshot.periodTrendData.forEach((row) => {
    rows.push([row.date, formatMoney(row.income), formatMoney(row.spending)]);
  });

  const csv = rows.map((row) => row.map((cell) => csvEscape(String(cell ?? ""))).join(",")).join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  downloadTextFile(csv, `velanovo-insights-${stamp}.csv`, "text/csv");
}

export function downloadInsightsPdf(snapshot: InsightsSnapshot) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 50;
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Velanovo Insights Report", 40, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  y += 18;
  doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, 40, y);
  y += 20;

  y = addSectionTitle(doc, "Meta", y);
  autoTable(doc, {
    startY: y,
    head: [["Key", "Value"]],
    body: [
      ["Base period", snapshot.basePeriod.label],
      ["Period range", `${snapshot.basePeriod.start} to ${snapshot.basePeriod.end}`],
      ["Compare period", snapshot.comparePeriod?.label ?? "None"],
      ["As of date", snapshot.asOfDate],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 39, 50] },
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Budget vs Actual", y);
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Budget", "Actual"]],
    body: [
      ["Income", formatMoney(snapshot.baseStats.budgetIncome), formatMoney(snapshot.baseStats.actualIncome)],
      ["Spending", formatMoney(snapshot.baseStats.budgetSpending), formatMoney(snapshot.baseStats.actualSpending)],
      ["Savings", formatMoney(snapshot.baseStats.budgetSavings), formatMoney(snapshot.baseStats.actualSavings)],
      ["Leftover", formatMoney(snapshot.baseStats.budgetLeftover), formatMoney(snapshot.baseStats.actualLeftover)],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 39, 50] },
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Pace & Forecast", y);
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Time progress", formatPercent(snapshot.timeProgress)],
      ["Days elapsed", String(snapshot.daysElapsed)],
      ["Period days", String(snapshot.periodDays)],
      ["Projected leftover", formatMoney(snapshot.projectedLeftover)],
      ["Projected end balance", formatMoney(snapshot.endBalance)],
      ["Lowest balance", snapshot.lowestPoint ? formatMoney(snapshot.lowestPoint.balance) : "0"],
      ["Risk days", String(snapshot.riskDays)],
      ["First risk date", snapshot.firstRisk?.date ?? "None"],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 39, 50] },
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Forecast scenarios", y);
  autoTable(doc, {
    startY: y,
    head: [["Scenario", "End balance", "Leftover", "Buffer delta"]],
    body: snapshot.forecastScenarios.map((s) => [
      s.label,
      formatMoney(s.endBalance),
      formatMoney(s.leftover),
      formatMoney(s.bufferDelta),
    ]),
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 39, 50] },
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Variance by category", y);
  autoTable(doc, {
    startY: y,
    head: [["Category", "Budgeted", "Actual", "Variance", "Status"]],
    body: Object.values(snapshot.varianceByCategory)
      .filter(Boolean)
      .sort((a, b) => Math.abs((b?.variance ?? 0)) - Math.abs((a?.variance ?? 0)))
      .map((row) => [
        row?.category ?? "",
        formatMoney(row?.budgeted ?? 0),
        formatMoney(row?.actual ?? 0),
        formatMoney(row?.variance ?? 0),
        row?.status ?? "",
      ]),
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 39, 50] },
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Variable cap", y);
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Variable cap", formatMoney(snapshot.variableCap)],
      ["Variable spend", formatMoney(snapshot.variableSpend)],
      ["Variable delta", formatMoney(snapshot.variableDelta)],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 39, 50] },
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Overspent items", y);
  autoTable(doc, {
    startY: y,
    head: [["Label", "Amount", "Category"]],
    body: snapshot.overspendItems.map((item) => [
      item.label || "Unlabeled",
      formatMoney(item.amount),
      item.category,
    ]),
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 39, 50] },
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Bill variance", y);
  autoTable(doc, {
    startY: y,
    head: [["Bill", "Budget", "Actual", "Variance"]],
    body: snapshot.billVariance.map((row) => [
      row.label,
      formatMoney(row.budget),
      formatMoney(row.actual),
      formatMoney(row.variance),
    ]),
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 39, 50] },
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Top merchants", y);
  autoTable(doc, {
    startY: y,
    head: [["Merchant", "Total", "Delta vs compare"]],
    body: snapshot.merchantRows.map((row) => [
      row.label,
      formatMoney(row.total),
      formatMoney(row.delta),
    ]),
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 39, 50] },
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Income stability", y);
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Average income", formatMoney(snapshot.incomeAverage)],
      ["Income volatility", formatMoney(snapshot.incomeVolatility)],
      ["Stability score", snapshot.stabilityScore === null ? "N/A" : `${snapshot.stabilityScore}/100`],
      ["Reliable income", formatMoney(snapshot.incomeSplit.reliable)],
      ["Irregular income", formatMoney(snapshot.incomeSplit.irregular)],
      ["New sources", snapshot.incomeSourceChanges?.newSources.join(", ") || "None"],
      ["Missing sources", snapshot.incomeSourceChanges?.missingSources.join(", ") || "None"],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 39, 50] },
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Savings health", y);
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Savings rate", formatPercent(snapshot.savingsRate)],
      ["Savings streak (periods)", String(snapshot.savingsStreak)],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 39, 50] },
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Recommendations", y);
  autoTable(doc, {
    startY: y,
    head: [["Recommendation"]],
    body: snapshot.recommendations.map((rec) => [rec]),
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 39, 50] },
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Period highlights", y);
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      [
        "Highest income",
        `${formatMoney(snapshot.periodHighlights.incomePeak.value)} (${periodLabelAt(snapshot.sortedPeriods, snapshot.periodHighlights.incomePeak.index)})`,
      ],
      [
        "Highest spending",
        `${formatMoney(snapshot.periodHighlights.spendingPeak.value)} (${periodLabelAt(snapshot.sortedPeriods, snapshot.periodHighlights.spendingPeak.index)})`,
      ],
      [
        "Best leftover",
        `${formatMoney(snapshot.periodHighlights.bestLeftover.value)} (${periodLabelAt(snapshot.sortedPeriods, snapshot.periodHighlights.bestLeftover.index)})`,
      ],
      [
        "Lowest leftover",
        `${formatMoney(snapshot.periodHighlights.worstLeftover.value)} (${periodLabelAt(snapshot.sortedPeriods, snapshot.periodHighlights.worstLeftover.index)})`,
      ],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 39, 50] },
  });

  y = nextTableY(doc, y + 20);
  y = addSectionTitle(doc, "Period trends", y);
  autoTable(doc, {
    startY: y,
    head: [["Period", "Income", "Spending"]],
    body: snapshot.periodTrendData.map((row) => [
      row.date,
      formatMoney(row.income),
      formatMoney(row.spending),
    ]),
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [20, 39, 50] },
  });

  const filenameSafe = snapshot.basePeriod.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`velanovo-insights-${filenameSafe || "period"}.pdf`);
}
