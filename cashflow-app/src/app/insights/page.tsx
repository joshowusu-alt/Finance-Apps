"use client";

import { useMemo, useState, type ReactNode } from "react";
import { loadPlan } from "@/lib/storage";
import { formatMoney } from "@/lib/currency";
import { clamp } from "@/lib/dateUtils";
import { downloadPlanPdf } from "@/lib/planIo";
import { buildInsightsSnapshot } from "@/lib/insightsSnapshot";
import { downloadInsightsCsv, downloadInsightsPdf } from "@/lib/insightsExport";
import SidebarNav from "@/components/SidebarNav";
import { CategoryBreakdownChart, SpendingTrendChart } from "@/components/charts";
import { CategoryDrilldown } from "@/components/CategoryDrilldown";
import SpendingCalendarHeatmap from "@/components/SpendingCalendarHeatmap";
import type { Plan } from "@/data/plan";
import InsightsPanel from "@/components/InsightsPanel";
import SubscriptionDashboard from "@/components/SubscriptionDashboard";
import InfoTooltip from "@/components/InfoTooltip";
import { useDerived } from "@/lib/useDerived";
import { prettyDate, formatPercent } from "@/lib/formatUtils";

function formatDelta(value: number) {
  if (value === 0) return "0";
  const sign = value > 0 ? "+" : "-";
  return `${sign}${formatMoney(Math.abs(value))}`;
}



function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="vn-card p-6">
      <div className="text-xs uppercase tracking-wide text-(--vn-muted)">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-(--vn-text)">{value}</div>
      {hint ? <div className="mt-1 text-xs text-(--vn-muted)">{hint}</div> : null}
    </div>
  );
}

function ProgressBar({
  label,
  value,
  total,
  tone,
  hint,
  barColor,
}: {
  label: string;
  value: number;
  total: number;
  tone?: "good" | "warn" | "bad";
  hint?: string;
  barColor?: string;
}) {
  const pct = total > 0 ? clamp(value / total, 0, 1) : 0;
  const defaultColor =
    tone === "good"
      ? "#22c55e"
      : tone === "bad"
        ? "#ef4444"
        : "#eab308";
  const color = barColor || defaultColor;
  return (
    <div className="rounded-2xl bg-(--vn-surface) p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs text-(--vn-muted)">
        <span>{label}</span>
        <span className="font-semibold text-(--vn-muted)">{formatPercent(pct)}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-(--vn-border)">
        <div className="h-2 rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
      {hint ? <div className="mt-2 text-xs text-(--vn-muted)">{hint}</div> : null}
    </div>
  );
}

function lastValue(values: number[]) {
  return values.length ? values[values.length - 1] : 0;
}

function deltaValue(values: number[]) {
  if (values.length < 2) return 0;
  return values[values.length - 1] - values[values.length - 2];
}

function periodLabelAt(periods: Plan["periods"], idx: number) {
  if (idx < 0 || idx >= periods.length) return "Unknown";
  return periods[idx]?.label ?? `P${idx + 1}`;
}

