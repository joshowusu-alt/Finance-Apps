"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { hasStoredPlan, savePlan } from "@/lib/storage";
import { createSamplePlan } from "@/data/plan";
import { loadWizardState } from "@/lib/onboarding";
import OnboardingWizard from "@/components/OnboardingWizard";
import type { Plan } from "@/data/plan";
import {
  dismissOnboarding,
  loadOnboardingState,
  ONBOARDING_TASKS,
  resetOnboarding,
  saveOnboardingState,
  setOnboardingTask,
} from "@/lib/onboarding";
import { ALERT_PREFS_UPDATED_EVENT } from "@/lib/alerts";
import { getUpcomingEvents } from "@/lib/cashflowEngine";
import SidebarNav from "@/components/SidebarNav";
import { formatMoney } from "@/lib/currency";
import { VelanovoLogo } from "@/components/VelanovoLogo";
import ThemeToggle from "@/components/ThemeToggle";
import { CashflowProjectionChart } from "@/components/charts";
import type { CashflowDataPoint } from "@/components/charts";
import { InsightWidget } from "@/components/dashboard/InsightWidget";
import { TransactionsWidget } from "@/components/dashboard/TransactionsWidget";
import { BillsWidget } from "@/components/dashboard/BillsWidget";
import InfoTooltip from "@/components/InfoTooltip";
import { useDerived } from "@/lib/useDerived";
import { prettyDate } from "@/lib/formatUtils";
import { toUtcDay, dayDiff } from "@/lib/dateUtils";
import { detectSubscriptions } from "@/lib/subscriptionDetection";



function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatPeriodLabel(label: string) {
  return label.replace(/^P(\d+)/, "Period $1");
}




