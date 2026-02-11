"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createFreshPlan, hasStoredPlan, loadPlan, resetPlan, savePlan } from "@/lib/storage";
import {
  dismissOnboarding,
  loadOnboardingState,
  ONBOARDING_TASKS,
  resetOnboarding,
  saveOnboardingState,
  setOnboardingTask,
} from "@/lib/onboarding";
import { ALERT_PREFS_UPDATED_EVENT } from "@/lib/alerts";
import {
  buildTimeline,
  generateEvents,
  getPeriod,
  getStartingBalance,
  getUpcomingEvents,
  minPoint,
} from "@/lib/cashflowEngine";
import SidebarNav from "@/components/SidebarNav";
import { VelanovoLogo } from "@/components/VelanovoLogo";
import ThemeToggle from "@/components/ThemeToggle";
import { CashflowProjectionChart } from "@/components/charts";
import type { CashflowDataPoint } from "@/components/charts";
import { InsightWidget } from "@/components/dashboard/InsightWidget";
import { TransactionsWidget } from "@/components/dashboard/TransactionsWidget";
import { BillsWidget } from "@/components/dashboard/BillsWidget";

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

function formatPeriodLabel(label: string) {
  return label.replace(/^P(\d+)/, "Period $1");
}




export default function HomePage() {
  const [plan, setPlan] = useState(() => loadPlan());
  const [onboarding, setOnboarding] = useState(() => loadOnboardingState());

  useEffect(() => {
    const refresh = () => {
      setPlan(loadPlan());
      setOnboarding(loadOnboardingState());
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(ALERT_PREFS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(ALERT_PREFS_UPDATED_EVENT, refresh);
    };
  }, []);

  // Auto-complete onboarding tasks derived from plan (no setState in effect)
  const resolvedOnboarding = useMemo(() => {
    const current = onboarding;
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
    if (changed) saveOnboardingState({ ...current, completed });
    return changed ? { ...current, completed } : current;
  }, [plan, onboarding]);

  const period = useMemo(() => getPeriod(plan, plan.setup.selectedPeriodId), [plan]);
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

  // Upcoming bills helper - need to map correctly for widget
  const upcomingBillsRaw = useMemo(
    () => getUpcomingEvents(plan, plan.setup.selectedPeriodId, "outflow").slice(0, 4),
    [plan]
  );

  const upcomingBills = useMemo(() => {
    return upcomingBillsRaw.map(b => ({
      id: b.id,
      label: b.label,
      amount: b.amount,
      date: b.date
    }));
  }, [upcomingBillsRaw]);

  const periodTransactions = useMemo(
    () => plan.transactions.filter((t) => t.date >= period.start && t.date <= period.end).map(t => ({
      ...t,
      date: t.date
    })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [plan, period]
  );

  // Recent transactions for widget
  const recentTransactions = useMemo(() => {
    return periodTransactions.slice(0, 5).map(t => ({
      id: t.id,
      date: t.date,
      merchant: t.label || "Unknown",
      amount: t.amount
    }));
  }, [periodTransactions]);

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
  const spendingProgress = budgetSpending ? Math.min(1, actualSpending / budgetSpending) : 0;
  const spendingPaceGap = spendingProgress - timeProgress;

  const onboardingTasks = useMemo(
    () =>
      ONBOARDING_TASKS.map((task) => {
        const autoDone = task.autoComplete ? task.autoComplete(plan) : false;
        return {
          ...task,
          done: Boolean(resolvedOnboarding.completed[task.id] || autoDone),
          autoDone,
        };
      }),
    [resolvedOnboarding, plan]
  );
  const completedCount = onboardingTasks.filter((task) => task.done).length;

  // Single best insight for the widget
  const mainInsight = useMemo(() => {
    if (timeProgress > 0.05) {
      if (spendingPaceGap > 0.08) {
        return {
          text: `Spending is high! ${formatPercent(spendingProgress)} of budget used with ${formatPercent(timeProgress)} of month gone.`,
          tone: "bad" as const
        };
      } else if (spendingPaceGap < -0.08) {
        return {
          text: `Under budget. ${formatPercent(spendingProgress)} spent with ${formatPercent(timeProgress)} of month gone. Great job!`,
          tone: "good" as const
        };
      }
    }

    if (lowest && lowest.balance < plan.setup.expectedMinBalance) {
      return {
        text: `Heads up: Balance dips below safe minimum on ${prettyDate(lowest.date)}.`,
        tone: "bad" as const
      };
    }

    return {
      text: "Everything is on track. Spending and balance are tracking normally.",
      tone: "good" as const
    };
  }, [spendingPaceGap, spendingProgress, timeProgress, lowest, plan.setup.expectedMinBalance]);

  const cashflowChartData: CashflowDataPoint[] = useMemo(() => {
    return rows.slice(0, 30).map((row) => ({
      date: prettyDate(row.date),
      balance: row.balance,
    }));
  }, [rows]);

  function handleStartFresh() {
    const fresh = createFreshPlan();
    savePlan(fresh);
    setPlan(fresh);
    setOnboarding(resetOnboarding());

  }

  function handleLoadSampleData() {
    resetPlan();
    const next = loadPlan();
    setPlan(next);
    setOnboarding(resetOnboarding());

  }

  function handleDismissOnboarding() {
    setOnboarding(dismissOnboarding(true));
  }

  function handleToggleTask(id: string, done: boolean) {
    setOnboarding(setOnboardingTask(id, done));
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-6">
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

          <section className="space-y-6">
            <header className="flex flex-col gap-4 rounded-3xl p-6 shadow-xl relative overflow-hidden"
              style={{ background: "var(--vn-surface)", border: "1px solid var(--vn-border)" }}>

              {/* Background accent */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between relative z-10">
                <div className="lg:hidden mb-2">
                  <VelanovoLogo size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[var(--vn-text)]">Dashboard</h1>
                  <div className="mt-1 text-sm text-[var(--vn-muted)]">
                    {formatPeriodLabel(period.label)} Overview
                  </div>

                </div>
                <div className="flex items-center gap-3 mt-4 md:mt-0">
                  <ThemeToggle />
                  <Link
                    href="/transactions"
                    className="vn-btn vn-btn-primary text-sm shadow-lg shadow-blue-500/20"
                  >
                    <span className="mr-2">+</span> Add Transaction
                  </Link>
                </div>
              </div>

              {/* Hero Metric */}
              <div className="p-5 rounded-2xl bg-[var(--vn-bg)] border border-[var(--vn-border)] mt-6">
                <div className="text-xs uppercase tracking-wide text-[var(--vn-muted)] mb-1">Safe to Spend</div>
                <div className="text-4xl font-bold text-[var(--vn-success)]">{money(actualLeftover > 0 ? actualLeftover : 0)}</div>
                <div className="text-xs text-[var(--vn-muted)] mt-1">Leftover from income this period</div>
              </div>
            </header>

            {/* Onboarding Panel */}
            {!resolvedOnboarding.dismissed && (
              <div className="vn-card p-6 border-l-4 border-l-[var(--vn-primary)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-[var(--vn-text)]">Getting started</div>
                    <div className="mt-1 text-xs text-[var(--vn-muted)]">
                      {completedCount} of {onboardingTasks.length} steps done
                    </div>
                  </div>
                  <button
                    onClick={handleDismissOnboarding}
                    className="text-xs font-semibold text-[var(--vn-muted)] hover:text-[var(--vn-text)] transition-colors"
                  >
                    Dismiss
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={handleStartFresh} className="vn-btn vn-btn-primary text-xs h-8 px-3">Start fresh</button>
                  <button onClick={handleLoadSampleData} className="vn-btn vn-btn-ghost text-xs h-8 px-3">Load sample data</button>
                </div>

                <div className="mt-4 space-y-2">
                  {onboardingTasks.filter(t => !t.done).slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 rounded-xl px-4 py-2 bg-[var(--vn-bg)]"
                    >
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={(e) => handleToggleTask(task.id, e.target.checked)}
                          disabled={task.autoDone}
                          className="w-4 h-4 accent-[var(--vn-primary)] rounded"
                        />
                        <span className="text-sm font-medium text-[var(--vn-text)]">{task.label}</span>
                      </label>
                      <Link href={task.href} className="text-xs font-semibold text-[var(--vn-primary)]">Go</Link>
                    </div>
                  ))}
                  {onboardingTasks.filter(t => !t.done).length > 3 && (
                    <div className="text-xs text-center text-[var(--vn-muted)] mt-2">...and {onboardingTasks.filter(t => !t.done).length - 3} more</div>
                  )}
                  {onboardingTasks.every(t => t.done) && (
                    <div className="text-sm text-[var(--vn-success)] font-medium text-center py-2">🎉 You're all set! Dismiss this card to clear space.</div>
                  )}
                </div>
              </div>
            )}

            {/* Visual Hero: Projection */}
            <div className="vn-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-[var(--vn-text)]">Cashflow Forecast</div>
                  <div className="text-xs text-[var(--vn-muted)]">Projected balance for next 30 days</div>
                </div>
                <div className="text-xs font-bold px-2 py-1 rounded bg-[var(--vn-bg)] text-[var(--vn-text)]">
                  End: {money(endingBalance)}
                </div>
              </div>

              <div className="h-[250px] w-full">
                <CashflowProjectionChart
                  data={cashflowChartData}
                  showProjection={false}
                  height={250}
                  lowBalanceThreshold={plan.setup.expectedMinBalance}
                />
              </div>
            </div>

            {/* Pointers: Widget Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* 1. Insight Pointer */}
              <div className="h-full">
                <InsightWidget
                  insight={mainInsight.text}
                  tone={mainInsight.tone}
                />
              </div>

              {/* 2. Transactions Pointer */}
              <div className="h-full">
                <TransactionsWidget transactions={recentTransactions} />
              </div>

              {/* 3. Bills Pointer */}
              <div className="h-full">
                <BillsWidget bills={upcomingBills} />
              </div>
            </div>

          </section>
        </div>
      </div>
    </main>
  );
}
