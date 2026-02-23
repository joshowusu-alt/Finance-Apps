"use client";

import { useMemo, useState } from "react";
import { loadPlan } from "@/lib/storage";
import { formatMoney, getCurrencySymbol } from "@/lib/currency";
import { formatPercent } from "@/lib/formatUtils";
import SidebarNav from "@/components/SidebarNav";
import { motion } from "framer-motion";
import type { Plan } from "@/data/plan";

// ── helpers ──────────────────────────────────────────────────────────────────

function computeYearStats(plan: Plan, year: string) {
  const txns = plan.transactions.filter((t) => t.date.startsWith(year));
  const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const spending = txns.filter((t) => t.type === "outflow").reduce((s, t) => s + t.amount, 0);
  const savings = txns.filter((t) => t.category === "savings").reduce((s, t) => s + t.amount, 0);
  const savingsRate = income > 0 ? savings / income : 0;

  // Biggest spending category
  const catTotals: Record<string, number> = {};
  for (const t of txns.filter((t) => t.type === "outflow")) {
    catTotals[t.category] = (catTotals[t.category] ?? 0) + t.amount;
  }
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  // Top 5 merchants by spend
  const merchantTotals: Record<string, number> = {};
  for (const t of txns.filter((t) => t.type === "outflow")) {
    merchantTotals[t.label] = (merchantTotals[t.label] ?? 0) + t.amount;
  }
  const topMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Best + worst period (by leftover = income - spending)
  const periods = plan.periods.filter((p) => p.start.startsWith(year) || p.end.startsWith(year));
  const periodStats = periods.map((p) => {
    const pIncome = txns.filter((t) => t.type === "income" && t.date >= p.start && t.date <= p.end).reduce((s, t) => s + t.amount, 0);
    const pSpend = txns.filter((t) => t.type === "outflow" && t.date >= p.start && t.date <= p.end).reduce((s, t) => s + t.amount, 0);
    return { label: p.label, leftover: pIncome - pSpend };
  });
  const bestPeriod = periodStats.sort((a, b) => b.leftover - a.leftover)[0] ?? null;
  const worstPeriod = periodStats.sort((a, b) => a.leftover - b.leftover)[0] ?? null;

  // Goals completed this year
  const completedGoals = plan.savingsGoals.filter(
    (g) => g.currentAmount >= g.targetAmount
  ).length;

  // Consecutive saving periods
  const sortedPeriods = [...plan.periods].sort((a, b) => a.start.localeCompare(b.start));
  let streak = 0;
  for (let i = sortedPeriods.length - 1; i >= 0; i--) {
    const p = sortedPeriods[i];
    const pIncome = plan.transactions.filter((t) => t.type === "income" && t.date >= p.start && t.date <= p.end).reduce((s, t) => s + t.amount, 0);
    const pSav = plan.transactions.filter((t) => t.category === "savings" && t.date >= p.start && t.date <= p.end).reduce((s, t) => s + t.amount, 0);
    if (pSav > 0 && pIncome > 0 && pSav / pIncome > 0.01) streak++;
    else break;
  }

  return {
    income, spending, savings, savingsRate, topCat, topMerchants,
    bestPeriod, worstPeriod, completedGoals, streak, txnCount: txns.length,
    periodCount: periods.length,
  };
}

// ── card component ────────────────────────────────────────────────────────────

