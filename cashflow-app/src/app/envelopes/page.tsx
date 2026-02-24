"use client";

import { useEffect, useMemo, useState } from "react";
import { loadPlan } from "@/lib/storage";
import { formatMoney } from "@/lib/currency";
import SidebarNav from "@/components/SidebarNav";
import { getPeriod } from "@/lib/cashflowEngine";
import { getStorageScope } from "@/lib/storage";
import type { CashflowCategory } from "@/data/plan";

// ─── Storage ─────────────────────────────────────────────────────────────────

function envelopeKey(periodId: number, scope = getStorageScope()) {
  const base = `cashflow_envelopes_v1_p${periodId}`;
  return scope === "default" ? base : `${base}::${scope}`;
}

type EnvelopeMap = Partial<Record<CashflowCategory, number>>;

function loadEnvelopes(periodId: number): EnvelopeMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(envelopeKey(periodId));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveEnvelopes(periodId: number, data: EnvelopeMap) {
  localStorage.setItem(envelopeKey(periodId), JSON.stringify(data));
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ENVELOPE_DEFS: { category: CashflowCategory; label: string; emoji: string; description: string }[] = [
  { category: "bill",      label: "Bills",      emoji: "🧾", description: "Fixed monthly obligations" },
  { category: "giving",    label: "Giving",     emoji: "🫶", description: "Tithing, charity, gifts" },
  { category: "savings",   label: "Savings",    emoji: "🏦", description: "ISA, emergency fund, goals" },
  { category: "allowance", label: "Allowance",  emoji: "🛒", description: "Groceries, dining, personal spend" },
  { category: "buffer",    label: "Buffer",     emoji: "🛡️", description: "Contingency and float" },
  { category: "other",     label: "Other",      emoji: "💸", description: "Miscellaneous outflows" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function EnvelopesPage() {
  const plan = loadPlan();
  const periodId = plan.setup.selectedPeriodId;
  const period = getPeriod(plan, periodId);

  const [allocations, setAllocations] = useState<EnvelopeMap>(() => loadEnvelopes(periodId));
  const [editingCat, setEditingCat] = useState<CashflowCategory | null>(null);
  const [editValue, setEditValue] = useState("");

  // Reload if period changes
  useEffect(() => {
    setAllocations(loadEnvelopes(periodId));
  }, [periodId]);

  // Persist on change
  useEffect(() => {
    saveEnvelopes(periodId, allocations);
  }, [allocations, periodId]);

  // Total income for current period (from transactions)
  const totalIncome = useMemo(
    () =>
      plan.transactions
        .filter(t => t.date >= period.start && t.date <= period.end && t.type === "income")
        .reduce((s, t) => s + t.amount, 0),
    [plan.transactions, period]
  );

  // Actual spending per category this period
  const actualSpend = useMemo(() => {
    const out: Partial<Record<CashflowCategory, number>> = {};
    for (const t of plan.transactions) {
      if (t.date < period.start || t.date > period.end) continue;
      if (t.type !== "outflow" && t.type !== "transfer") continue;
      out[t.category] = (out[t.category] ?? 0) + t.amount;
    }
    return out;
  }, [plan.transactions, period]);

  // Total allocated
  const totalAllocated = useMemo(
    () => Object.values(allocations).reduce<number>((s, v) => s + (v ?? 0), 0),
    [allocations]
  );

  const unallocated = totalIncome - totalAllocated;
  const isFullyAllocated = Math.abs(unallocated) < 0.01;

  function startEdit(cat: CashflowCategory) {
    setEditingCat(cat);
    setEditValue(String(allocations[cat] ?? ""));
  }

  function commitEdit() {
    if (!editingCat) return;
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0) {
      setAllocations(prev => ({ ...prev, [editingCat]: val }));
    }
    setEditingCat(null);
    setEditValue("");
  }

  function nudge(cat: CashflowCategory, delta: number) {
    setAllocations(prev => {
      const current = prev[cat] ?? 0;
      const next = Math.max(0, Math.round((current + delta) * 100) / 100);
      return { ...prev, [cat]: next };
    });
  }

  function autoFill() {
    // Distribute remaining unallocated income proportionally to current allocations,
    // or equally if all are zero.
    const cats = ENVELOPE_DEFS.map(d => d.category);
    const totalAlloc = cats.reduce((s, c) => s + (allocations[c] ?? 0), 0);

    if (totalAlloc === 0) {
      // Equal split
      const share = Math.floor((totalIncome / cats.length) * 100) / 100;
      const patch: EnvelopeMap = {};
      cats.forEach(c => { patch[c] = share; });
      setAllocations(patch);
    } else {
      // Scale to totalIncome
      const scale = totalIncome / totalAlloc;
      const patch: EnvelopeMap = {};
      cats.forEach(c => { patch[c] = Math.floor((allocations[c] ?? 0) * scale * 100) / 100; });
      setAllocations(patch);
    }
  }

  function resetAll() {
    setAllocations({});
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-40 pt-5">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

          <section className="space-y-6">
            {/* Masthead */}
            <header className="vn-masthead">
              <div className="text-xs uppercase tracking-widest font-semibold text-white/50 mb-1">Budgeting</div>
              <h1 className="text-2xl font-bold text-white/90" style={{ fontFamily: "var(--font-playfair, serif)" }}>
                Envelope Budget
              </h1>
              <p className="mt-1 text-sm text-white/55">
                Assign every pound of income to a spending bucket. Zero-based budgeting keeps you in control.
              </p>

              {/* Summary bar */}
              <div className="mt-5 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-white/45 uppercase tracking-wider mb-0.5">Income</div>
                  <div className="text-xl font-semibold tabular-nums text-emerald-300">
                    {formatMoney(totalIncome)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/45 uppercase tracking-wider mb-0.5">Allocated</div>
                  <div className="text-xl font-semibold tabular-nums text-white/90">
                    {formatMoney(totalAllocated)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/45 uppercase tracking-wider mb-0.5">Unallocated</div>
                  <div className={`text-xl font-semibold tabular-nums ${isFullyAllocated ? "text-emerald-300" : unallocated < 0 ? "text-rose-400" : "text-amber-300"}`}>
                    {formatMoney(unallocated)}
                  </div>
                </div>
              </div>

              {/* Zero-based status badge */}
              <div className="mt-4 flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full ${
                    isFullyAllocated
                      ? "bg-emerald-500/20 text-emerald-300"
                      : unallocated < 0
                        ? "bg-rose-500/20 text-rose-300"
                        : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  <span>{isFullyAllocated ? "✓" : unallocated < 0 ? "✕" : "○"}</span>
                  <span>
                    {isFullyAllocated
                      ? "Every pound assigned — zero-based ✓"
                      : unallocated < 0
                        ? `Over-allocated by ${formatMoney(Math.abs(unallocated))}`
                        : `${formatMoney(unallocated)} left to assign`}
                  </span>
                </div>
                {totalIncome > 0 && !isFullyAllocated && (
                  <button
                    onClick={autoFill}
                    className="text-xs font-medium text-white/50 hover:text-white/80 transition-colors underline underline-offset-2"
                  >
                    Auto-fill
                  </button>
                )}
              </div>
            </header>

            {/* No income warning */}
            {totalIncome === 0 && (
              <div className="vn-card p-6 text-center">
                <div className="text-3xl mb-2">💡</div>
                <div className="text-sm font-semibold text-(--vn-text)">No income recorded yet</div>
                <div className="text-xs text-(--vn-muted) mt-1">
                  Add an income transaction for this period to start allocating it to envelopes.
                </div>
              </div>
            )}

            {/* Allocation progress bar */}
            {totalIncome > 0 && (
              <div className="vn-card p-4">
                <div className="flex justify-between text-xs text-(--vn-muted) mb-2">
                  <span>Allocation progress</span>
                  <span>{Math.min(100, Math.round((totalAllocated / totalIncome) * 100))}%</span>
                </div>
                <div className="h-3 rounded-full bg-(--vn-border) overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      totalAllocated > totalIncome ? "bg-rose-400" : isFullyAllocated ? "bg-emerald-400" : "bg-(--vn-primary)"
                    }`}
                    style={{ width: `${Math.min(100, (totalAllocated / totalIncome) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] mt-1.5 text-(--vn-muted)">
                  <span>{formatMoney(totalAllocated)} allocated</span>
                  <span>{formatMoney(totalIncome)} total</span>
                </div>
              </div>
            )}

            {/* Envelope cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ENVELOPE_DEFS.map(({ category, label, emoji, description }) => {
                const allocated = allocations[category] ?? 0;
                const spent = actualSpend[category] ?? 0;
                const remaining = allocated - spent;
                const fillPct = allocated > 0 ? Math.min(100, (spent / allocated) * 100) : 0;
                const isOver = spent > allocated && allocated > 0;

                return (
                  <div
                    key={category}
                    className={`vn-card p-5 transition-shadow ${isOver ? "ring-1 ring-rose-400/40" : ""}`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{emoji}</span>
                        <div>
                          <div className="text-sm font-semibold text-(--vn-text)">{label}</div>
                          <div className="text-[11px] text-(--vn-muted)">{description}</div>
                        </div>
                      </div>
                      {isOver && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400">
                          Over
                        </span>
                      )}
                    </div>

                    {/* Allocation input */}
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => nudge(category, -10)}
                        className="w-8 h-8 rounded-lg bg-(--vn-bg) border border-(--vn-border) text-(--vn-text) font-bold flex items-center justify-center hover:bg-(--vn-surface) transition-colors"
                      >
                        −
                      </button>

                      {editingCat === category ? (
                        <input
                          autoFocus
                          type="number"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={e => e.key === "Enter" && commitEdit()}
                          className="flex-1 text-center text-base font-semibold bg-(--vn-bg) border border-(--vn-primary) rounded-lg px-2 py-1 outline-none text-(--vn-text)"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(category)}
                          className="flex-1 text-center text-base font-semibold text-(--vn-text) hover:text-(--vn-primary) transition-colors py-1 rounded-lg hover:bg-(--vn-bg)"
                        >
                          {formatMoney(allocated)}
                        </button>
                      )}

                      <button
                        onClick={() => nudge(category, 10)}
                        className="w-8 h-8 rounded-lg bg-(--vn-bg) border border-(--vn-border) text-(--vn-text) font-bold flex items-center justify-center hover:bg-(--vn-surface) transition-colors"
                      >
                        +
                      </button>
                    </div>

                    {/* Spent progress bar */}
                    {allocated > 0 && (
                      <>
                        <div className="h-2 rounded-full bg-(--vn-border) overflow-hidden mb-1.5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isOver ? "bg-rose-400" : fillPct > 80 ? "bg-amber-400" : "bg-emerald-400"
                            }`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-(--vn-muted)">
                          <span>Spent {formatMoney(spent)}</span>
                          <span className={remaining < 0 ? "text-rose-500 dark:text-rose-400 font-semibold" : "text-emerald-600 dark:text-emerald-400"}>
                            {remaining < 0 ? `${formatMoney(Math.abs(remaining))} over` : `${formatMoney(remaining)} left`}
                          </span>
                        </div>
                      </>
                    )}

                    {allocated === 0 && spent > 0 && (
                      <div className="text-xs text-amber-500 dark:text-amber-400 mt-1">
                        ⚠ {formatMoney(spent)} spent — set a budget above
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reset */}
            {totalAllocated > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={resetAll}
                  className="text-xs text-(--vn-muted) hover:text-rose-500 transition-colors"
                >
                  Reset all allocations
                </button>
              </div>
            )}

            {/* Explainer */}
            <div className="vn-card p-5 text-xs text-(--vn-muted) space-y-1.5">
              <div className="font-semibold text-(--vn-text) text-sm mb-2">How envelope budgeting works</div>
              <p>Allocate your total income across spending categories so every pound has a job.</p>
              <p>When <strong className="text-(--vn-text)">Unallocated = £0</strong>, you have a zero-based budget — nothing is left unplanned.</p>
              <p>Actual spending is pulled from your transactions automatically. Amounts are saved per period.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
