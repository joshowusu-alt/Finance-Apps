"use client";

import { useMemo, useState } from "react";
import { loadPlan } from "@/lib/storage";
import { formatMoney, getCurrencySymbol } from "@/lib/currency";
import { formatPercent } from "@/lib/formatUtils";
import SidebarNav from "@/components/SidebarNav";
import { motion } from "framer-motion";
import type { Plan } from "@/data/plan";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";
import { CategoryBreakdownChart } from "@/components/charts";
import { formatMoney as fmtChart } from "@/lib/currency";

// ── helpers ──────────────────────────────────────────────────────────────────

const tooltipStyle = {
  background: "var(--vn-surface)",
  border: "1px solid var(--vn-border)",
  borderRadius: "12px",
  color: "var(--vn-text)",
  fontSize: 12,
};

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

  // Category chart data
  const categoryChartData = Object.entries(catTotals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  // Top 5 merchants by spend
  const merchantTotals: Record<string, number> = {};
  for (const t of txns.filter((t) => t.type === "outflow")) {
    merchantTotals[t.label] = (merchantTotals[t.label] ?? 0) + t.amount;
  }
  const topMerchants = Object.entries(merchantTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Per-period breakdown
  const periods = plan.periods
    .filter((p) => p.start.startsWith(year) || p.end.startsWith(year))
    .sort((a, b) => a.start.localeCompare(b.start));

  const periodStats = periods.map((p) => {
    const pIncome = txns.filter((t) => t.type === "income" && t.date >= p.start && t.date <= p.end).reduce((s, t) => s + t.amount, 0);
    const pSpend = txns.filter((t) => t.type === "outflow" && t.date >= p.start && t.date <= p.end).reduce((s, t) => s + t.amount, 0);
    const pSave = txns.filter((t) => t.category === "savings" && t.date >= p.start && t.date <= p.end).reduce((s, t) => s + t.amount, 0);
    return { label: p.label, pIncome, pSpend, pSave, leftover: pIncome - pSpend };
  });

  const sorted = [...periodStats].sort((a, b) => b.leftover - a.leftover);
  const bestPeriod = sorted[0] ?? null;
  const worstPeriod = sorted[sorted.length - 1] ?? null;

  // Goals completed
  const completedGoals = (plan.savingsGoals ?? []).filter(
    (g) => g.currentAmount >= g.targetAmount
  ).length;

  // Saving streak
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
    income, spending, savings, savingsRate, topCat, categoryChartData,
    topMerchants, bestPeriod, worstPeriod, completedGoals, streak,
    txnCount: txns.length, periodCount: periods.length, periodStats,
  };
}

// ── card component ────────────────────────────────────────────────────────────