function Sparkline({
  values,
  stroke,
  fill,
}: {
  values: number[];
  stroke: string;
  fill: string;
}) {
  if (values.length === 0) return null;
  const width = 120;
  const height = 36;
  const padding = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = values.map((value, idx) => {
    const x =
      padding + (values.length === 1 ? 0 : (idx / (values.length - 1)) * (width - padding * 2));
    const y = padding + (1 - (value - min) / range) * (height - padding * 2);
    return { x, y };
  });
  const points = coords.map((pt) => `${pt.x},${pt.y}`).join(" ");
  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend chart">
      <polygon points={areaPoints} fill={fill} opacity={0.2} />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function CollapsibleSection({
  id,
  title,
  defaultOpen = false,
  children,
}: {
  id?: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="vn-card p-6">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-(--vn-text)">{title}</span>
        <span className="text-xs text-(--vn-muted)">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export default function InsightsPage() {
  const [basePeriodId, setBasePeriodId] = useState<number>(() => loadPlan().setup.selectedPeriodId);
  const { state: plan, derived: derivedForPeriod } = useDerived(basePeriodId);
  const [comparePeriodId, setComparePeriodId] = useState<"auto" | number | null>("auto");
  const [showFullInsights, setShowFullInsights] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= 768
  );
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);

  const snapshot = useMemo(
    () => buildInsightsSnapshot(plan, basePeriodId, comparePeriodId),
    [plan, basePeriodId, comparePeriodId]
  );

  const {
    sortedPeriods,
    baseStats,
    compareStats,
    basePeriod,
    endBalance,
    lowestPoint,
    riskDays,
    firstRisk,
    periodDays,
    daysElapsed,
    timeProgress,
    incomeProgress,
    spendingProgress,
    savingsProgress,
    projectedLeftover,
    forecastScenarios,
    varianceByCategory,
    overspentCategories,
    variableSpend,
    variableDelta,
    overspendItems,
    billVariance,
    merchantRows,
    categoryChanges,
    labelChanges,
    incomeSourceChanges,
    incomeAverage,
    incomeVolatility,
    stabilityScore,
    hasIncomeData,
    incomeSplit,
    savingsRate,
    savingsStreak,
    recommendations,
    categoryChartData,
    periodTrendData,
    seriesCards,
    scorecards,
    periodHighlights,
  } = snapshot;

  const drilldownTxns = useMemo(() => {
    if (!drilldownCategory || !basePeriod) return [];
    return plan.transactions.filter(t =>
      t.type === "outflow" && t.category === drilldownCategory &&
      t.date >= basePeriod.start && t.date <= basePeriod.end
    );
  }, [drilldownCategory, plan.transactions, basePeriod]);

  const drilldownBudget = useMemo(() =>
    varianceByCategory[drilldownCategory as keyof typeof varianceByCategory]?.budgeted,
    [drilldownCategory, varianceByCategory]
  );

  const derivedHealth = derivedForPeriod.health;
  const derivedIncomeStability = derivedForPeriod.incomeStability;
  const derivedSavings = derivedForPeriod.savingsHealth;
  const derivedLowest = derivedForPeriod.cashflow.lowest;
  const derivedRiskDays = derivedForPeriod.cashflow.daysBelowMin;
  const firstBelowMin = derivedForPeriod.cashflow.daily.find((day) => day.belowMin);

  const incomePeak = periodHighlights.incomePeak;
  const spendingPeak = periodHighlights.spendingPeak;
  const bestLeftover = periodHighlights.bestLeftover;
  const worstLeftover = periodHighlights.worstLeftover;

  const paceDelta = spendingProgress - timeProgress;
  const paceStatus =
    paceDelta > 0.08 ? "Spending high" : paceDelta < -0.08 ? "Under budget" : "On track";
  const paceTone =
    paceDelta > 0.08 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400";

  // Cross-period variance table data
  const crossPeriodVariance = useMemo(() => {
    if (sortedPeriods.length < 2) return null;
    const txns = plan.transactions || [];
    const categories = ["bill", "savings", "giving", "allowance", "buffer", "other"] as const;

    // For each period, sum spend per category
    const periodData = sortedPeriods.map(period => {
      const periodTxns = txns.filter(t =>
        t.type === "outflow" && t.date >= period.start && t.date <= period.end
      );
      const byCategory: Record<string, number> = {};
      for (const cat of categories) byCategory[cat] = 0;
      for (const t of periodTxns) {
        if (categories.includes(t.category as typeof categories[number])) {
          byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
        }
      }
      return { period, byCategory };
    });

    // Compute max per category for heat-map scaling
    const maxPerCat: Record<string, number> = {};
    for (const cat of categories) {
      maxPerCat[cat] = Math.max(...periodData.map(p => p.byCategory[cat] || 0));
    }

    // Only include categories where at least one period has data
    const activeCategories = categories.filter(cat => maxPerCat[cat] > 0);

    return { periodData, maxPerCat, activeCategories };
  }, [sortedPeriods, plan.transactions]);

  // Per-period savings rate series for the trend chart
  const savingsRateSeries = useMemo(() => {
    return sortedPeriods.map(p => {
      const income = plan.transactions
        .filter(t => t.type === "income" && t.date >= p.start && t.date <= p.end)
        .reduce((s, t) => s + t.amount, 0);
      const savings = plan.transactions
        .filter(t => t.category === "savings" && t.date >= p.start && t.date <= p.end)
        .reduce((s, t) => s + t.amount, 0);
      return income > 0 ? savings / income : 0;
    });
  }, [plan.transactions, sortedPeriods]);

  function handleExportInsightsCsv() {
    downloadInsightsCsv(snapshot, derivedForPeriod);
  }

  function handleDownloadInsightsPdf() {
    downloadInsightsPdf(snapshot, derivedForPeriod);
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-40 pt-5">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={basePeriod.label} periodStart={basePeriod.start} periodEnd={basePeriod.end} />

          <section className="space-y-6 min-w-0 w-full">
            <header className="vn-masthead">
              <div className="text-xs uppercase tracking-widest font-semibold text-white/50">Insights</div>
              <h1 className="text-2xl font-bold text-white/90" style={{ fontFamily: "var(--font-playfair, serif)" }}>Insights</h1>
              <p className="mt-2 text-sm text-white/55">
                Answers to the questions you normally ask about the period.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/60">
                <div className="flex items-center gap-2">
                  <span>Base period</span>
                  <select
                    value={basePeriodId}
                    onChange={(e) => setBasePeriodId(Number(e.target.value))}
                    className="rounded-lg px-2 py-1 text-xs"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(240,237,232,0.85)" }}
                  >
                    {sortedPeriods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span>Compare to</span>
                  <select
                    value={comparePeriodId === "auto" ? "auto" : comparePeriodId ?? ""}
                    onChange={(e) =>
                      setComparePeriodId(
                        e.target.value === "auto"
                          ? "auto"
                          : e.target.value
                            ? Number(e.target.value)
                            : null
                      )
                    }
                    className="rounded-lg px-2 py-1 text-xs"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(240,237,232,0.85)" }}
                  >
                    <option value="auto">Auto (previous)</option>
                    <option value="">None</option>
                    {sortedPeriods
                      .filter((p) => p.id !== basePeriod.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleExportInsightsCsv}
                    className="rounded-lg px-3 py-1.5 text-xs min-h-10 font-semibold transition-colors hover:opacity-90"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(240,237,232,0.8)" }}
                  >
                    Export insights (CSV)
                  </button>
                  <button
                    onClick={handleDownloadInsightsPdf}
                    className="rounded-lg px-3 py-1.5 text-xs min-h-10 font-semibold transition-colors hover:opacity-90"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(240,237,232,0.8)" }}
                  >
                    Download insights report (PDF)
                  </button>
                  <button
                    onClick={() => downloadPlanPdf(plan, baseStats.period.id)}
                    className="rounded-lg px-3 py-1.5 text-xs min-h-10 font-semibold transition-colors hover:opacity-90"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(240,237,232,0.8)" }}
                  >
                    Download plan report (PDF)
                  </button>
                </div>
              </div>
            </header>

            <section className="vn-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Quick pulse</div>
                  <div className="text-sm font-semibold text-(--vn-text)">Key insights at a glance</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFullInsights((prev) => !prev)}
                  className="rounded-lg border border-(--vn-border) bg-(--vn-surface) px-3 py-1.5 text-xs min-h-10 font-semibold text-(--vn-muted) hover:opacity-80"
                  aria-expanded={showFullInsights}
                >
                  {showFullInsights ? "Hide details" : "See more"}
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-(--vn-muted)">On track</div>
                  <div className={`mt-2 text-lg font-semibold ${paceTone}`}>{paceStatus}</div>
                  <div className="mt-1 text-xs text-(--vn-muted)">
                    {formatPercent(spendingProgress)} of budget vs {formatPercent(timeProgress)} time
                  </div>
                </div>
                <div className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Lowest point</div>
                  <div className="mt-2 text-lg font-semibold text-(--vn-text)">
                    {derivedLowest ? formatMoney(derivedLowest.balance) : "N/A"}
                  </div>
                  <div className="mt-1 text-xs text-(--vn-muted)">
                    {derivedLowest ? `on ${prettyDate(derivedLowest.date)}` : "No forecast yet"}
                  </div>
                </div>
                <div className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Risk days</div>
                  <div className="mt-2 text-lg font-semibold text-(--vn-text)">
                    {derivedRiskDays === 0 ? "None" : `${derivedRiskDays} day${derivedRiskDays === 1 ? "" : "s"}`}
                  </div>
                  <div className="mt-1 text-xs text-(--vn-muted)">
                    {derivedRiskDays === 0 ? "Balance stays above minimum" : `First risk ${prettyDate(firstBelowMin?.date)}`}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Health</div>
                  <div className="mt-2 text-lg font-semibold text-(--vn-text)">{derivedHealth.label}</div>
                  <div className="mt-1 text-xs text-(--vn-muted)">{derivedHealth.reason}</div>
                </div>
                <div className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Income stability</div>
                  <div className="mt-2 text-lg font-semibold text-(--vn-text)">{derivedIncomeStability.label}</div>
                  <div className="mt-1 text-xs text-(--vn-muted)">{derivedIncomeStability.explanation}</div>
                </div>
                <div className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Savings streak</div>
                  <div className="mt-2 text-lg font-semibold text-(--vn-text)">
                    {derivedSavings.streak} period{derivedSavings.streak === 1 ? "" : "s"}
                  </div>
                  <div className="mt-1 text-xs text-(--vn-muted)">{derivedSavings.streakExplanation}</div>
                </div>
                <div className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-(--vn-muted)">{derivedSavings.leftoverLabel}</div>
                  <div className="mt-2 text-lg font-semibold text-(--vn-text)">
                    {formatMoney(derivedSavings.leftoverValue)}
                  </div>
                  <div className="mt-1 text-xs text-(--vn-muted)">{derivedSavings.explanation}</div>
                </div>
              </div>
            </section>

            {showFullInsights && (
              <>
                {/* ── Quick-jump sticky nav ─────────────────────────────────── */}
                <nav
                  aria-label="Insights sections"
                  className="sticky top-0 z-20 -mx-4 px-4 py-2 overflow-x-auto scroll-x-hide"
                  style={{
                    background: "var(--vn-bg)",
                    borderBottom: "1px solid var(--vn-border)",
                    scrollbarWidth: "none",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <div className="flex gap-2 min-w-max">
                    {([
                      { id: "s-coach",       label: "Coach" },
                      { id: "s-on-track",   label: "On Track" },
                      { id: "s-changes",    label: "Changes" },
                      { id: "s-overspend",  label: "Overspending" },
                      { id: "s-income",     label: "Income" },
                      { id: "s-savings",    label: "Savings" },
                      { id: "s-next",       label: "Next Steps" },
                      { id: "s-compare",    label: "Periods" },
                    ] as const).map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          const el = document.getElementById(id);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className="rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors hover:bg-(--vn-primary)/10 hover:text-(--vn-primary) text-(--vn-muted)"
                        style={{ minHeight: 32 }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </nav>

                {/* AI Coach — proactive nudges */}
                <CollapsibleSection id="s-coach" title="AI Coach" defaultOpen>
                  <div className="space-y-3">
                    {recommendations.map((tip, i) => {
                      const isGood = tip.toLowerCase().includes("on track") || tip.toLowerCase().includes("keep");
                      const isWarn = tip.toLowerCase().includes("behind") || tip.toLowerCase().includes("dips");
                      return (
                        <div key={i} className={`flex items-start gap-3 rounded-xl p-3 ${
                          isGood
                            ? "bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800"
                            : isWarn
                            ? "bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800"
                            : "bg-rose-50 dark:bg-rose-900/15 border border-rose-200 dark:border-rose-800"
                        }`}>
                          <span className="text-base mt-0.5 shrink-0">
                            {isGood ? "✓" : isWarn ? "⚠" : "↑"}
                          </span>
                          <span className={`text-sm leading-snug ${
                            isGood
                              ? "text-emerald-800 dark:text-emerald-200"
                              : isWarn
                              ? "text-amber-800 dark:text-amber-200"
                              : "text-rose-800 dark:text-rose-200"
                          }`}>{tip}</span>
                        </div>
                      );
                    })}
                  </div>
                  {overspentCategories.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-(--vn-border)">
                      <div className="text-xs font-semibold uppercase tracking-wide text-(--vn-muted) mb-2">Over-budget categories</div>
                      <div className="space-y-1.5">
                        {overspentCategories.map(cat => (
                          <div key={cat.category} className="flex items-center justify-between text-xs">
                            <span className="capitalize text-(--vn-muted)">{cat.category}</span>
                            <span className="font-semibold text-rose-600 dark:text-rose-400">+{formatMoney(cat.actual - cat.budgeted)} over</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CollapsibleSection>

                {/* Proactive Insights Panel */}
                <InsightsPanel />

                <SubscriptionDashboard
                  transactions={plan.transactions}
                  asOfDate={plan.setup.asOfDate}
                />

                <CollapsibleSection id="s-on-track" title="1) Am I on track?" defaultOpen>
                  {/* Budget vs Actual Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    {([
                      { label: "Income", budget: baseStats.budgetIncome, actual: baseStats.actualIncome, favorableWhenOver: true },
                      { label: "Spending", budget: baseStats.budgetSpending, actual: baseStats.actualSpending, favorableWhenOver: false },
                      { label: "Savings", budget: baseStats.budgetSavings, actual: baseStats.actualSavings, favorableWhenOver: true },
                      { label: "Leftover", budget: baseStats.budgetLeftover, actual: baseStats.actualLeftover, favorableWhenOver: true },
                    ] as const).map((card) => {
                      const delta = card.actual - card.budget;
                      const favorable = card.favorableWhenOver ? delta >= 0 : delta <= 0;
                      return (
                        <div key={card.label} className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4 shadow-sm">
                          <div className="text-xs font-semibold uppercase tracking-wide text-(--vn-muted)">{card.label}</div>
                          <div className="mt-1 text-[11px] text-(--vn-muted)">Budget {formatMoney(card.budget)}</div>
                          <div className="mt-1 text-xl font-semibold text-(--vn-text)">{formatMoney(card.actual)}</div>
                          {delta !== 0 && (
                            <div className={`mt-1 text-xs font-semibold ${favorable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {delta > 0 ? "+" : ""}{formatMoney(delta)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Category Variance Breakdown */}
                  {Object.values(varianceByCategory).filter(Boolean).length > 0 && (
                    <div className="mb-4 rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-(--vn-muted) mb-3">Variance by category</div>
                      <div className="space-y-2">
                        {Object.values(varianceByCategory)
                          .filter(Boolean)
                          .sort((a, b) => Math.abs(b!.variance) - Math.abs(a!.variance))
                          .map((v) => {
                            if (!v) return null;
                            const isIncome = v.category === "income";
                            const overBudget = v.actual > v.budgeted;
                            const favorable = isIncome ? overBudget : !overBudget;
                            return (
                              <div key={v.category} className="flex items-center justify-between text-sm">
                                <span className="capitalize text-(--vn-muted)">{v.category}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-(--vn-muted)">
                                    {formatMoney(v.budgeted)} &rarr; {formatMoney(v.actual)}
                                  </span>
                                  <span className={`text-xs font-semibold min-w-16 text-right ${favorable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                    {overBudget ? "+" : "-"}{formatMoney(Math.abs(v.variance))}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <ProgressBar
                      label="Time into period"
                      value={daysElapsed}
                      total={periodDays}
                      barColor="#0f172a"
                      hint={`Day ${daysElapsed} of ${periodDays}`}
                    />
                    <ProgressBar
                      label="Income pace"
                      value={baseStats.actualIncome}
                      total={baseStats.budgetIncome}
                      barColor={incomeProgress >= timeProgress ? "#22c55e" : "#eab308"}
                      hint={`Actual ${formatMoney(baseStats.actualIncome)} vs budget ${formatMoney(baseStats.budgetIncome)}`}
                    />
                    <ProgressBar
                      label="Spending pace"
                      value={baseStats.actualSpending}
                      total={baseStats.budgetSpending}
                      barColor={spendingProgress <= timeProgress ? "#f97316" : "#ef4444"}
                      hint={`Actual ${formatMoney(baseStats.actualSpending)} vs budget ${formatMoney(baseStats.budgetSpending)}`}
                    />
                    <ProgressBar
                      label="Savings pace"
                      value={baseStats.actualSavings}
                      total={baseStats.budgetSavings}
                      barColor={savingsProgress >= timeProgress ? "#a855f7" : "#eab308"}
                      hint={`Actual ${formatMoney(baseStats.actualSavings)} vs target ${formatMoney(baseStats.budgetSavings)}`}
                    />
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-(--vn-surface) p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Forecast end balance</div>
                      <div className="mt-2 text-xl font-semibold text-(--vn-text)">{formatMoney(endBalance)}</div>
                      <div className="mt-1 text-xs text-(--vn-muted)">
                        Lowest point {derivedLowest ? formatMoney(derivedLowest.balance) : "N/A"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-(--vn-surface) p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Risk days</div>
                      <div className="mt-2 text-xl font-semibold text-(--vn-text)">
                        {derivedRiskDays === 0 ? "None" : `${derivedRiskDays} day${derivedRiskDays === 1 ? "" : "s"}`}
                      </div>
                      <div className="mt-1 text-xs text-(--vn-muted)">
                        {firstBelowMin ? `First risk on ${prettyDate(firstBelowMin.date)}` : "Above safe minimum"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-(--vn-surface) p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Projected leftover</div>
                      <div className="mt-2 text-xl font-semibold text-(--vn-text)">
                        {formatDelta(projectedLeftover)}
                      </div>
                      <div className="mt-1 text-xs text-(--vn-muted)">
                        Based on current pace
                      </div>
                    </div>
                    <div className="rounded-2xl bg-(--vn-surface) p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-(--vn-muted) flex items-center">
                        Safe minimum
                        <InfoTooltip text="Your minimum safe balance. Any day the forecast dips below this is flagged as risk." />
                      </div>
                      <div className="mt-2 text-xl font-semibold text-(--vn-text)">
                        {plan.setup.expectedMinBalance > 0
                          ? formatMoney(plan.setup.expectedMinBalance)
                          : "Not set"}
                      </div>
                      <div className="mt-1 text-xs text-(--vn-muted)">
                        {plan.setup.expectedMinBalance > 0
                          ? (derivedLowest && derivedLowest.balance < plan.setup.expectedMinBalance
                            ? "Below minimum"
                            : "On track")
                          : "Set a minimum in Settings to flag risky days"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Forecast scenarios</div>
                    <div className="mt-3 grid gap-4 md:grid-cols-3">
                      {forecastScenarios.map((scenario) => {
                        const tone =
                          scenario.bufferDelta >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-rose-600 dark:text-rose-400";
                        return (
                          <div
                            key={scenario.id}
                            className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4"
                          >
                            <div className="text-sm font-semibold text-(--vn-text)">{scenario.label}</div>
                            <div className="mt-2 text-xs text-(--vn-muted)">{scenario.note}</div>
                            <div className="mt-3 text-xs uppercase tracking-wide text-(--vn-muted)">Projected leftover</div>
                            <div className="mt-1 text-lg font-semibold text-(--vn-text)">
                              {formatMoney(scenario.leftover)}
                            </div>
                            <div className="mt-2 text-xs uppercase tracking-wide text-(--vn-muted)">End balance</div>
                            <div className={`mt-1 text-sm font-semibold ${tone}`}>
                              {formatMoney(scenario.endBalance)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="s-changes" title="2) What changed vs last period?">
                  {compareStats ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl bg-(--vn-surface) p-4 shadow-sm">
                          <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Income change</div>
                          <div className="mt-2 text-xl font-semibold text-(--vn-text)">
                            {formatDelta(baseStats.actualIncome - compareStats.actualIncome)}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-(--vn-surface) p-4 shadow-sm">
                          <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Spending change</div>
                          <div className="mt-2 text-xl font-semibold text-(--vn-text)">
                            {formatDelta(baseStats.actualSpending - compareStats.actualSpending)}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-(--vn-surface) p-4 shadow-sm">
                          <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Savings change</div>
                          <div className="mt-2 text-xl font-semibold text-(--vn-text)">
                            {formatDelta(baseStats.actualSavings - compareStats.actualSavings)}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-(--vn-surface) p-4 shadow-sm">
                          <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Leftover change</div>
                          <div className="mt-2 text-xl font-semibold text-(--vn-text)">
                            {formatDelta(baseStats.actualLeftover - compareStats.actualLeftover)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4">
                          <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Top category changes</div>
                          <div className="mt-2 space-y-2 text-sm text-(--vn-muted)">
                            {categoryChanges.length === 0 ? (
                              <div className="text-(--vn-muted)">No category changes.</div>
                            ) : (
                              categoryChanges.map((item) => (
                                <div key={item.category} className="flex items-center justify-between">
                                  <span className="capitalize">{item.category}</span>
                                  <span className="font-semibold text-(--vn-text)">{formatDelta(item.delta)}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4">
                          <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Top merchant changes</div>
                          <div className="mt-2 space-y-2 text-sm text-(--vn-muted)">
                            {labelChanges.length === 0 ? (
                              <div className="text-(--vn-muted)">No merchant changes.</div>
                            ) : (
                              labelChanges.map((item) => (
                                <div key={item.label} className="flex items-center justify-between">
                                  <span>{item.label}</span>
                                  <span className="font-semibold text-(--vn-text)">{formatDelta(item.delta)}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {incomeSourceChanges ? (
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4">
                            <div className="text-xs uppercase tracking-wide text-(--vn-muted)">New income sources</div>
                            <div className="mt-2 space-y-1 text-sm text-(--vn-muted)">
                              {incomeSourceChanges.newSources.length === 0
                                ? <div className="text-(--vn-muted)">None this period.</div>
                                : incomeSourceChanges.newSources.map((source) => (
                                  <div key={source}>{source}</div>
                                ))}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4">
                            <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Missing income sources</div>
                            <div className="mt-2 space-y-1 text-sm text-(--vn-muted)">
                              {incomeSourceChanges.missingSources.length === 0
                                ? <div className="text-(--vn-muted)">None missing.</div>
                                : incomeSourceChanges.missingSources.map((source) => (
                                  <div key={source}>{source}</div>
                                ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="text-sm text-(--vn-muted)">Select a comparison period to see changes.</div>
                  )}
                </CollapsibleSection>

                <CollapsibleSection id="s-overspend" title="3) Where am I overspending?">
                  {categoryChartData.length > 0 && (
                    <div className="mb-6 rounded-2xl bg-(--vn-surface) p-6 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-(--vn-muted) mb-4">Spending by category</div>
                      <CategoryBreakdownChart data={categoryChartData} height={320} onCategoryClick={(name) => setDrilldownCategory(name.toLowerCase())} />
                    </div>
                  )}

                  {/* Spending calendar heat-map */}
                  <div className="mb-6 rounded-2xl bg-(--vn-surface) p-6 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-(--vn-muted) mb-4">Daily spend heat-map</div>
                    <SpendingCalendarHeatmap
                      transactions={plan.transactions}
                      periodStart={basePeriod.start}
                      periodEnd={basePeriod.end}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-(--vn-surface) p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-(--vn-muted) flex items-center">Variable cap<InfoTooltip text="Your budgeted limit for flexible spending each period. Anything above this means you're overspending on non-fixed expenses." /></div>
                      <div className="mt-2 text-xl font-semibold text-(--vn-text)">
                        {formatMoney(plan.setup.variableCap)}
                      </div>
                      <div className="mt-1 text-xs text-(--vn-muted)">
                        Actual {formatMoney(variableSpend)} ({formatDelta(variableDelta)})
                      </div>
                    </div>
                    <div className="rounded-2xl bg-(--vn-surface) p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Top overspent categories</div>
                      <div className="mt-2 space-y-2 text-sm text-(--vn-muted)">
                        {overspentCategories.length === 0 ? (
                          <div className="text-(--vn-muted)">No categories over budget.</div>
                        ) : (
                          overspentCategories.slice(0, 4).map((cat) => (
                            <div key={cat.category} className="flex items-center justify-between">
                              <span className="capitalize">{cat.category}</span>
                              <span className="font-semibold text-(--vn-text)">{formatDelta(cat.variance)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4">
                    <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Biggest overspend items</div>
                    <div className="mt-2 space-y-2 text-sm text-(--vn-muted)">
                      {overspendItems.length === 0 ? (
                        <div className="text-(--vn-muted)">No overspend items.</div>
                      ) : (
                        overspendItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <span>{item.label}</span>
                            <span className="font-semibold text-(--vn-text)">{formatMoney(item.amount)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4">
                      <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Budget variance by bill</div>
                      <div className="mt-2 space-y-2 text-sm text-(--vn-muted)">
                        {billVariance.length === 0 ? (
                          <div className="text-(--vn-muted)">No bill variance data.</div>
                        ) : (
                          billVariance.map((row) => {
                            const tone = row.variance > 0 ? "text-rose-600 dark:text-rose-400" : "text-green-600 dark:text-green-400";
                            return (
                              <div key={row.id} className="flex items-center justify-between gap-3">
                                <span className="truncate">{row.label}</span>
                                <span className={`font-semibold ${tone}`}>{formatDelta(row.variance)}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4">
                      <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Top merchants</div>
                      <div className="mt-2 space-y-2 text-sm text-(--vn-muted)">
                        {merchantRows.length === 0 ? (
                          <div className="text-(--vn-muted)">No merchant spend recorded.</div>
                        ) : (
                          merchantRows.map((row) => (
                            <div key={row.label} className="flex items-center justify-between gap-3">
                              <span className="truncate">{row.label}</span>
                              <span className="font-semibold text-(--vn-text)">
                                {formatMoney(row.total)}
                                {compareStats ? (
                                  <span className="ml-2 text-xs text-(--vn-muted)">
                                    ({formatDelta(row.delta)} vs last)
                                  </span>
                                ) : null}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="s-income" title="4) How stable is my income?">
                  {!hasIncomeData ? (
                    <div className="text-sm text-(--vn-muted)">
                      No income data recorded yet. Add income transactions to see stability metrics.
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <SummaryCard label="Average income" value={formatMoney(incomeAverage)} />
                      <SummaryCard label="Income volatility" value={formatMoney(incomeVolatility)} hint="Std dev across periods" />
                      <SummaryCard label="Stability score" value={`${stabilityScore ?? 0}/100`} hint="Higher is more stable" />
                      <SummaryCard
                        label="Reliable vs irregular"
                        value={`${formatMoney(incomeSplit.reliable)} | ${formatMoney(incomeSplit.irregular)}`}
                        hint="Reliable (rules) | Irregular (unmatched)"
                      />
                    </div>
                  )}
                </CollapsibleSection>

                <CollapsibleSection id="s-savings" title="5) How healthy are my savings?">
                  <div className="grid gap-4 md:grid-cols-2">
                    <SummaryCard
                      label="Savings rate"
                      value={formatPercent(savingsRate)}
                      hint="Savings as a share of income"
                    />
                    <SummaryCard
                      label="Savings streak"
                      value={`${savingsStreak} period(s)`}
                      hint="Consecutive periods meeting target"
                    />
                    <SummaryCard
                      label="Savings delta"
                      value={formatDelta(baseStats.actualSavings - baseStats.budgetSavings)}
                      hint="Actual vs target"
                    />
                    <SummaryCard
                      label="Remaining after plan delta"
                      value={formatDelta(baseStats.actualLeftover - baseStats.budgetLeftover)}
                      hint="Actual vs planned"
                    />
                  </div>
                  {savingsRateSeries.filter(r => r > 0).length >= 2 && (
                    <div className="mt-4 rounded-2xl bg-(--vn-surface) p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-(--vn-muted)">Savings rate across periods</div>
                        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatPercent(savingsRateSeries[savingsRateSeries.length - 1])} now
                        </div>
                      </div>
                      <Sparkline values={savingsRateSeries} stroke="#22c55e" fill="#22c55e" />
                      <div className="mt-1 flex justify-between text-[10px] text-(--vn-muted)">
                        <span>{sortedPeriods[0]?.label}</span>
                        <span>{sortedPeriods[sortedPeriods.length - 1]?.label}</span>
                      </div>
                    </div>
                  )}
                </CollapsibleSection>

                <CollapsibleSection id="s-next" title="6) What should I do next?">
                  <div className="space-y-2 text-sm text-(--vn-muted)">
                    {recommendations.map((rec) => (
                      <div key={rec} className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) px-4 py-3">
                        {rec}
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection id="s-compare" title="7) How do periods compare overall?">
                  {periodTrendData.length > 1 && (
                    <div className="mb-6 rounded-2xl bg-(--vn-surface) p-6 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-(--vn-muted) mb-4">Income vs spending trends</div>
                      <SpendingTrendChart data={periodTrendData} showIncome={true} height={300} />
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    {seriesCards.map((series) => {
                      const last = lastValue(series.values);
                      const delta = deltaValue(series.values);
                      const deltaTone = delta >= 0 ? "text-green-600 dark:text-green-400" : "text-rose-600 dark:text-rose-400";
                      return (
                        <div key={series.key} className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-xs uppercase tracking-wide text-(--vn-muted)">{series.label}</div>
                              <div className="mt-1 text-lg font-semibold text-(--vn-text)">{formatMoney(last)}</div>
                              <div className={`mt-1 text-xs ${deltaTone}`}>
                                {delta >= 0 ? "Up" : "Down"} {formatDelta(delta)} vs last period
                              </div>
                            </div>
                            <Sparkline values={series.values} stroke={series.stroke} fill={series.fill} />
                          </div>
                          <div className="mt-2 text-xs text-(--vn-muted)">
                            {series.values.length} period(s) tracked
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-2xl border border-(--vn-border) bg-(--vn-surface) p-4">
                    <div className="text-xs uppercase tracking-wide text-(--vn-muted)">Period highlights</div>
                    <div className="mt-2 space-y-2 text-sm text-(--vn-muted)">
                      <div className="flex items-center justify-between">
                        <span>Highest income</span>
                        <span className="font-semibold text-(--vn-text)">
                          {formatMoney(incomePeak.value)} ({periodLabelAt(sortedPeriods, incomePeak.index)})
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Highest spending</span>
                        <span className="font-semibold text-(--vn-text)">
                          {formatMoney(spendingPeak.value)} ({periodLabelAt(sortedPeriods, spendingPeak.index)})
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Best leftover</span>
                        <span className="font-semibold text-(--vn-text)">
                          {formatMoney(bestLeftover.value)} ({periodLabelAt(sortedPeriods, bestLeftover.index)})
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Lowest leftover</span>
                        <span className="font-semibold text-(--vn-text)">
                          {formatMoney(worstLeftover.value)} ({periodLabelAt(sortedPeriods, worstLeftover.index)})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2">
                    {scorecards.map((card) => {
                      const badge =
                        card.status === "green"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          : card.status === "amber"
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                            : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300";
                      return (
                        <div
                          key={card.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--vn-border) bg-(--vn-surface) px-4 py-3"
                        >
                          <div className="font-semibold text-(--vn-text)">{card.label}</div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`rounded-full px-2 py-1 font-semibold ${badge}`}>
                              {card.status.toUpperCase()}
                            </span>
                            <span className="text-(--vn-muted)">Leftover {formatMoney(card.leftover)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleSection>

                {crossPeriodVariance && crossPeriodVariance.activeCategories.length > 0 && (
                  <CollapsibleSection title="8) Category trends across periods">
                    <div className="overflow-x-auto rounded-2xl border border-(--vn-border)">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-(--vn-border) bg-(--vn-bg)">
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-(--vn-muted)">Category</th>
                            {crossPeriodVariance.periodData.map(({ period }) => (
                              <th key={period.id} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-(--vn-muted) whitespace-nowrap">
                                {period.label}
                              </th>
                            ))}
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-(--vn-muted)">Trend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {crossPeriodVariance.activeCategories.map((cat) => {
                            const values = crossPeriodVariance.periodData.map(p => p.byCategory[cat] || 0);
                            const maxVal = crossPeriodVariance.maxPerCat[cat];
                            const last = values[values.length - 1];
                            const prev = values.length > 1 ? values[values.length - 2] : last;
                            const trendUp = last > prev * 1.05;
                            const trendDown = last < prev * 0.95;
                            return (
                              <tr key={cat} className="border-b border-(--vn-border) last:border-0">
                                <td className="px-4 py-3 font-medium text-(--vn-text) capitalize">{cat}</td>
                                {values.map((val, idx) => {
                                  const intensity = maxVal > 0 ? val / maxVal : 0;
                                  const bg = intensity > 0.8 ? "rgba(239,68,68,0.25)" :
                                    intensity > 0.5 ? "rgba(251,146,60,0.2)" :
                                    intensity > 0.2 ? "rgba(250,204,21,0.15)" :
                                    "transparent";
                                  return (
                                    <td key={idx} className="px-4 py-3 text-right tabular-nums text-(--vn-muted) text-xs" style={{ background: bg }}>
                                      {val > 0 ? formatMoney(val) : <span className="text-(--vn-muted)">-</span>}
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-3 text-right">
                                  {trendUp ? (
                                    <span className="text-rose-500 font-bold text-xs">↑ {formatDelta(last - prev)}</span>
                                  ) : trendDown ? (
                                    <span className="text-emerald-500 font-bold text-xs">↓ {formatDelta(last - prev)}</span>
                                  ) : (
                                    <span className="text-(--vn-muted) text-xs">~</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-(--vn-muted) mt-2">Heat-map shading: darker = higher spend relative to category peak. Trend shows last vs previous period.</p>
                  </CollapsibleSection>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      <CategoryDrilldown
        isOpen={!!drilldownCategory}
        onClose={() => setDrilldownCategory(null)}
        category={(drilldownCategory ?? "other") as import("@/data/plan").CashflowCategory}
        transactions={drilldownTxns}
        budgeted={drilldownBudget}
        periodLabel={basePeriod?.label}
      />
    </main>
  );
}

