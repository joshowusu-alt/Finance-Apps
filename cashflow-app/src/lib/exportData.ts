import type { Transaction } from "@/data/plan";

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

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `transactions-${periodLabel}-${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportToExcel(transactions: Transaction[], periodLabel: string) {
  // Dynamic import to reduce bundle size
  const XLSX = await import("xlsx");

  const data = transactions.map((txn) => ({
    Date: txn.date,
    Label: txn.label,
    Amount: txn.amount,
    Type: txn.type,
    Category: txn.category,
    Notes: txn.notes || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

  // Set column widths
  worksheet["!cols"] = [
    { wch: 12 }, // Date
    { wch: 30 }, // Label
    { wch: 12 }, // Amount
    { wch: 10 }, // Type
    { wch: 12 }, // Category
    { wch: 40 }, // Notes
  ];

  XLSX.writeFile(workbook, `transactions-${periodLabel}-${new Date().toISOString().split("T")[0]}.xlsx`);
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

  // Add title
  doc.setFontSize(18);
  doc.text("Velanovo - Transaction Report", 14, 20);

  // Add period info
  doc.setFontSize(11);
  doc.text(`Period: ${periodLabel}`, 14, 30);
  doc.text(`${periodStart} to ${periodEnd}`, 14, 36);

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
  doc.text(`Total Income: £${totalIncome.toFixed(2)}`, 14, 44);
  doc.text(`Total Outflow: £${totalOutflow.toFixed(2)}`, 14, 50);
  doc.text(`Total Transfers: £${totalTransfer.toFixed(2)}`, 14, 56);
  doc.text(`Net: £${(totalIncome - totalOutflow - totalTransfer).toFixed(2)}`, 14, 62);

  // Add transactions table
  const tableData = transactions.map((txn) => [
    txn.date,
    txn.label,
    `£${txn.amount.toFixed(2)}`,
    txn.type,
    txn.category,
    txn.notes || "",
  ]);

  autoTable(doc, {
    startY: 70,
    head: [["Date", "Label", "Amount", "Type", "Category", "Notes"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [74, 168, 179] }, // Velanovo teal color
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

  doc.save(`transactions-${periodLabel}-${new Date().toISOString().split("T")[0]}.pdf`);
}
