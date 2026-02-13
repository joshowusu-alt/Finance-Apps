"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { loadPlan } from "@/lib/storage";
import { formatMoney } from "@/lib/currency";
import { downloadPlanPdf } from "@/lib/planIo";
import { buildInsightsSnapshot } from "@/lib/insightsSnapshot";
import { downloadInsightsCsv, downloadInsightsPdf } from "@/lib/insightsExport";
import SidebarNav from "@/components/SidebarNav";
import { CategoryBreakdownChart, SpendingTrendChart } from "@/components/charts";
import type { Plan } from "@/data/plan";
import InsightsPanel from "@/components/InsightsPanel";
import SubscriptionDashboard from "@/components/SubscriptionDashboard";
import InfoTooltip from "@/components/InfoTooltip";

function formatDelta(value: number) {
  if (value === 0) return "0";
  const sign = value > 0 ? "+" : "-";
  return `${sign}${formatMoney(Math.abs(value))}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function prettyDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
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
    <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <span className="font-semibold text-slate-700 dark:text-slate-200">{formatPercent(pct)}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200">
        <div className="h-2 rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
      </div>
      {hint ? <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
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
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="vn-card p-6">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-800 dark:text-white">{title}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export default function InsightsPage() {
  const [plan, setPlan] = useState(() => loadPlan());
  const [basePeriodId, setBasePeriodId] = useState<number>(() => loadPlan().setup.selectedPeriodId);
  const [comparePeriodId, setComparePeriodId] = useState<"auto" | number | null>("auto");
  const [showFullInsights, setShowFullInsights] = useState(false);

  useEffect(() => {
    const refresh = () => setPlan(loadPlan());
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

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

  const incomePeak = periodHighlights.incomePeak;
  const spendingPeak = periodHighlights.spendingPeak;
  const bestLeftover = periodHighlights.bestLeftover;
  const worstLeftover = periodHighlights.worstLeftover;

  const paceDelta = spendingProgress - timeProgress;
  const paceStatus =
    paceDelta > 0.08 ? "Spending high" : paceDelta < -0.08 ? "Under budget" : "On track";
  const paceTone =
    paceDelta > 0.08 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400";

  function handleExportInsightsCsv() {
    downloadInsightsCsv(snapshot);
  }

  function handleDownloadInsightsPdf() {
    downloadInsightsPdf(snapshot);
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={basePeriod.label} periodStart={basePeriod.start} periodEnd={basePeriod.end} />

          <section className="space-y-6">
            <header className="vn-card p-6">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Insights</div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Insights</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Answers to the questions you normally ask about the period.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span>Base period</span>
                  <select
                    value={basePeriodId}
                    onChange={(e) => setBasePeriodId(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
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
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-2 py-1 text-xs text-slate-700 dark:text-slate-200"
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
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-1.5 text-xs min-h-10 font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700"
                  >
                    Export insights (CSV)
                  </button>
                  <button
                    onClick={handleDownloadInsightsPdf}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-1.5 text-xs min-h-10 font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700"
                  >
                    Download insights report (PDF)
                  </button>
                  <button
                    onClick={() => downloadPlanPdf(plan, baseStats.period.id)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-1.5 text-xs min-h-10 font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700"
                  >
                    Download plan report (PDF)
                  </button>
                </div>
              </div>
            </header>

            <section className="vn-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick pulse</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Key insights at a glance</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFullInsights((prev) => !prev)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-1.5 text-xs min-h-10 font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700"
                  aria-expanded={showFullInsights}
                >
                  {showFullInsights ? "Hide details" : "See more"}
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">On track</div>
                  <div className={`mt-2 text-lg font-semibold ${paceTone}`}>{paceStatus}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {formatPercent(spendingProgress)} of budget vs {formatPercent(timeProgress)} time
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Lowest point</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                    {lowestPoint ? formatMoney(lowestPoint.balance) : "N/A"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {lowestPoint ? `on ${prettyDate(lowestPoint.date)}` : "No forecast yet"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Risk days</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                    {riskDays === 0 ? "None" : `${riskDays} day${riskDays === 1 ? "" : "s"}`}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {riskDays === 0 ? "Balance stays above minimum" : `First risk ${prettyDate(firstRisk?.date)}`}
                  </div>
                </div>
              </div>
            </section>

            {showFullInsights && (
              <>
                {/* Proactive Insights Panel */}
                <InsightsPanel />

                <SubscriptionDashboard
                  transactions={plan.transactions}
                  asOfDate={plan.setup.asOfDate}
                />

                <CollapsibleSection title="1) Am I on track?" defaultOpen>
              {/* Budget vs Actual Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {([
                  { label: "Income", budget: baseStats.budgetIncome, actual: baseStats.actualIncome, favorableWhenOver: true },
                  { label: "Spending", budget: baseStats.budgetSpending, actual: baseStats.actualSpending, favorableWhenOver: false },
                  { label: "Savings", budget: baseStats.budgetSavings, actual: baseStats.actualSavings, favorableWhenOver: true },
                  { label: "Leftover", budget: baseStats.budgetLeftover, actual: baseStats.actualLeftover, favorableWhenOver: true },
                ] as const).map((card) => {
                  const delta = card.actual - card.budget;
                  const favorable = card.favorableWhenOver ? delta >= 0 : delta <= 0;
                  return (
                    <div key={card.label} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{card.label}</div>
                      <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Budget {formatMoney(card.budget)}</div>
                      <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{formatMoney(card.actual)}</div>
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
                <div className="mb-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">Variance by category</div>
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
                            <span className="capitalize text-slate-700 dark:text-slate-300">{v.category}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400 dark:text-slate-500">
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
                <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Forecast end balance</div>
                  <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{formatMoney(endBalance)}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Lowest point {lowestPoint ? formatMoney(lowestPoint.balance) : "0"}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Risk days</div>
                  <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                    {riskDays === 0 ? "None" : `${riskDays} day(s)`}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {firstRisk ? `First risk on ${firstRisk.date}` : "Above safe minimum"}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Projected leftover</div>
                  <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                    {formatDelta(projectedLeftover)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Based on current pace
                  </div>
                </div>
                <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center">
                    Safe minimum
                    <InfoTooltip text="Your minimum safe balance. Any day the forecast dips below this is flagged as risk." />
                  </div>
                  <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                    {formatMoney(plan.setup.expectedMinBalance)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {lowestPoint && lowestPoint.balance < plan.setup.expectedMinBalance
                      ? "Below minimum"
                      : "On track"}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Forecast scenarios</div>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  {forecastScenarios.map((scenario) => {
                    const tone =
                      scenario.bufferDelta >= 0
                        ? "text-green-600"
                        : "text-rose-600";
                    return (
                      <div
                        key={scenario.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4"
                      >
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{scenario.label}</div>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{scenario.note}</div>
                        <div className="mt-3 text-xs uppercase tracking-wide text-slate-400">Projected leftover</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                          {formatMoney(scenario.leftover)}
                        </div>
                        <div className="mt-2 text-xs uppercase tracking-wide text-slate-400">End balance</div>
                        <div className={`mt-1 text-sm font-semibold ${tone}`}>
                          {formatMoney(scenario.endBalance)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="2) What changed vs last period?">
              {compareStats ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Income change</div>
                      <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                        {formatDelta(baseStats.actualIncome - compareStats.actualIncome)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Spending change</div>
                      <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                        {formatDelta(baseStats.actualSpending - compareStats.actualSpending)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Savings change</div>
                      <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                        {formatDelta(baseStats.actualSavings - compareStats.actualSavings)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Leftover change</div>
                      <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                        {formatDelta(baseStats.actualLeftover - compareStats.actualLeftover)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Top category changes</div>
                      <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        {categoryChanges.length === 0 ? (
                          <div className="text-slate-500 dark:text-slate-400">No category changes.</div>
                        ) : (
                          categoryChanges.map((item) => (
                            <div key={item.category} className="flex items-center justify-between">
                              <span className="capitalize">{item.category}</span>
                              <span className="font-semibold text-slate-900 dark:text-white">{formatDelta(item.delta)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4">
                      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Top merchant changes</div>
                      <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        {labelChanges.length === 0 ? (
                          <div className="text-slate-500 dark:text-slate-400">No merchant changes.</div>
                        ) : (
                          labelChanges.map((item) => (
                            <div key={item.label} className="flex items-center justify-between">
                              <span>{item.label}</span>
                              <span className="font-semibold text-slate-900 dark:text-white">{formatDelta(item.delta)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {incomeSourceChanges ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">New income sources</div>
                        <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                          {incomeSourceChanges.newSources.length === 0
                            ? <div className="text-slate-500 dark:text-slate-400">None this period.</div>
                            : incomeSourceChanges.newSources.map((source) => (
                              <div key={source}>{source}</div>
                            ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4">
                        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Missing income sources</div>
                        <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                          {incomeSourceChanges.missingSources.length === 0
                            ? <div className="text-slate-500 dark:text-slate-400">None missing.</div>
                            : incomeSourceChanges.missingSources.map((source) => (
                              <div key={source}>{source}</div>
                            ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">Select a comparison period to see changes.</div>
              )}
            </CollapsibleSection>

            <CollapsibleSection title="3) Where am I overspending?">
              {categoryChartData.length > 0 && (
                <div className="mb-6 rounded-2xl bg-white/70 dark:bg-slate-800/70 p-6 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-4">Spending by category</div>
                  <CategoryBreakdownChart data={categoryChartData} height={320} />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center">Variable cap<InfoTooltip text="Your budgeted limit for flexible spending each period. Anything above this means you're overspending on non-fixed expenses." /></div>
                  <div className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                    {formatMoney(plan.setup.variableCap)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Actual {formatMoney(variableSpend)} ({formatDelta(variableDelta)})
                  </div>
                </div>
                <div className="rounded-2xl bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Top overspent categories</div>
                  <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {overspentCategories.length === 0 ? (
                      <div className="text-slate-500 dark:text-slate-400">No categories over budget.</div>
                    ) : (
                      overspentCategories.slice(0, 4).map((cat) => (
                        <div key={cat.category} className="flex items-center justify-between">
                          <span className="capitalize">{cat.category}</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{formatDelta(cat.variance)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Biggest overspend items</div>
                <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {overspendItems.length === 0 ? (
                    <div className="text-slate-500 dark:text-slate-400">No overspend items.</div>
                  ) : (
                    overspendItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <span>{item.label}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{formatMoney(item.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Budget variance by bill</div>
                  <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {billVariance.length === 0 ? (
                      <div className="text-slate-500 dark:text-slate-400">No bill variance data.</div>
                    ) : (
                      billVariance.map((row) => {
                        const tone = row.variance > 0 ? "text-rose-600" : "text-green-600";
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
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Top merchants</div>
                  <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {merchantRows.length === 0 ? (
                      <div className="text-slate-500 dark:text-slate-400">No merchant spend recorded.</div>
                    ) : (
                      merchantRows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3">
                          <span className="truncate">{row.label}</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatMoney(row.total)}
                            {compareStats ? (
                              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
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

            <CollapsibleSection title="4) How stable is my income?">
              {!hasIncomeData ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">
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

            <CollapsibleSection title="5) How healthy are my savings?">
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
                  label="Leftover delta"
                  value={formatDelta(baseStats.actualLeftover - baseStats.budgetLeftover)}
                  hint="Actual vs planned"
                />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="6) What should I do next?">
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {recommendations.map((rec) => (
                  <div key={rec} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 px-4 py-3">
                    {rec}
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="7) How do periods compare overall?">
              {periodTrendData.length > 1 && (
                <div className="mb-6 rounded-2xl bg-white/70 dark:bg-slate-800/70 p-6 shadow-sm">
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-4">Income vs spending trends</div>
                  <SpendingTrendChart data={periodTrendData} showIncome={true} height={300} />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {seriesCards.map((series) => {
                  const last = lastValue(series.values);
                  const delta = deltaValue(series.values);
                  const deltaTone = delta >= 0 ? "text-green-600" : "text-rose-600";
                  return (
                    <div key={series.key} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{series.label}</div>
                          <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{formatMoney(last)}</div>
                          <div className={`mt-1 text-xs ${deltaTone}`}>
                            {delta >= 0 ? "Up" : "Down"} {formatDelta(delta)} vs last period
                          </div>
                        </div>
                        <Sparkline values={series.values} stroke={series.stroke} fill={series.fill} />
                      </div>
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {series.values.length} period(s) tracked
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Period highlights</div>
                <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Highest income</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatMoney(incomePeak.value)} ({periodLabelAt(sortedPeriods, incomePeak.index)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Highest spending</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatMoney(spendingPeak.value)} ({periodLabelAt(sortedPeriods, spendingPeak.index)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Best leftover</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatMoney(bestLeftover.value)} ({periodLabelAt(sortedPeriods, bestLeftover.index)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Lowest leftover</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatMoney(worstLeftover.value)} ({periodLabelAt(sortedPeriods, worstLeftover.index)})
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-2">
                {scorecards.map((card) => {
                  const badge =
                    card.status === "green"
                      ? "bg-amber-100 text-green-700"
                      : card.status === "amber"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-700";
                  return (
                    <div
                      key={card.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 px-4 py-3"
                    >
                      <div className="font-semibold text-slate-900 dark:text-white">{card.label}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`rounded-full px-2 py-1 font-semibold ${badge}`}>
                          {card.status.toUpperCase()}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">Leftover {formatMoney(card.leftover)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleSection>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
