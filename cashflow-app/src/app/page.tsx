"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createFreshPlan, hasStoredPlan, loadPlan, resetPlan, savePlan } from "@/lib/storage";
import {
  dismissOnboarding,
  loadOnboardingState,
  loadWizardState,
  ONBOARDING_TASKS,
  resetOnboarding,
  saveOnboardingState,
  setOnboardingTask,
} from "@/lib/onboarding";
import OnboardingWizard from "@/components/OnboardingWizard";
import { ALERT_PREFS_UPDATED_EVENT, getAlerts, loadAlertPreferences } from "@/lib/alerts";
import {
  buildTimeline,
  generateEvents,
  getPeriod,
  getStartingBalance,
  getUpcomingEvents,
  getWindow,
  minPoint,
} from "@/lib/cashflowEngine";
import SidebarNav from "@/components/SidebarNav";
import ThemeToggle from "@/components/ThemeToggle";
import { CashflowProjectionChart, SpendingTrendChart, DonutChart } from "@/components/charts";
import type { CashflowDataPoint, SpendingDataPoint, DonutDataPoint } from "@/components/charts";
import { CategoryDrilldown } from "@/components/CategoryDrilldown";
import type { CashflowCategory } from "@/data/plan";

function money(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
}

function prettyDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function toUtcDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function dayDiff(startISO: string, endISO: string) {
  const ms = toUtcDay(endISO) - toUtcDay(startISO);
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}


type SummaryTone = "good" | "bad" | "neutral";

type SummaryItem = {
  label: string;
  value: string;
  hint?: string;
  tone?: SummaryTone;
};

function toneStyle(tone?: SummaryTone): React.CSSProperties {
  if (tone === "good") return { color: "var(--vn-success)" };
  if (tone === "bad") return { color: "var(--vn-error)" };
  return { color: "var(--vn-text)" };
}