export default function HomePage() {
  const { state: plan, derived } = useDerived();
  const [onboarding, setOnboarding] = useState(() => loadOnboardingState());
  const [isFirstVisit, setIsFirstVisit] = useState(() => !hasStoredPlan());
  const [showSetup, setShowSetup] = useState(() => !hasStoredPlan() && !loadWizardState().completed);

  useEffect(() => {
    const refresh = () => {
      setOnboarding(loadOnboardingState());
      setIsFirstVisit(!hasStoredPlan());
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

  const period = derived.period;
  const rows = derived.cashflow.daily;
  const lowest = derived.cashflow.lowest;
  const endingBalance = rows.length ? rows[rows.length - 1].balance : 0;

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

  const budgetOutflows = derived.totals.committedBills + derived.totals.allocationsTotal;
  const budgetSavings = derived.savingsHealth.savingsThisPeriod;
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

    if (lowest && plan.setup.expectedMinBalance > 0 && lowest.balance < plan.setup.expectedMinBalance) {
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

  // Empty state detection — no plan data set up yet
  const hasData = plan.incomeRules.length > 0 || plan.bills.length > 0 || plan.transactions.length > 0 || plan.setup.startingBalance > 0;

  // Subscription nudge — detect actionable subscriptions
  const subscriptionNudge = useMemo(() => {
    if (plan.transactions.length < 3) return null;
    const subs = detectSubscriptions(plan.transactions);
    const actionable = subs.filter(s => s.recommendation === "review" || s.recommendation === "cancel");
    if (actionable.length === 0) return null;
    const totalMonthly = actionable.reduce((sum, s) => sum + s.monthlyCost, 0);
    return { count: actionable.length, totalMonthly };
  }, [plan.transactions]);

  function handleQuickSetupComplete(builtPlan: Plan) {
    savePlan(builtPlan);
    setOnboarding(resetOnboarding());
    setIsFirstVisit(false);
    setShowSetup(false);
  }

  function handleLoadSampleData() {
    const sample = createSamplePlan();
    savePlan(sample, { action: "reset" });
    setOnboarding(resetOnboarding());
    setIsFirstVisit(false);
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
                {!hasData ? (
                  <div className="text-center py-2">
                    <div className="text-3xl mb-2">📊</div>
                    <div className="text-sm font-semibold text-[var(--vn-text)]">Set up your plan to get started</div>
                    <div className="text-xs text-[var(--vn-muted)] mt-1 mb-3">Add income, bills, or a starting balance to see your cashflow</div>
                    <button onClick={() => setShowSetup(true)} className="vn-btn vn-btn-primary text-xs px-4 py-2">
                      Quick Setup
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-xs uppercase tracking-wide text-[var(--vn-muted)] mb-1 flex items-center">Safe to Spend<InfoTooltip text="Income received this period minus spending and savings. This is how much you can still spend without going over budget." /></div>
                    <div className={`text-4xl font-bold ${actualLeftover > 0 ? "text-[var(--vn-success)]" : "text-rose-500"}`}>{formatMoney(actualLeftover)}</div>
                    <div className="text-xs text-[var(--vn-muted)] mt-1">Leftover from income this period</div>

                    {/* Spending pace bar */}
                    {timeProgress > 0.02 && budgetSpending > 0 && (
                      <div className="mt-3 pt-3 border-t border-[var(--vn-border)]">
                        <div className="flex items-center justify-between text-xs text-[var(--vn-muted)] mb-1.5">
                          <span>Spending pace</span>
                          <span className={spendingPaceGap > 0.08 ? "text-rose-500 font-semibold" : spendingPaceGap < -0.08 ? "text-emerald-500 font-semibold" : "text-[var(--vn-muted)]"}>
                            {spendingPaceGap > 0.08 ? "Spending high" : spendingPaceGap < -0.08 ? "Under budget ✓" : "On track"}
                          </span>
                        </div>
                        <div className="relative h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                          {/* Time elapsed bar (background) */}
                          <div className="absolute inset-y-0 left-0 rounded-full bg-slate-300 dark:bg-slate-600" style={{ width: `${Math.round(timeProgress * 100)}%` }} />
                          {/* Spending progress bar (foreground) */}
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full transition-all ${spendingPaceGap > 0.08 ? "bg-rose-500" : spendingPaceGap < -0.08 ? "bg-emerald-500" : "bg-blue-500"}`}
                            style={{ width: `${Math.min(100, Math.round(spendingProgress * 100))}%`, opacity: 0.85 }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-[var(--vn-muted)] mt-1">
                          <span>{Math.round(spendingProgress * 100)}% spent</span>
                          <span>{Math.round(timeProgress * 100)}% of period</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--vn-border)]">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${derived.health.label === "Healthy"
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                          : derived.health.label === "Watch"
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        }`}>
                        {derived.health.label}
                      </span>
                      <span className="text-xs text-[var(--vn-muted)]">{derived.health.reason}</span>
                    </div>
                  </>
                )}
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
                  <button onClick={handleLoadSampleData} className="vn-btn vn-btn-primary text-sm sm:text-xs h-11 sm:h-8 px-4 sm:px-3">
                    Try demo data
                    {isFirstVisit ? (
                      <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">Recommended</span>
                    ) : null}
                  </button>
                  <button onClick={() => setShowSetup(true)} className="vn-btn vn-btn-ghost text-sm sm:text-xs h-11 sm:h-8 px-4 sm:px-3">
                    Quick setup
                  </button>
                </div>
                <div className="mt-2 text-xs text-[var(--vn-muted)]">
                  Explore a prefilled plan to see insights immediately. You can reset to a blank plan anytime.
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
                    <div className="text-sm text-[var(--vn-success)] font-medium text-center py-2">🎉 You&apos;re all set! Dismiss this card to clear space.</div>
                  )}
                </div>
              </div>
            )}

            {/* Subscription Nudge */}
            {subscriptionNudge && (
              <div className="vn-card p-4 border-l-4 border-l-amber-400 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[var(--vn-text)]">💡 Subscription review</div>
                  <div className="text-xs text-[var(--vn-muted)] mt-0.5">
                    {subscriptionNudge.count} subscription{subscriptionNudge.count > 1 ? "s" : ""} worth reviewing — {formatMoney(subscriptionNudge.totalMonthly)}/month
                  </div>
                </div>
                <Link href="/insights" className="vn-btn vn-btn-ghost text-xs whitespace-nowrap">Review →</Link>
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
                  End: {formatMoney(endingBalance)}
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

      {showSetup && (
        <OnboardingWizard onComplete={handleQuickSetupComplete} />
      )}
    </main>
  );
}
