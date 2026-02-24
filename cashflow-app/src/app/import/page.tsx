"use client";

import { useRef, useState } from "react";
import { loadPlan, savePlan } from "@/lib/storage";
import { formatMoney } from "@/lib/currency";
import SidebarNav from "@/components/SidebarNav";
import { getPeriod } from "@/lib/cashflowEngine";
import { toast } from "@/components/Toast";
import type { CashflowCategory, CashflowType, Transaction } from "@/data/plan";
import { suggestCategory } from "@/lib/categorization";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  id: string;
  rawDate: string;
  date: string; // YYYY-MM-DD
  label: string;
  amount: number;
  type: CashflowType;
  category: CashflowCategory;
  selected: boolean;
  isDuplicate?: boolean; // flagged against existing transactions
  confidence?: number;   // categorization confidence 0-100
}

const CATEGORIES: CashflowCategory[] = [
  "income", "bill", "giving", "savings", "allowance", "buffer", "other",
];

// ─── Deduplication ────────────────────────────────────────────────────────────

function normalizeLabel(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function labelSimilarity(a: string, b: string): number {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const wa = new Set(na.split(" "));
  const wb = new Set(nb.split(" "));
  let shared = 0;
  wa.forEach(w => { if (wb.has(w)) shared++; });
  return shared / Math.max(wa.size, wb.size);
}

function isDuplicateOf(row: ParsedRow, existing: Transaction[]): boolean {
  const rowDate = new Date(row.date).getTime();
  for (const t of existing) {
    const tDate = new Date(t.date).getTime();
    const daysDiff = Math.abs(rowDate - tDate) / 86_400_000;
    if (daysDiff > 3) continue;
    if (Math.abs(t.amount - row.amount) > 0.01) continue;
    if (labelSimilarity(t.label, row.label) >= 0.6) return true;
  }
  return false;
}

// ─── OFX / QFX Parsing ───────────────────────────────────────────────────────

function parseOFX(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  // Support both SGML (old OFX) and XML-style OFX
  const txnBlocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ??
                    [...text.matchAll(/\<STMTTRN\>([\s\S]*?)(?=\<STMTTRN\>|\<\/BANKTRANLIST\>)/gi)].map(m => m[0]);

  for (const block of txnBlocks) {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<\r\n]+)`, "i"));
      return m ? m[1].trim() : "";
    };

    const trntype = get("TRNTYPE");
    const dtposted = get("DTPOSTED");
    const trnamt = get("TRNAMT");
    const name = get("NAME") || get("MEMO");

    if (!dtposted || !trnamt || !name) continue;

    // OFX date: YYYYMMDDHHMMSS or YYYYMMDD
    const y = dtposted.substring(0, 4);
    const mo = dtposted.substring(4, 6);
    const d = dtposted.substring(6, 8);
    const date = `${y}-${mo}-${d}`;

    const rawAmt = parseFloat(trnamt.replace(/[^0-9.\-]/g, ""));
    if (isNaN(rawAmt)) continue;

    const amount = Math.abs(rawAmt);
    const isCredit = rawAmt > 0 || trntype === "CREDIT" || trntype === "DEP" || trntype === "INT";
    const type: CashflowType = isCredit ? "income" : "outflow";

    const suggestion = suggestCategory(name);
    const category: CashflowCategory = type === "income" ? "income" : suggestion.category;

    rows.push({
      id: `ofx-${rows.length}-${Date.now()}`,
      rawDate: dtposted,
      date,
      label: name,
      amount,
      type,
      category,
      selected: true,
      confidence: suggestion.confidence,
    });
  }
  return rows;
}

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDate(raw: string): string {
  // Try common formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY
  const s = raw.trim();
  // ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or MM/DD/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, a, b, y] = slash;
    // Heuristic: if first part > 12 it must be day, so DD/MM/YYYY
    const mm = parseInt(a) > 12 ? b.padStart(2, "0") : a.padStart(2, "0");
    const dd = parseInt(a) > 12 ? a.padStart(2, "0") : b.padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  // DD-MM-YYYY
  const dash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dash) {
    const [, d, m, y] = dash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

function detectColumns(headers: string[]): { dateCol: number; labelCol: number; amtCol: number; creditCol: number; debitCol: number } {
  const h = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const find = (...terms: string[]) => h.findIndex(x => terms.some(t => x.includes(t)));

  return {
    dateCol:   find("date", "transdate", "postdate", "posteddate"),
    labelCol:  find("description", "desc", "memo", "payee", "narration", "detail", "name"),
    amtCol:    find("amount", "amt", "value"),
    creditCol: find("credit", "deposit", "moneyout"),
    debitCol:  find("debit", "withdrawal", "moneyin"),
  };
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/[£$€,\s]/g, "")) || 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const plan = loadPlan();
  const period = getPeriod(plan, plan.setup.selectedPeriodId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [imported, setImported] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hideDuplicates, setHideDuplicates] = useState(false);

  function applyDedup(parsed: ParsedRow[]): ParsedRow[] {
    const existing = loadPlan().transactions;
    return parsed.map(row => ({
      ...row,
      isDuplicate: isDuplicateOf(row, existing),
      // Auto-deselect likely duplicates
      selected: !isDuplicateOf(row, existing),
    }));
  }

  function processCSV(text: string) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return;

    const rawHeaders = parseCSVLine(lines[0]);
    setHeaders(rawHeaders);

    const { dateCol, labelCol, amtCol, creditCol, debitCol } = detectColumns(rawHeaders);

    const parsed: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      if (cols.every(c => !c)) continue;

      const rawDate = dateCol >= 0 ? cols[dateCol] ?? "" : "";
      const label   = (labelCol >= 0 ? cols[labelCol] ?? "" : cols[1] ?? "").replace(/^"(.*)"$/, "$1");
      let amount    = 0;
      let type: CashflowType = "outflow";

      if (amtCol >= 0) {
        const raw = parseAmount(cols[amtCol] ?? "");
        amount = Math.abs(raw);
        type = raw >= 0 ? "income" : "outflow";
      } else if (creditCol >= 0 || debitCol >= 0) {
        const credit = parseAmount(cols[creditCol] ?? "0");
        const debit  = parseAmount(cols[debitCol] ?? "0");
        if (credit > 0) { amount = credit; type = "income"; }
        else { amount = debit; type = "outflow"; }
      }

      if (!label || amount === 0) continue;

      const date = parseDate(rawDate);
      const suggestion = type === "income" ? { category: "income" as CashflowCategory, confidence: 99 } : suggestCategory(label);
      const category = suggestion.category;

      parsed.push({
        id: `import-${i}-${Date.now()}`,
        rawDate,
        date,
        label,
        amount,
        type,
        category,
        selected: true,
        confidence: suggestion.confidence,
      });
    }

    setRows(applyDedup(parsed));
    setImported(false);
  }

  function processOFX(text: string) {
    const parsed = parseOFX(text);
    if (parsed.length === 0) { toast.error("No transactions found in OFX file"); return; }
    setHeaders([]);
    setRows(applyDedup(parsed));
    setImported(false);
  }

  function processFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    const name = file.name.toLowerCase();
    if (name.endsWith(".ofx") || name.endsWith(".qfx") || name.endsWith(".qbo")) {
      reader.onload = (ev) => processOFX(ev.target?.result as string);
    } else {
      reader.onload = (ev) => processCSV(ev.target?.result as string);
    }
    reader.readAsText(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) { toast.error("Please drop a CSV or OFX file"); return; }
    const name = file.name.toLowerCase();
    const valid = name.endsWith(".csv") || name.endsWith(".ofx") || name.endsWith(".qfx") || name.endsWith(".qbo");
    if (!valid) { toast.error("Supported formats: CSV, OFX, QFX"); return; }
    processFile(file);
  }

  function updateRow(id: string, patch: Partial<ParsedRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function handleImport() {
    const toImport = rows.filter(r => r.selected);
    if (toImport.length === 0) { toast.error("No rows selected"); return; }

    const newTxns: Transaction[] = toImport.map(r => ({
      id: r.id,
      date: r.date,
      label: r.label,
      amount: r.amount,
      type: r.type,
      category: r.category,
    }));

    const existing = loadPlan();
    const updatedPlan = {
      ...existing,
      transactions: [...(existing.transactions || []), ...newTxns],
    };
    savePlan(updatedPlan);
    setImported(true);
    toast.success(`${newTxns.length} transaction${newTxns.length > 1 ? "s" : ""} imported!`);
    setRows([]);
  }

  const visibleRows = hideDuplicates ? rows.filter(r => !r.isDuplicate) : rows;
  const duplicateCount = rows.filter(r => r.isDuplicate).length;
  const selectedCount = rows.filter(r => r.selected).length;

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-40 pt-5">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

          <section className="space-y-6">
            <header className="vn-masthead">
              <div className="text-xs uppercase tracking-widest font-semibold text-white/50 mb-1">Transactions</div>
              <h1 className="text-2xl font-bold text-white/90" style={{ fontFamily: "var(--font-playfair, serif)" }}>CSV / Bank Import</h1>
              <p className="mt-1 text-sm text-white/55">
                Import transactions from your bank export. Supports CSV, OFX, QFX, and QBO formats.
              </p>
            </header>

            {/* Drop zone */}
            {rows.length === 0 && !imported && (
              <div
                className={`vn-card p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-2 border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                    : "border-2 border-dashed border-[var(--vn-border)] hover:border-blue-300"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="text-4xl mb-4">📂</div>
                <p className="font-semibold text-[var(--vn-text)]">Drop your bank file here</p>
                <p className="text-sm text-[var(--vn-muted)] mt-1">or click to browse</p>
                <p className="text-xs text-[var(--vn-muted)] mt-3">CSV, OFX, QFX, QBO — Barclays, Chase, Monzo, Revolut, YNAB, Quicken</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.ofx,.qfx,.qbo"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {/* Import success */}
            {imported && (
              <div className="vn-card p-8 text-center">
                <div className="text-4xl mb-3">✅</div>
                <h2 className="text-lg font-bold text-[var(--vn-text)]">Import complete!</h2>
                <p className="text-sm text-[var(--vn-muted)] mt-1 mb-4">Your transactions have been added to this period.</p>
                <button
                  onClick={() => { setImported(false); setRows([]); setFileName(null); }}
                  className="vn-btn vn-btn-ghost text-sm px-4 py-2"
                >
                  Import another file
                </button>
              </div>
            )}

            {/* Preview table */}
            {rows.length > 0 && (
              <div className="vn-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--vn-border)]">
                  <div>
                    <div className="font-semibold text-[var(--vn-text)]">
                      {fileName} — {rows.length} rows
                    </div>
                    <div className="text-xs text-[var(--vn-muted)] mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{selectedCount} selected</span>
                      <span>·</span>
                      <span>{formatMoney(rows.filter(r => r.selected && r.type === "outflow").reduce((s, r) => s + r.amount, 0))} outflows</span>
                      <span>·</span>
                      <span>{formatMoney(rows.filter(r => r.selected && r.type === "income").reduce((s, r) => s + r.amount, 0))} income</span>
                      {duplicateCount > 0 && (
                        <>
                          <span>·</span>
                          <button
                            onClick={() => setHideDuplicates(h => !h)}
                            className={`font-medium transition-colors ${hideDuplicates ? "text-amber-600" : "text-amber-500 hover:text-amber-700"}`}
                          >
                            {duplicateCount} possible duplicate{duplicateCount !== 1 ? "s" : ""}
                            {hideDuplicates ? " (showing)" : " (hidden)"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: !r.isDuplicate })))}
                      className="text-xs text-[var(--vn-muted)] hover:text-[var(--vn-text)] px-2 py-1"
                    >
                      Select non-dupes
                    </button>
                    <button
                      onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: true })))}
                      className="text-xs text-[var(--vn-muted)] hover:text-[var(--vn-text)] px-2 py-1"
                    >
                      All
                    </button>
                    <button
                      onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: false })))}
                      className="text-xs text-[var(--vn-muted)] hover:text-[var(--vn-text)] px-2 py-1"
                    >
                      None
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={selectedCount === 0}
                      className="vn-btn vn-btn-primary text-sm px-4 py-2 disabled:opacity-50"
                    >
                      Import {selectedCount} row{selectedCount !== 1 ? "s" : ""}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[var(--vn-muted)] border-b border-[var(--vn-border)] bg-[var(--vn-bg-subtle,var(--vn-bg))]">
                        <th className="px-4 py-2 w-8"><input type="checkbox" checked={selectedCount === visibleRows.length && visibleRows.length > 0} onChange={e => setRows(prev => prev.map(r => (hideDuplicates && r.isDuplicate) ? r : { ...r, selected: e.target.checked }))} /></th>
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2 min-w-[200px]">Description</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => (
                        <tr
                          key={row.id}
                          className={`border-b border-[var(--vn-border)] transition-colors ${!row.selected ? "opacity-40" : ""} ${row.isDuplicate ? "bg-amber-50/30 dark:bg-amber-900/10" : ""}`}
                        >
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={e => updateRow(row.id, { selected: e.target.checked })}
                            />
                          </td>
                          <td className="px-4 py-2 text-xs text-[var(--vn-muted)] whitespace-nowrap">{row.date}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={row.label}
                                onChange={e => updateRow(row.id, { label: e.target.value })}
                                className="flex-1 bg-transparent border-none outline-none text-[var(--vn-text)] text-sm focus:bg-[var(--vn-bg)] focus:px-1 rounded min-w-0"
                              />
                              {row.isDuplicate && (
                                <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                  duplicate?
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`px-4 py-2 text-right font-medium tabular-nums ${row.type === "income" ? "text-emerald-600" : ""}`}>
                            {row.type === "income" ? "+" : "-"}{formatMoney(row.amount)}
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={row.type}
                              onChange={e => updateRow(row.id, { type: e.target.value as CashflowType })}
                              className="text-xs bg-transparent border border-[var(--vn-border)] rounded px-1 py-0.5"
                            >
                              <option value="outflow">Outflow</option>
                              <option value="income">Income</option>
                              <option value="transfer">Transfer</option>
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              <select
                                value={row.category}
                                onChange={e => updateRow(row.id, { category: e.target.value as CashflowCategory })}
                                className="text-xs bg-transparent border border-[var(--vn-border)] rounded px-1 py-0.5 capitalize"
                              >
                                {CATEGORIES.map(c => (
                                  <option key={c} value={c} className="capitalize">{c}</option>
                                ))}
                              </select>
                              {row.confidence !== undefined && row.confidence < 50 && (
                                <span title={`Auto-categorised with ${row.confidence}% confidence`} className="text-[10px] text-[var(--vn-muted)]">~</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Format tips */}
            <div className="vn-card p-5">
              <h3 className="text-sm font-semibold text-[var(--vn-text)] mb-3">📋 Supported formats</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[var(--vn-muted)]">
                <div>
                  <div className="font-medium text-[var(--vn-text)] mb-1">CSV auto-detected columns</div>
                  <ul className="space-y-0.5">
                    <li>• Date, Posted Date, Transaction Date</li>
                    <li>• Description, Memo, Payee, Narration</li>
                    <li>• Amount, Debit/Credit columns</li>
                  </ul>
                </div>
                <div>
                  <div className="font-medium text-[var(--vn-text)] mb-1">OFX / QFX / QBO</div>
                  <ul className="space-y-0.5">
                    <li>• Quicken, Mint, most UK banks</li>
                    <li>• Full date + payee parsing</li>
                    <li>• Credit/debit auto-detected</li>
                  </ul>
                </div>
                <div>
                  <div className="font-medium text-[var(--vn-text)] mb-1">Date formats</div>
                  <ul className="space-y-0.5">
                    <li>• YYYY-MM-DD (ISO)</li>
                    <li>• DD/MM/YYYY or MM/DD/YYYY</li>
                    <li>• DD-MM-YYYY</li>
                  </ul>
                </div>
              </div>
            </div>

          </section>
        </div>
      </div>
    </main>
  );
}
