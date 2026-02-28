import type { Transaction } from "@/data/plan";
import { getReportBranding } from "@/lib/branding";
import { formatMoney } from "@/lib/currency";

export function exportToCSV(transactions: Transaction[], periodLabel: string) {
  const headers = ["Date", "Label", "Amount", "Type", "Category", "Notes"];
  const rows = transactions.map((txn) => [
    txn.date,
    `"${txn.label.replace(/"/g, '""')}"`,
    txn.amount.toFixed(2),
    txn.type,
    txn.category,
    `"${(txn.notes || "").replace(/"/g, '""')}"`,
  ]);

  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const { filenamePrefix } = getReportBranding();

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filenamePrefix}-transactions-${periodLabel}-${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportToExcel(transactions: Transaction[], periodLabel: string) {
  // Dynamic import to reduce bundle size
  const { default: ExcelJS } = await import("exceljs");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Transactions");

  sheet.columns = [
    { header: "Date", key: "Date", width: 12 },
    { header: "Label", key: "Label", width: 30 },
    { header: "Amount", key: "Amount", width: 12 },
    { header: "Type", key: "Type", width: 10 },
    { header: "Category", key: "Category", width: 12 },
    { header: "Notes", key: "Notes", width: 40 },
  ];

  transactions.forEach((txn) => {
    sheet.addRow({
      Date: txn.date,
      Label: txn.label,
      Amount: txn.amount,
      Type: txn.type,
      Category: txn.category,
      Notes: txn.notes || "",
    });
  });

  const { filenamePrefix } = getReportBranding();
  const filename = `${filenamePrefix}-transactions-${periodLabel}-${new Date().toISOString().split("T")[0]}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportToPDF(
  transactions: Transaction[],
  periodLabel: string,
  periodStart: string,
  periodEnd: string
) {
  // Dynamic import to reduce bundle size
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();
  const { brand, accentRgb, filenamePrefix } = getReportBranding();
  const headStyles = { fillColor: accentRgb };

  // Add title
  let y = 20;
  doc.setFontSize(18);
  doc.text(`${brand.name} - Transaction Report`, 14, y);
  if (brand.tagline) {
    doc.setFontSize(10);
    doc.text(brand.tagline, 14, y + 12);
    y += 8;
  }

  // Add period info
  doc.setFontSize(11);
  doc.text(`Period: ${periodLabel}`, 14, y + 14);
  doc.text(`${periodStart} to ${periodEnd}`, 14, y + 20);

  // Calculate totals
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOutflow = transactions
    .filter((t) => t.type === "outflow")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalTransfer = transactions
    .filter((t) => t.type === "transfer")
    .reduce((sum, t) => sum + t.amount, 0);

  // Add summary
  doc.setFontSize(10);
  const summaryStart = y + 28;
  doc.text(`Total Income: ${formatMoney(totalIncome)}`, 14, summaryStart);
  doc.text(`Total Outflow: ${formatMoney(totalOutflow)}`, 14, summaryStart + 6);
  doc.text(`Total Transfers: ${formatMoney(totalTransfer)}`, 14, summaryStart + 12);
  doc.text(`Net: ${formatMoney(totalIncome - totalOutflow - totalTransfer)}`, 14, summaryStart + 18);

  // Add transactions table
  const tableData = transactions.map((txn) => [
    txn.date,
    txn.label,
    formatMoney(txn.amount),
    txn.type,
    txn.category,
    txn.notes || "",
  ]);

  autoTable(doc, {
    startY: summaryStart + 20,
    head: [["Date", "Label", "Amount", "Type", "Category", "Notes"]],
    body: tableData,
    theme: "striped",
    headStyles,
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 25 }, // Date
      1: { cellWidth: 50 }, // Label
      2: { cellWidth: 25 }, // Amount
      3: { cellWidth: 20 }, // Type
      4: { cellWidth: 25 }, // Category
      5: { cellWidth: 45 }, // Notes
    },
  });

  if (brand.reportFooter) {
    const pageCount = doc.getNumberOfPages();
    doc.setPage(pageCount);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(brand.reportFooter, 14, pageHeight - 24);
    doc.setTextColor(0);
  }

  doc.save(`${filenamePrefix}-transactions-${periodLabel}-${new Date().toISOString().split("T")[0]}.pdf`);
}