function StatCard({
  idx, emoji, label, value, sub, accent,
}: {
  idx: number; emoji: string; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.07, type: "spring", damping: 22, stiffness: 200 }}
      className="vn-card p-5 flex flex-col gap-1"
    >
      <div className="text-2xl">{emoji}</div>
      <div className="text-xs uppercase tracking-wide text-(--vn-muted) mt-1">{label}</div>
      <div className="text-xl font-bold mt-0.5" style={{ color: accent ?? "var(--vn-text)" }}>
        {value}
      </div>
      {sub && <div className="text-xs text-(--vn-muted)">{sub}</div>}
    </motion.div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function YearInReviewPage() {
  const plan = useMemo(() => loadPlan(), []);

  const years = useMemo(() => {
    const ys = new Set(plan.transactions.map((t) => t.date.slice(0, 4)));
    return Array.from(ys).sort().reverse();
  }, [plan]);

  const currentYear = new Date().getFullYear().toString();
  const [year, setYear] = useState(years[0] ?? currentYear);
  const s = useMemo(() => computeYearStats(plan, year), [plan, year]);
  // suppress unused import warning
  void getCurrencySymbol;
  void fmtChart;

  const leftover = s.income - s.spending;
  const hasData = s.txnCount > 0;

  return (
    <main className="flex min-h-screen w-full max-w-full overflow-x-hidden" style={{ background: "var(--vn-bg)" }}>
      <SidebarNav />
      <div className="flex-1 max-w-3xl mx-auto px-4 py-8 pb-28">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
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
          <p className="text-sm text-(--vn-muted) mt-1">
            {hasData
              ? `${s.txnCount} transactions across ${s.periodCount} period${s.periodCount !== 1 ? "s" : ""}`
              : "No transaction data for this year yet."}
          </p>
        </motion.div>

        {!hasData ? (
          <div className="vn-card p-10 text-center">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-(--vn-muted) text-sm">
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
              <div className="text-xs uppercase tracking-widest text-(--vn-muted) mb-2">Total income {year}</div>
              <div className="text-5xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "var(--gold, #d4a82a)" }}>
                {formatMoney(s.income)}
              </div>
              <div className="mt-3 flex items-center justify-center gap-6 text-sm text-(--vn-muted) flex-wrap">
                <span>Spent <span className="font-semibold text-(--vn-text)">{formatMoney(s.spending)}</span></span>
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
              {s.worstPeriod && s.worstPeriod.label !== s.bestPeriod?.label && (
                <StatCard idx={4} emoji="📉" label="Tightest period" value={s.worstPeriod.label} sub={`${formatMoney(s.worstPeriod.leftover)} left over`} accent="#f43f5e" />
              )}
              {s.completedGoals > 0 && (
                <StatCard idx={5} emoji="🎯" label="Goals reached" value={`${s.completedGoals}`} sub="fully funded this year" accent="var(--vn-primary)" />
              )}
              {s.streak > 0 && (
                <StatCard idx={6} emoji="🔥" label="Saving streak" value={`${s.streak} period${s.streak !== 1 ? "s" : ""}`} sub="consecutive periods with savings" accent="#f97316" />
              )}
            </div>

            {/* Period-by-period income vs spending bar chart */}
            {s.periodStats.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, type: "spring", damping: 22 }}
                className="vn-card p-5 mb-6"
              >
                <div className="text-sm font-semibold text-(--vn-text) mb-1">Period breakdown</div>
                <div className="text-xs text-(--vn-muted) mb-4">Income vs spending per period</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={s.periodStats} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--vn-border)" strokeOpacity={0.5} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--vn-muted)" }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tickFormatter={(v: number) => formatMoney(v)} tick={{ fontSize: 10, fill: "var(--vn-muted)" }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip
                      formatter={(value: number | undefined, name: string | undefined) => [formatMoney(value ?? 0), name ?? ""]}
                      contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="pIncome" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="pSpend" name="Spending" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="pSave" name="Saved" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 justify-center">
                  {[{color:"#22c55e",label:"Income"},{color:"#f43f5e",label:"Spending"},{color:"#6366f1",label:"Saved"}].map(({color,label}) => (
                    <span key={label} className="flex items-center gap-1 text-[10px] text-(--vn-muted)">
                      <span className="inline-block w-3 h-3 rounded-sm" style={{background:color}} />
                      {label}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Savings rate per period */}
            {s.periodStats.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, type: "spring", damping: 22 }}
                className="vn-card p-5 mb-6"
              >
                <div className="text-sm font-semibold text-(--vn-text) mb-1">Savings rate per period</div>
                <div className="text-xs text-(--vn-muted) mb-4">% of income saved each period</div>
                <div className="space-y-2">
                  {s.periodStats.map((p) => {
                    const rate = p.pIncome > 0 ? p.pSave / p.pIncome : 0;
                    const pct = Math.round(rate * 100);
                    const color = rate >= 0.2 ? "#22c55e" : rate >= 0.1 ? "#eab308" : "#f43f5e";
                    return (
                      <div key={p.label} className="flex items-center gap-3">
                        <span className="text-xs text-(--vn-muted) w-20 shrink-0 truncate">{p.label}</span>
                        <div className="flex-1 h-2 rounded-full" style={{ background: "var(--vn-border)" }}>
                          <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                        </div>
                        <span className="text-xs font-semibold w-10 text-right shrink-0" style={{ color }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Category breakdown chart */}
            {s.categoryChartData.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, type: "spring", damping: 22 }}
                className="vn-card p-5 mb-6"
              >
                <div className="text-sm font-semibold text-(--vn-text) mb-1">Spending by category</div>
                <div className="text-xs text-(--vn-muted) mb-4">Where your money went in {year}</div>
                <CategoryBreakdownChart data={s.categoryChartData} height={240} />
              </motion.div>
            )}

            {/* Top merchants */}
            {s.topMerchants.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, type: "spring", damping: 22 }}
                className="vn-card p-5"
              >
                <div className="text-sm font-semibold text-(--vn-text) mb-4">Top 5 where you spent</div>
                <div className="space-y-3">
                  {s.topMerchants.map(([label, amount], i) => {
                    const pct = s.spending > 0 ? amount / s.spending : 0;
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-xs text-(--vn-muted) w-4 text-right shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-(--vn-text) truncate">{label}</span>
                            <span className="text-sm font-semibold text-(--vn-text) ml-2 shrink-0">{formatMoney(amount)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-(--vn-border)">
                            <div
                              className="h-1.5 rounded-full"
                              style={{ width: `${Math.round(pct * 100)}%`, background: "var(--vn-primary, var(--gold))" }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-(--vn-muted) w-10 text-right shrink-0">{Math.round(pct * 100)}%</span>
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