function SummaryPanel({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: SummaryItem[];
}) {
  return (
    <div className="vn-card p-6">
      <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>{title}</div>
      {subtitle ? <div className="mt-1 text-xs" style={{ color: "var(--vn-muted)" }}>{subtitle}</div> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--vn-surface)", border: "1px solid var(--vn-border)" }}>
            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--vn-muted)" }}>{item.label}</div>
            <div className="mt-2 text-xl font-semibold" style={toneStyle(item.tone)}>{item.value}</div>
            {item.hint ? <div className="mt-1 text-xs" style={{ color: "var(--vn-muted)" }}>{item.hint}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [plan, setPlan] = useState(() => loadPlan());
  const [isFirstUse, setIsFirstUse] = useState(false);
  const [onboarding, setOnboarding] = useState(() => loadOnboardingState());
  const [selectedCategory, setSelectedCategory] = useState<CashflowCategory | null>(null);
  const [alertPrefs, setAlertPrefs] = useState(() => loadAlertPreferences());
  const [showWizard, setShowWizard] = useState(() => {
    if (typeof window === "undefined") return false;
    return !loadWizardState().completed;
  });

  useEffect(() => {
    const refreshPrefs = () => setAlertPrefs(loadAlertPreferences());
    const refresh = () => {
      setPlan(loadPlan());
      setIsFirstUse(!hasStoredPlan());
      setOnboarding(loadOnboardingState());
      refreshPrefs();
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(ALERT_PREFS_UPDATED_EVENT, refreshPrefs);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(ALERT_PREFS_UPDATED_EVENT, refreshPrefs);
    };
  }, []);

  useEffect(() => {
    const current = loadOnboardingState();
    let changed = false;
    const completed = { ...current.completed };
    ONBOARDING_TASKS.forEach((task) => {
      if (task.autoComplete && task.autoComplete(plan)) {
        if (!completed[task.id]) {
          completed[task.id] = true;
          changed = true;
        }
      }
    });
    const next = changed ? { ...current, completed } : current;
    if (changed) saveOnboardingState(next);
    setOnboarding(next);
  }, [plan]);

  const period = useMemo(() => getPeriod(plan, plan.setup.selectedPeriodId), [plan]);
  const windowData = useMemo(() => getWindow(plan), [plan]);
  const events = useMemo(() => generateEvents(plan, plan.setup.selectedPeriodId), [plan]);
  const startingBalance = useMemo(
    () => getStartingBalance(plan, plan.setup.selectedPeriodId),
    [plan]
  );
  const rows = useMemo(
    () => buildTimeline(plan, plan.setup.selectedPeriodId, startingBalance),
    [plan, startingBalance]
  );
  const lowest = useMemo(() => minPoint(rows), [rows]);

  const endingBalance = rows.length ? rows[rows.length - 1].balance : startingBalance;
  const upcomingIncome = useMemo(
    () => getUpcomingEvents(plan, plan.setup.selectedPeriodId, "income").slice(0, 4),
    [plan]
  );
  const upcomingBills = useMemo(
    () => getUpcomingEvents(plan, plan.setup.selectedPeriodId, "outflow").slice(0, 4),
    [plan]
  );

  const periodTransactions = useMemo(
    () => plan.transactions.filter((t) => t.date >= period.start && t.date <= period.end),
    [plan, period]
  );

  const budgetIncome = useMemo(
    () => events.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0),
    [events]
  );
  const budgetOutflows = useMemo(
    () => events.filter((e) => e.type === "outflow").reduce((sum, e) => sum + e.amount, 0),
    [events]
  );
  const budgetSavings = useMemo(
    () =>
      events
        .filter((e) => e.type === "outflow" && e.category === "savings")
        .reduce((sum, e) => sum + e.amount, 0),
    [events]
  );
  const budgetSpending = budgetOutflows - budgetSavings;
  const budgetLeftover = budgetIncome - budgetOutflows;

  const actualIncome = useMemo(
    () => periodTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
    [periodTransactions]
  );
  const actualSavings = useMemo(
    () => periodTransactions.filter((t) => t.category === "savings").reduce((sum, t) => sum + t.amount, 0),
    [periodTransactions]
  );
  const actualSpending = useMemo(
    () =>
      periodTransactions
        .filter((t) => t.type === "outflow" && t.category !== "savings")
        .reduce((sum, t) => sum + t.amount, 0),
    [periodTransactions]
  );
  const actualLeftover = actualIncome - actualSpending - actualSavings;

  const periodDays = dayDiff(period.start, period.end) + 1;
  const daysElapsedRaw = dayDiff(period.start, plan.setup.asOfDate) + 1;
  const daysElapsed = Math.min(Math.max(daysElapsedRaw, 0), periodDays);
  const timeProgress = periodDays ? Math.min(1, daysElapsed / periodDays) : 0;
  const incomeProgress = budgetIncome ? Math.min(1, actualIncome / budgetIncome) : 0;
  const spendingProgress = budgetSpending ? Math.min(1, actualSpending / budgetSpending) : 0;
  const savingsProgress = budgetSavings ? Math.min(1, actualSavings / budgetSavings) : 0;
  const incomePaceGap = incomeProgress - timeProgress;
  const spendingPaceGap = spendingProgress - timeProgress;

  const onboardingTasks = useMemo(
    () =>
      ONBOARDING_TASKS.map((task) => {
        const autoDone = task.autoComplete ? task.autoComplete(plan) : false;
        return {
          ...task,
          done: Boolean(onboarding.completed[task.id] || autoDone),
          autoDone,
        };
      }),
    [onboarding.completed, plan]
  );
  const completedCount = onboardingTasks.filter((task) => task.done).length;
  const alerts = useMemo(
    () => getAlerts(plan, plan.setup.selectedPeriodId, alertPrefs),
    [alertPrefs, plan]
  );


  const storyInsights = useMemo(() => {
    const items: string[] = [];

    if (timeProgress > 0.05) {
      if (spendingPaceGap > 0.08) {
        items.push(
          `Spending is ahead of time: ${formatPercent(spendingProgress)} used with ${formatPercent(timeProgress)} of the period.`
        );
      } else if (spendingPaceGap < -0.08) {
        items.push(
          `Spending is behind time: ${formatPercent(spendingProgress)} used with ${formatPercent(timeProgress)} of the period.`
        );
      }
    }

    if (budgetIncome > 0 && timeProgress > 0.05) {
      const incomePace = budgetIncome * timeProgress;
      if (actualIncome < incomePace) {
        items.push(
          `Income is behind pace by about ${money(incomePace - actualIncome)} so far.`
        );
      } else if (actualIncome > incomePace) {
        items.push("Income is ahead of pace for this point in the period.");
      }
    }

    if (budgetSavings > 0 && timeProgress > 0.05) {
      const savingsPace = budgetSavings * timeProgress;
      if (actualSavings < savingsPace) {
        items.push(
          `Savings are behind pace by about ${money(savingsPace - actualSavings)} so far.`
        );
      } else if (actualSavings > savingsPace) {
        items.push("Savings are ahead of pace for this point in the period.");
      }
    }

    if (lowest && lowest.balance < plan.setup.expectedMinBalance) {
      items.push(
        `Forecast dips below the safe minimum on ${prettyDate(lowest.date)}.`
      );
    } else if (lowest) {
      items.push("Forecast stays above your safe minimum this period.");
    }

    if (!items.length) {
      items.push("Everything is tracking smoothly for this period.");
    }

    return items;
  }, [
    actualIncome,
    actualSavings,
    budgetIncome,
    budgetSavings,
    lowest,
    plan.setup.expectedMinBalance,
    spendingPaceGap,
    spendingProgress,
    timeProgress,
  ]);

  const cashflowChartData: CashflowDataPoint[] = useMemo(() => {
    return rows.slice(0, 30).map((row) => ({
      date: prettyDate(row.date),
      balance: row.balance,
    }));
  }, [rows]);

  const spendingChartData: SpendingDataPoint[] = useMemo(() => {
    const grouped = new Map<string, { spending: number; income: number }>();

    periodTransactions.forEach((txn) => {
      const label = prettyDate(txn.date);
      const current = grouped.get(label) || { spending: 0, income: 0 };

      if (txn.type === 'outflow') {
        current.spending += txn.amount;
      } else if (txn.type === 'income') {
        current.income += txn.amount;
      }

      grouped.set(label, current);
    });

    return Array.from(grouped.entries())
      .map(([date, data]) => ({
        date,
        spending: data.spending,
        income: data.income,
      }))
      .slice(0, 15);
  }, [periodTransactions]);

  // Spending by category for donut chart
  const spendingByCategory: DonutDataPoint[] = useMemo(() => {
    const categoryTotals = new Map<string, number>();

    periodTransactions
      .filter((t) => t.type === "outflow")
      .forEach((t) => {
        const cat = t.category || "other";
        categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + t.amount);
      });

    return Array.from(categoryTotals.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [periodTransactions]);

  // Get transactions for selected category
  const selectedCategoryTransactions = useMemo(() => {
    if (!selectedCategory) return [];
    return periodTransactions.filter((t) => t.category === selectedCategory);
  }, [periodTransactions, selectedCategory]);

  // Get budgeted amount for selected category
  const selectedCategoryBudget = useMemo(() => {
    if (!selectedCategory) return undefined;
    return events
      .filter((e) => e.category === selectedCategory && e.type === "outflow")
      .reduce((sum, e) => sum + e.amount, 0);
  }, [events, selectedCategory]);

  function handleStartFresh() {
    const fresh = createFreshPlan();
    savePlan(fresh);
    setPlan(fresh);
    setIsFirstUse(false);
    setOnboarding(resetOnboarding());
  }

  function handleLoadSampleData() {
    resetPlan();
    const next = loadPlan();
    setPlan(next);
    setIsFirstUse(!hasStoredPlan());
    setOnboarding(resetOnboarding());
  }

  function handleDismissOnboarding() {
    setOnboarding(dismissOnboarding(true));
  }

  function handleShowOnboarding() {
    setOnboarding(dismissOnboarding(false));
  }

  function handleWizardComplete(choice: "fresh" | "sample" | "skip") {
    setShowWizard(false);
    if (choice === "fresh") handleStartFresh();
    else if (choice === "sample") handleLoadSampleData();
  }

  function handleToggleTask(id: string, done: boolean) {
    setOnboarding(setOnboardingTask(id, done));
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-6">
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

          <section className="space-y-5">
            <header className="flex flex-col gap-4 rounded-3xl p-6 shadow-xl md:flex-row md:items-center md:justify-between" style={{ background: "var(--vn-surface)" }}>
              <div>
                <div className="text-xs uppercase tracking-wide" style={{ color: "var(--vn-muted)" }}>Dashboard</div>
                <h1 className="text-2xl font-semibold" style={{ color: "var(--vn-text)" }}>Welcome back</h1>
                <div className="mt-2 text-sm" style={{ color: "var(--vn-muted)" }}>
                  Your money story for this period.
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--vn-muted)" }}>{period.label}</div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ThemeToggle />
                <div className="rounded-full px-4 py-2 text-xs font-medium" style={{ background: "var(--vn-border)", color: "var(--vn-text)" }}>
                  Window {windowData.startISO} to {windowData.endISO}
                </div>
                <Link
                  href="/transactions"
                  className="vn-btn vn-btn-primary text-sm"
                >
                  Add Transaction
                </Link>
              </div>
            </header>

            {!onboarding.dismissed ? (
              <div className="vn-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>Getting started</div>
                    <div className="mt-1 text-xs" style={{ color: "var(--vn-muted)" }}>
                      {completedCount} of {onboardingTasks.length} steps done
                    </div>
                  </div>
                  <button
                    onClick={handleDismissOnboarding}
                    className="text-xs font-semibold transition-colors"
                    style={{ color: "var(--vn-muted)" }}
                  >
                    Dismiss
                  </button>
                </div>
                <div className="mt-3 text-sm" style={{ color: "var(--vn-text)" }}>
                  {isFirstUse
                    ? "Explore the sample plan, or clear it to build your own."
                    : "Keep momentum with a quick checklist and tips."}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={handleStartFresh}
                    className="vn-btn vn-btn-primary text-xs"
                  >
                    Start fresh
                  </button>
                  <button
                    onClick={handleLoadSampleData}
                    className="vn-btn vn-btn-ghost text-xs"
                  >
                    Load sample data
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {onboardingTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-2xl px-4 py-3"
                      style={{ background: "var(--vn-bg)" }}
                    >
                      <label className="flex flex-1 items-start gap-3">
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={(e) => handleToggleTask(task.id, e.target.checked)}
                          disabled={task.autoDone}
                          className="mt-1 accent-[var(--vn-primary)]"
                        />
                        <span>
                          <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>{task.label}</div>
                          <div className="text-xs" style={{ color: "var(--vn-muted)" }}>{task.description}</div>
                        </span>
                      </label>
                      <Link
                        href={task.href}
                        className="text-xs font-semibold"
                        style={{ color: "var(--vn-primary)" }}
                      >
                        Open
                      </Link>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl px-4 py-3 text-xs" style={{ background: "var(--vn-bg)", color: "var(--vn-text)" }}>
                  Tips: update your period dates, set a safe minimum balance, and log your first
                  real transaction to unlock insights.
                </div>
              </div>
            ) : (
              <div className="vn-card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>Onboarding hidden</div>
                    <div className="mt-1 text-xs" style={{ color: "var(--vn-muted)" }}>
                      Bring back the setup checklist any time.
                    </div>
                  </div>
                  <button
                    onClick={handleShowOnboarding}
                    className="vn-btn vn-btn-ghost text-xs px-3 py-2"
                  >
                    Show
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <SummaryPanel
                title="Budget snapshot (per period)"
                subtitle={`Selected period: ${period.start} to ${period.end}`}
                items={[
                  { label: "Budget income", value: money(budgetIncome) },
                  { label: "Budget spending", value: money(budgetSpending) },
                  { label: "Savings target", value: money(budgetSavings) },
                  {
                    label: "Planned leftover",
                    value: money(budgetLeftover),
                    tone: budgetLeftover >= 0 ? "good" : "bad",
                  },
                ]}
              />
              <SummaryPanel
                title="Actuals (selected period)"
                subtitle={`As of ${prettyDate(plan.setup.asOfDate)} (day ${daysElapsed} of ${periodDays})`}
                items={[
                  { label: "Income", value: money(actualIncome) },
                  { label: "Spending", value: money(actualSpending) },
                  { label: "Savings", value: money(actualSavings) },
                  {
                    label: "Leftover",
                    value: money(actualLeftover),
                    tone: actualLeftover >= 0 ? "good" : "bad",
                  },
                ]}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="vn-card p-6">
                <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>Balance forecast</div>
                <div className="mt-1 text-xs" style={{ color: "var(--vn-muted)" }}>
                  Projected balance over the next 30 days
                </div>
                <div className="mt-4">
                  <CashflowProjectionChart
                    data={cashflowChartData}
                    showProjection={false}
                    height={280}
                    lowBalanceThreshold={plan.setup.expectedMinBalance}
                  />
                </div>
              </div>

              {spendingChartData.length > 0 && (
                <div className="vn-card p-6">
                  <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>Daily activity</div>
                  <div className="mt-1 text-xs" style={{ color: "var(--vn-muted)" }}>
                    Income and spending by day
                  </div>
                  <div className="mt-4">
                    <SpendingTrendChart
                      data={spendingChartData}
                      showIncome={true}
                      height={280}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Spending by Category - Interactive Donut Chart */}
            {spendingByCategory.length > 0 && (
              <div className="vn-card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>
                      Spending by Category
                    </div>
                    <div className="mt-1 text-xs" style={{ color: "var(--vn-muted)" }}>
                      Click any category to see details
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold" style={{ color: "var(--vn-text)" }}>
                      {money(actualSpending)}
                    </div>
                    <div className="text-xs" style={{ color: "var(--vn-muted)" }}>
                      total spent
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <DonutChart
                    data={spendingByCategory}
                    height={340}
                    centerValue={money(actualSpending)}
                    centerLabel="Total Spent"
                    onCategoryClick={(cat) => setSelectedCategory(cat as CashflowCategory)}
                  />
                </div>
              </div>
            )}

            {/* Category Drilldown Modal */}
            <CategoryDrilldown
              isOpen={selectedCategory !== null}
              onClose={() => setSelectedCategory(null)}
              category={selectedCategory || "other"}
              transactions={selectedCategoryTransactions}
              budgeted={selectedCategoryBudget}
              periodLabel={period.label}
            />

            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-5">
                <div className="vn-card p-6">
                  <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>Story so far</div>
                  <div className="mt-3 space-y-3 text-sm" style={{ color: "var(--vn-text)" }}>
                    <div className="flex items-center justify-between">
                      <span>Time into period</span>
                      <span className="font-semibold" style={{ color: "var(--vn-text)" }}>
                        Day {daysElapsed} of {periodDays}
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "var(--vn-border)" }}>
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${timeProgress * 100}%`, background: "var(--vn-primary)" }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Spending used</span>
                      <span className="font-semibold" style={{ color: "var(--vn-text)" }}>
                        {money(actualSpending)} of {money(budgetSpending)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "var(--vn-border)" }}>
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${spendingProgress * 100}%`, background: actualSpending > budgetSpending ? "#ef4444" : "#f97316" }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Income received</span>
                      <span className="font-semibold" style={{ color: "var(--vn-text)" }}>
                        {money(actualIncome)} of {money(budgetIncome)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "var(--vn-border)" }}>
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${incomeProgress * 100}%`, background: incomePaceGap < -0.08 ? "#eab308" : "#22c55e" }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Savings moved</span>
                      <span className="font-semibold" style={{ color: "var(--vn-text)" }}>
                        {money(actualSavings)} of {money(budgetSavings)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "var(--vn-border)" }}>
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${savingsProgress * 100}%`, background: actualSavings < budgetSavings ? "#eab308" : "#a855f7" }}
                      />
                    </div>

                    <div className="rounded-2xl px-4 py-3 text-xs" style={{ background: "var(--vn-bg)", color: "var(--vn-text)" }}>
                      Projected end balance: <span className="font-semibold">{money(endingBalance)}</span>.{" "}
                      Lowest point {lowest ? `${money(lowest.balance)} on ${prettyDate(lowest.date)}` : "-"}.
                    </div>

                    <div className="pt-4" style={{ borderTop: "1px solid var(--vn-border)" }}>
                      <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>Story insights</div>
                      <div className="mt-3 space-y-2 text-sm" style={{ color: "var(--vn-text)" }}>
                        {storyInsights.map((insight, idx) => (
                          <div key={`insight-${idx}`} className="flex gap-2">
                            <span style={{ color: "var(--vn-muted)" }}>-</span>
                            <span>{insight}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="space-y-5">
                <div className="vn-card p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>Alerts & notifications</div>
                    <Link href="/settings" className="text-xs transition-colors" style={{ color: "var(--vn-muted)" }}>
                      Manage
                    </Link>
                  </div>
                  <div className="mt-4 space-y-3 text-sm" style={{ color: "var(--vn-text)" }}>
                    {alerts.length === 0 ? (
                      <div className="text-xs" style={{ color: "var(--vn-muted)" }}>
                        Alerts are disabled. Enable them in Settings to see notices.
                      </div>
                    ) : (
                      alerts.map((alert) => {
                        const toneColor =
                          alert.tone === "critical"
                            ? "var(--vn-error)"
                            : alert.tone === "warning"
                              ? "var(--vn-warning)"
                              : alert.tone === "good"
                                ? "var(--vn-success)"
                                : "var(--vn-text)";
                        return (
                          <div
                            key={alert.id}
                            className="rounded-2xl px-4 py-3"
                            style={{ background: "var(--vn-bg)", border: "1px solid var(--vn-border)" }}
                          >
                            <div className="text-sm font-semibold" style={{ color: toneColor }}>{alert.title}</div>
                            <div className="mt-1 text-xs" style={{ color: "var(--vn-muted)" }}>{alert.description}</div>
                            {alert.href ? (
                              <Link
                                href={alert.href}
                                className="mt-2 inline-flex text-xs font-semibold"
                                style={{ color: "var(--vn-primary)" }}
                              >
                                View details
                              </Link>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="vn-card p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>Upcoming income</div>
                    <Link href="/income" className="text-xs transition-colors" style={{ color: "var(--vn-muted)" }}>
                      View all
                    </Link>
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    {upcomingIncome.length === 0 ? (
                      <div style={{ color: "var(--vn-muted)" }}>No income in window.</div>
                    ) : (
                      upcomingIncome.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold" style={{ color: "var(--vn-text)" }}>{item.label}</div>
                            <div className="text-xs" style={{ color: "var(--vn-muted)" }}>Due {prettyDate(item.date)}</div>
                          </div>
                          <div className="font-semibold" style={{ color: "var(--vn-success)" }}>{money(item.amount)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="vn-card p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>Upcoming bills</div>
                    <Link href="/bills" className="text-xs transition-colors" style={{ color: "var(--vn-muted)" }}>
                      View all
                    </Link>
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    {upcomingBills.length === 0 ? (
                      <div style={{ color: "var(--vn-muted)" }}>No bills in window.</div>
                    ) : (
                      upcomingBills.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold" style={{ color: "var(--vn-text)" }}>{item.label}</div>
                            <div className="text-xs" style={{ color: "var(--vn-muted)" }}>Due {prettyDate(item.date)}</div>
                          </div>
                          <div className="font-semibold" style={{ color: "var(--vn-error)" }}>{money(item.amount)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      {showWizard && <OnboardingWizard onComplete={handleWizardComplete} />}
    </main>
  );
}
