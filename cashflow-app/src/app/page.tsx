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

function toneClass(tone?: SummaryTone) {
  if (tone === "good") return "text-emerald-600";
  if (tone === "bad") return "text-rose-600";
  return "text-slate-900";
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
    <div className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-white/70 p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">{item.label}</div>
            <div className={`mt-2 text-xl font-semibold ${toneClass(item.tone)}`}>{item.value}</div>
            {item.hint ? <div className="mt-1 text-xs text-slate-500">{item.hint}</div> : null}
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
  const [alertPrefs, setAlertPrefs] = useState(() => loadAlertPreferences());

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

  function handleToggleTask(id: string, done: boolean) {
    setOnboarding(setOnboardingTask(id, done));
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-6">
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

          <section className="space-y-5">
            <header className="flex flex-col gap-4 rounded-3xl bg-[var(--surface)] p-6 text-slate-900 shadow-xl md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Dashboard</div>
                <h1 className="text-2xl font-semibold">Welcome back</h1>
                <div className="mt-2 text-sm text-slate-500">
                  Your money story for this period.
                </div>
                <div className="mt-1 text-xs text-slate-400">{period.label}</div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full bg-slate-100 px-4 py-2 text-xs text-slate-600">
                  Window {windowData.startISO} to {windowData.endISO}
                </div>
                <Link
                  href="/transactions"
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow"
                >
                  Add Transaction
                </Link>
              </div>
            </header>

            {!onboarding.dismissed ? (
              <div className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Getting started</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {completedCount} of {onboardingTasks.length} steps done
                    </div>
                  </div>
                  <button
                    onClick={handleDismissOnboarding}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="mt-3 text-sm text-slate-600">
                  {isFirstUse
                    ? "Explore the sample plan, or clear it to build your own."
                    : "Keep momentum with a quick checklist and tips."}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={handleStartFresh}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[var(--accent-deep)]"
                  >
                    Start fresh
                  </button>
                  <button
                    onClick={handleLoadSampleData}
                    className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
                  >
                    Load sample data
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {onboardingTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-white/70 px-4 py-3"
                    >
                      <label className="flex flex-1 items-start gap-3">
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={(e) => handleToggleTask(task.id, e.target.checked)}
                          disabled={task.autoDone}
                          className="mt-1"
                        />
                        <span>
                          <div className="text-sm font-semibold text-slate-900">{task.label}</div>
                          <div className="text-xs text-slate-500">{task.description}</div>
                        </span>
                      </label>
                      <Link
                        href={task.href}
                        className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-deep)]"
                      >
                        Open
                      </Link>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
                  Tips: update your period dates, set a safe minimum balance, and log your first
                  real transaction to unlock insights.
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Onboarding hidden</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Bring back the setup checklist any time.
                    </div>
                  </div>
                  <button
                    onClick={handleShowOnboarding}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
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

            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-5">
                <div className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
                  <div className="text-sm font-semibold text-slate-800">Story so far</div>
                  <div className="mt-3 space-y-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Time into period</span>
                      <span className="font-semibold text-slate-900">
                        Day {daysElapsed} of {periodDays}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-[var(--accent)]"
                        style={{ width: `${timeProgress * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Spending used</span>
                      <span className="font-semibold text-slate-900">
                        {money(actualSpending)} of {money(budgetSpending)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div
                        className={`h-2 rounded-full ${actualSpending > budgetSpending ? "bg-rose-500" : "bg-emerald-500"}`}
                        style={{ width: `${spendingProgress * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Income received</span>
                      <span className="font-semibold text-slate-900">
                        {money(actualIncome)} of {money(budgetIncome)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div
                        className={`h-2 rounded-full ${incomePaceGap < -0.08 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${incomeProgress * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Savings moved</span>
                      <span className="font-semibold text-slate-900">
                        {money(actualSavings)} of {money(budgetSavings)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div
                        className={`h-2 rounded-full ${actualSavings < budgetSavings ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${savingsProgress * 100}%` }}
                      />
                    </div>

                    <div className="rounded-2xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
                      Projected end balance: <span className="font-semibold text-slate-900">{money(endingBalance)}</span>.{" "}
                      Lowest point {lowest ? `${money(lowest.balance)} on ${prettyDate(lowest.date)}` : "-"}.
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                      <div className="text-sm font-semibold text-slate-800">Story insights</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        {storyInsights.map((insight, idx) => (
                          <div key={`insight-${idx}`} className="flex gap-2">
                            <span className="text-slate-400">-</span>
                            <span>{insight}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="space-y-5">
                <div className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-800">Alerts & notifications</div>
                    <Link href="/settings" className="text-xs text-slate-500 hover:text-slate-700">
                      Manage
                    </Link>
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    {alerts.length === 0 ? (
                      <div className="text-xs text-slate-500">
                        Alerts are disabled. Enable them in Settings to see notices.
                      </div>
                    ) : (
                      alerts.map((alert) => {
                        const toneClass =
                          alert.tone === "critical"
                            ? "text-rose-600"
                            : alert.tone === "warning"
                              ? "text-amber-600"
                              : alert.tone === "good"
                                ? "text-emerald-600"
                                : "text-slate-700";
                        return (
                          <div
                            key={alert.id}
                            className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3"
                          >
                            <div className={`text-sm font-semibold ${toneClass}`}>{alert.title}</div>
                            <div className="mt-1 text-xs text-slate-500">{alert.description}</div>
                            {alert.href ? (
                              <Link
                                href={alert.href}
                                className="mt-2 inline-flex text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-deep)]"
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
                <div className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-800">Upcoming income</div>
                    <Link href="/income" className="text-xs text-slate-500 hover:text-slate-700">
                      View all
                    </Link>
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    {upcomingIncome.length === 0 ? (
                      <div className="text-slate-500">No income in window.</div>
                    ) : (
                      upcomingIncome.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-900">{item.label}</div>
                            <div className="text-xs text-slate-500">Due {prettyDate(item.date)}</div>
                          </div>
                          <div className="font-semibold text-[var(--accent)]">{money(item.amount)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-800">Upcoming bills</div>
                    <Link href="/bills" className="text-xs text-slate-500 hover:text-slate-700">
                      View all
                    </Link>
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    {upcomingBills.length === 0 ? (
                      <div className="text-slate-500">No bills in window.</div>
                    ) : (
                      upcomingBills.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-900">{item.label}</div>
                            <div className="text-xs text-slate-500">Due {prettyDate(item.date)}</div>
                          </div>
                          <div className="font-semibold text-[var(--red-accent)]">{money(item.amount)}</div>
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
    </main>
  );
}