function StatCard({
  idx,
  emoji,
  label,
  value,
  sub,
  accent,
}: {
  idx: number;
  emoji: string;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.07, type: "spring", damping: 22, stiffness: 200 }}
      className="vn-card p-5 flex flex-col gap-1"
    >
      <div className="text-2xl">{emoji}</div>
      <div className="text-xs uppercase tracking-wide text-[var(--vn-muted)] mt-1">{label}</div>
      <div
        className="text-xl font-bold mt-0.5"
        style={{ color: accent ?? "var(--vn-text)" }}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-[var(--vn-muted)]">{sub}</div>}
    </motion.div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function YearInReviewPage() {
  const plan = useMemo(() => loadPlan(), []);

  // Derive available years from all transaction dates
  const years = useMemo(() => {
    const ys = new Set(plan.transactions.map((t) => t.date.slice(0, 4)));
    return Array.from(ys).sort().reverse();
  }, [plan]);

  const currentYear = new Date().getFullYear().toString();
  const [year, setYear] = useState(years[0] ?? currentYear);
  const s = useMemo(() => computeYearStats(plan, year), [plan, year]);
  const currency = getCurrencySymbol(plan.setup.currency);

  const leftover = s.income - s.spending;
  const hasData = s.txnCount > 0;

  return (
    <main className="flex min-h-screen" style={{ background: "var(--vn-bg)" }}>
      <SidebarNav />
      <div className="flex-1 max-w-3xl mx-auto px-4 py-8 pb-28">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <h1
              className="text-3xl font-bold"
              style={{ fontFamily: "var(--font-playfair)", color: "var(--vn-text)" }}
            >
              {year} in Review
            </h1>
            {years.length > 1 && (
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="text-sm rounded-lg px-3 py-1.5 outline-none"
                style={{ background: "var(--vn-surface)", color: "var(--vn-text)", border: "1px solid var(--vn-border)" }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>
          <p className="text-sm text-[var(--vn-muted)] mt-1">
            {hasData ? `${s.txnCount} transactions across ${s.periodCount} period${s.periodCount !== 1 ? "s" : ""}` : "No transaction data for this year yet."}
          </p>
        </motion.div>

        {!hasData ? (
          <div className="vn-card p-10 text-center">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-[var(--vn-muted)] text-sm">
              No transactions recorded for {year}. Log some spending to see your year-end summary.
            </div>
          </div>
        ) : (
          <>
            {/* Big number hero */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05, type: "spring", damping: 20 }}
              className="vn-card p-7 mb-6 text-center"
              style={{ background: "linear-gradient(135deg, var(--vn-surface) 0%, var(--vn-surface-raised, var(--vn-surface)) 100%)" }}
            >
              <div className="text-xs uppercase tracking-widest text-[var(--vn-muted)] mb-2">Total income {year}</div>
              <div className="text-5xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "var(--gold, #d4a82a)" }}>
                {formatMoney(s.income)}
              </div>
              <div className="mt-3 flex items-center justify-center gap-6 text-sm text-[var(--vn-muted)]">
                <span>Spent <span className="font-semibold text-[var(--vn-text)]">{formatMoney(s.spending)}</span></span>
                <span>·</span>
                <span>Saved <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(s.savings)}</span></span>
                <span>·</span>
                <span>Left <span className={`font-semibold ${leftover >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>{formatMoney(leftover)}</span></span>
              </div>
            </motion.div>

            {/* Stat grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <StatCard idx={0} emoji="💰" label="Savings rate" value={formatPercent(s.savingsRate)} sub="of income saved" accent={s.savingsRate >= 0.2 ? "#22c55e" : s.savingsRate >= 0.1 ? "#eab308" : "#ef4444"} />
              <StatCard idx={1} emoji="🧾" label="Transactions" value={s.txnCount.toLocaleString()} sub={`across ${s.periodCount} periods`} />
              {s.topCat && (
                <StatCard idx={2} emoji="📦" label="Biggest category" value={s.topCat[0].charAt(0).toUpperCase() + s.topCat[0].slice(1)} sub={`${formatMoney(s.topCat[1])} total`} />
              )}
              {s.bestPeriod && (
                <StatCard idx={3} emoji="🏆" label="Best period" value={s.bestPeriod.label} sub={`${formatMoney(s.bestPeriod.leftover)} left over`} accent="#22c55e" />
              )}
              {s.completedGoals > 0 && (
                <StatCard idx={4} emoji="🎯" label="Goals reached" value={`${s.completedGoals}`} sub="fully funded this year" accent="var(--vn-primary)" />
              )}
              {s.streak > 0 && (
                <StatCard idx={5} emoji="🔥" label="Saving streak" value={`${s.streak} period${s.streak !== 1 ? "s" : ""}`} sub="consecutive periods with savings" accent="#f97316" />
              )}
            </div>

            {/* Top merchants */}
            {s.topMerchants.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, type: "spring", damping: 22 }}
                className="vn-card p-5"
              >
                <div className="text-sm font-semibold text-[var(--vn-text)] mb-4">Top 5 where you spent</div>
                <div className="space-y-3">
                  {s.topMerchants.map(([label, amount], i) => {
                    const pct = s.spending > 0 ? amount / s.spending : 0;
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-xs text-[var(--vn-muted)] w-4 text-right shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-[var(--vn-text)] truncate">{label}</span>
                            <span className="text-sm font-semibold text-[var(--vn-text)] ml-2 shrink-0">{formatMoney(amount)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[var(--vn-border)]">
                            <div
                              className="h-1.5 rounded-full"
                              style={{ width: `${Math.round(pct * 100)}%`, background: "var(--vn-primary, var(--gold))" }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-[var(--vn-muted)] w-10 text-right shrink-0">{Math.round(pct * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
