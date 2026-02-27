"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useSpring, useTransform, AnimatePresence, type Variants } from "framer-motion";
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
import SidebarNav from "@/components/SidebarNav";
import { formatMoney } from "@/lib/currency";
import { VelanovoLogo } from "@/components/VelanovoLogo";
import ThemeToggle from "@/components/ThemeToggle";
import { CashflowProjectionChart } from "@/components/charts";
import { TransactionsWidget } from "@/components/dashboard/TransactionsWidget";
import { BillsWidget } from "@/components/dashboard/BillsWidget";
import InfoTooltip from "@/components/InfoTooltip";
import { useDerived } from "@/lib/useDerived";
import { dayDiff } from "@/lib/dateUtils";
import SpendingVelocityGauge from "@/components/SpendingVelocityGauge";
import WhatIfPanel from "@/components/WhatIfPanel";
import GoalRings from "@/components/GoalRings";
import DebtPayoffPlanner from "@/components/DebtPayoffPlanner";
import ConfettiBurst from "@/components/ConfettiBurst";
import AnomalyAlerts from "@/components/AnomalyAlerts";
import { useDashboard } from "@/hooks/useDashboard";
import { usePeriodClose } from "@/hooks/usePeriodClose";
import { PeriodCloseModal } from "@/components/dashboard/PeriodCloseModal";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { SubscriptionNudge } from "@/components/dashboard/SubscriptionNudge";



function formatPeriodLabel(label: string) {
  return label.replace(/^P(\d+)/, "Period $1");
}

// ---------------------------------------------------------------------------
// Animated money counter — smoothly counts to the new value on change
// ---------------------------------------------------------------------------
function AnimatedMoney({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(value, { stiffness: 70, damping: 18, mass: 0.6 });
  useEffect(() => { spring.set(value); }, [value, spring]);
  const display = useTransform(spring, (v) => formatMoney(Math.round(v)));
  return <motion.span className={className}>{display}</motion.span>;
}

// ---------------------------------------------------------------------------
// Stagger variants — used for section + card entrances
// ---------------------------------------------------------------------------
const sectionStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] } },
};




export default function HomePage() {
  const { state: plan, derived } = useDerived();
  const [onboarding, setOnboarding] = useState(() => loadOnboardingState());
  const [isFirstVisit, setIsFirstVisit] = useState(() => !hasStoredPlan());
  const [showSetup, setShowSetup] = useState(() => !hasStoredPlan() && !loadWizardState().completed);
  const [mounted, setMounted] = useState(false);
  const [mountTime] = useState(() => Date.now());

  useEffect(() => { setMounted(true); }, []);

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

  // Auto-complete onboarding tasks derived from plan — pure computation, no side effects
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
    return changed ? { ...current, completed } : current;
  }, [plan, onboarding]);

  // Persist onboarding state whenever auto-completion produces a new object
  useEffect(() => {
    saveOnboardingState(resolvedOnboarding);
  }, [resolvedOnboarding]);

  // --- Data derivation (delegate to hook) ----------------------------------
  const {
    recentTransactions,
    actuals,
    upcomingBills,
    cashflowChartData,
    categoryItems,
    activeGoals,
    liabilityAccounts,
    subscriptionNudge,
    spendingAnomalies,
  } = useDashboard(plan, derived);

  const { income: actualIncome, spending: actualSpending, savings: actualSavings } = actuals;
  const actualLeftover = actualIncome - actualSpending - actualSavings;

  // --- Period & budget scalars ---------------------------------------------
  const period = derived.period;
  const rows = derived.cashflow.daily;
  const endingBalance = rows.length ? rows[rows.length - 1].balance : 0;

  const budgetOutflows = derived.totals.committedBills + derived.totals.allocationsTotal;
  const budgetSavings = derived.savingsHealth.savingsThisPeriod;
  const budgetSpending = budgetOutflows - budgetSavings;

  const periodDays = dayDiff(period.start, period.end) + 1;
  const daysElapsedRaw = dayDiff(period.start, plan.setup.asOfDate) + 1;
  const daysElapsed = Math.min(Math.max(daysElapsedRaw, 0), periodDays);
  const timeProgress = periodDays ? Math.min(1, daysElapsed / periodDays) : 0;
  const spendingProgress = budgetSpending ? Math.min(1, actualSpending / budgetSpending) : 0;
  const spendingPaceGap = spendingProgress - timeProgress;
  const daysRemaining = Math.max(0, periodDays - daysElapsed);

  // --- Period-close state (delegate to hook) --------------------------------
  const {
    showClosePeriod,
    setShowClosePeriod,
    carryForward,
    setCarryForward,
    showConfetti,
    setShowConfetti,
    doClose,
  } = usePeriodClose({ plan, period, endingBalance, actualLeftover });

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

  // Empty state detection — no plan data set up yet
  const hasData =
    plan.incomeRules.length > 0 ||
    plan.bills.length > 0 ||
    plan.transactions.length > 0 ||
    plan.setup.startingBalance > 0;

  const showDay1Banner = useMemo(() => {
    const w = loadWizardState();
    if (!w.completed || !w.completedAt) return false;
    const ageMs = mountTime - new Date(w.completedAt).getTime();
    if (ageMs > 3 * 24 * 60 * 60 * 1000) return false;
    return plan.transactions.length === 0;
  }, [plan.transactions.length, mountTime]);

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

  // Render shimmer skeleton on first client paint to avoid flash of unstyled content
  if (!mounted) {
    return (
      <main className="min-h-screen w-full max-w-full overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-40 pt-5">
          <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
            {/* Sidebar placeholder */}
            <div className="hidden lg:block" />
            <div className="space-y-5">
              {/* Masthead */}
              <div className="vn-masthead h-48 animate-pulse" style={{ background: "var(--vn-surface-raised)" }} />
              {/* Cards */}
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="vn-card p-6 animate-pulse"
                  style={{ height: 120, background: "var(--vn-surface-raised)" }}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-40 pt-5">
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

          <motion.section
            className="space-y-6"
            variants={sectionStagger}
            initial="hidden"
            animate="visible"
          >
            <motion.header variants={fadeUp} className="vn-masthead flex flex-col gap-4">

              {/* Gold glow accent top-right */}
              <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, rgba(197,160,70,0.14) 0%, transparent 70%)", transform: "translate(30%, -40%)" }} />

              <div className="flex flex-col md:flex-row md:items-center md:justify-between relative z-10">
                <div className="lg:hidden mb-2">
                  <VelanovoLogo size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-white/90" style={{ fontFamily: "var(--font-playfair, serif)" }}>Dashboard</h1>
                  <div className="mt-1 text-sm text-white/45">
                    {formatPeriodLabel(period.label)} Overview
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3 md:mt-0">
                  <ThemeToggle />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowClosePeriod(true)}
                      className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                      style={{ color: "rgba(240,237,232,0.65)", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      Close Period
                    </button>
                    <InfoTooltip text="Use this once the period is over and all transactions are entered. It locks in your real ending balance and advances you to the next period so your forecast stays accurate." />
                  </div>
                  <Link
                    href="/transactions"
                    className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-all hover:brightness-110"
                    style={{ background: "linear-gradient(135deg, #C5A046, #D4AF5A)", color: "#111318", boxShadow: "0 2px 12px rgba(197,160,70,0.30)" }}
                  >
                    <span className="mr-1.5">+</span> Add Transaction
                  </Link>
                </div>
              </div>

              {/* Hero Metric */}
              <div className="p-5 rounded-2xl mt-6 relative z-10" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(4px)" }}>
                {!hasData ? (
                  <div className="text-center py-2">
                    <div className="text-3xl mb-2">📊</div>
                    <div className="text-sm font-semibold text-white/80">Set up your plan to get started</div>
                    <div className="text-xs mt-1 mb-3" style={{ color: "rgba(240,237,232,0.45)" }}>Add income, bills, or a starting balance to see your cashflow</div>
                    <button onClick={() => setShowSetup(true)} className="vn-btn vn-btn-primary text-xs px-4 py-2">
                      Quick Setup
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-xs uppercase tracking-widest font-semibold mb-1 flex items-center gap-1" style={{ color: "var(--gold)", letterSpacing: "0.12em" }}>Safe to Spend<InfoTooltip text="Income received this period minus spending and savings. This is how much you can still spend without going over budget." /></div>
                    <AnimatedMoney value={actualLeftover} className={`text-4xl font-semibold tabular-nums ${actualLeftover > 0 ? "text-emerald-300" : "text-red-400"}`} />
                    <div className="text-xs mt-1" style={{ color: "rgba(240,237,232,0.45)" }}>Leftover from income this period</div>
                    {actualIncome === 0 && plan.incomeRules.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-300">
                        <span>⚠</span>
                        <span>No income recorded yet — add an income transaction to see your true safe-to-spend</span>
                      </div>
                    )}

                    {/* Spending pace bar */}
                    {timeProgress > 0.02 && budgetSpending > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: "rgba(240,237,232,0.45)" }}>
                          <span className="flex items-center gap-1">Spending pace<InfoTooltip text="The blue bar shows how much of your budget you've spent. The grey bar shows how far through the period you are. If blue exceeds grey, you're spending faster than time is passing." /></span>
                          <span className={spendingPaceGap > 0.08 ? "text-rose-400 font-semibold" : spendingPaceGap < -0.08 ? "text-emerald-300 font-semibold" : ""} style={!(spendingPaceGap > 0.08) && !(spendingPaceGap < -0.08) ? { color: "rgba(240,237,232,0.45)" } : undefined}>
                            {spendingPaceGap > 0.08 ? "Spending high" : spendingPaceGap < -0.08 ? "Under budget ✓" : "On track"}
                          </span>
                        </div>
                        <div className="relative h-2 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }}>
                          {/* Time elapsed bar (background) */}
                          <div className="absolute inset-y-0 left-0 rounded-full bg-(--vn-border)" style={{ width: `${Math.round(timeProgress * 100)}%` }} />
                          {/* Spending progress bar (foreground — animated fill) */}
                          <motion.div
                            className={`absolute inset-y-0 left-0 rounded-full`}
                            style={{ background: spendingPaceGap > 0.08 ? "rgba(184,92,92,0.9)" : spendingPaceGap < -0.08 ? "rgba(79,175,123,0.9)" : "#5DA9E9" }}
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: `${Math.min(100, Math.round(spendingProgress * 100))}%`, opacity: 0.85 }}
                            transition={{ duration: 1.1, ease: "easeOut", delay: 0.25 }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] mt-1" style={{ color: "rgba(240,237,232,0.38)" }}>
                          <span>{Math.round(spendingProgress * 100)}% spent</span>
                          <span>{Math.round(timeProgress * 100)}% of period</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          derived.health.label === "Healthy"
                          ? "bg-emerald-900/30 text-emerald-300"
                          : derived.health.label === "Watch"
                            ? "bg-amber-900/30 text-amber-300"
                            : "bg-red-900/30 text-red-300"
                        }`}>
                        {derived.health.label}
                      </span>
                      <span className="text-xs" style={{ color: "rgba(240,237,232,0.5)" }}>{derived.health.reason}</span>
                      <InfoTooltip text="Your financial health score: Healthy = spending well within budget; Watch = nearing limits; Caution = over-budget or savings at risk." />
                    </div>
                  </>
                )}
              </div>
            </motion.header>

            {/* Day-1 quick-start banner */}
            {showDay1Banner && (
              <motion.div variants={fadeUp} className="vn-card p-5">
                <div className="text-sm font-bold text-(--vn-text) mb-0.5">Your plan is ready — log your first transactions</div>
                <div className="text-xs text-(--vn-muted) mb-4">Add income, a bill payment, or import a bank export to start tracking against your budget.</div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: "Log income", href: "/transactions", icon: "M12 4v16m8-8H4", color: "var(--vn-success)" },
                    { label: "Log payment", href: "/transactions", icon: "M20 12H4", color: "var(--vn-error)" },
                    { label: "Import CSV", href: "/transactions", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12", color: "var(--accent)" },
                  ].map((c) => (
                    <Link key={c.label} href={c.href}
                      className="rounded-xl p-3 text-center transition-opacity hover:opacity-80"
                      style={{ background: "var(--vn-bg)", border: "1px solid var(--vn-border)" }}
                    >
                      <div
                        className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ background: `color-mix(in srgb, ${c.color} 12%, transparent)` }}
                      >
                        <svg className="h-4 w-4" style={{ color: c.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d={c.icon} />
                        </svg>
                      </div>
                      <div className="text-xs font-semibold" style={{ color: "var(--vn-text)" }}>{c.label}</div>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Onboarding checklist */}
            {!resolvedOnboarding.dismissed && (
              <motion.div variants={fadeUp} className="vn-card p-6 border-l-4 border-l-(--vn-primary)">
                <OnboardingChecklist
                  onboardingTasks={onboardingTasks}
                  completedCount={completedCount}
                  isFirstVisit={isFirstVisit}
                  onDismiss={handleDismissOnboarding}
                  onLoadSampleData={handleLoadSampleData}
                  onSetup={() => setShowSetup(true)}
                  onToggleTask={handleToggleTask}
                />
              </motion.div>
            )}

            {/* Subscription nudge */}
            {subscriptionNudge && (
              <motion.div variants={fadeUp} className="vn-card p-4 border-l-4 border-l-amber-400">
                <SubscriptionNudge count={subscriptionNudge.count} totalMonthly={subscriptionNudge.totalMonthly} />
              </motion.div>
            )}

            {/* Visual Hero: Projection */}
            <motion.div variants={fadeUp} className="vn-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-(--vn-text)">Cashflow Forecast</div>
                  <div className="text-xs text-(--vn-muted) mb-1">Projected balance for next 30 days</div>
                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[10px] text-(--vn-muted)">
                      <span className="inline-block w-6 h-0.5 bg-(--vn-primary) rounded" />
                      Budget (Planned)
                    </span>
                    {derived.cashflow.actualsDaily.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-(--vn-muted)">
                        <span className="inline-block w-6 h-0.5 border-t-2 border-dashed border-(--vn-secondary)" />
                        Actuals (Recorded)
                      </span>
                    )}
                    {(plan.setup.expectedMinBalance ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-rose-500">
                        <span className="inline-block w-6 h-0 border-t-2 border-dashed border-rose-500" />
                        Min balance
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs font-bold px-2 py-1 rounded bg-(--vn-bg) text-(--vn-text)">
                  End: {formatMoney(endingBalance)}
                </div>
              </div>

              <div className="h-[250px] w-full">
                <CashflowProjectionChart
                  data={cashflowChartData}
                  showProjection={derived.cashflow.actualsDaily.length > 0}
                  height={250}
                  lowBalanceThreshold={plan.setup.expectedMinBalance}
                />
              </div>
            </motion.div>

            {/* Pointers: Widget Grid */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Transactions Pointer */}
              <motion.div className="h-full" whileHover={{ y: -3, transition: { duration: 0.18 } }}>
                <TransactionsWidget transactions={recentTransactions} />
              </motion.div>

              {/* Bills Pointer */}
              <motion.div className="h-full" whileHover={{ y: -3, transition: { duration: 0.18 } }}>
                <BillsWidget bills={upcomingBills} />
              </motion.div>

              {/* 4. Spending velocity gauge */}
              {daysElapsed > 0 && budgetSpending > 0 && (
                <motion.div className="h-full md:col-span-3" whileHover={{ y: -2, transition: { duration: 0.18 } }}>
                  <SpendingVelocityGauge
                    actualSpend={actualSpending}
                    budgetSpend={budgetSpending}
                    daysElapsed={daysElapsed}
                    periodDays={periodDays}
                    daysRemaining={daysRemaining}
                  />
                </motion.div>
              )}
            </motion.div>

            {/* What-if scenario panel */}
            {categoryItems.length > 0 && (
              <motion.div variants={fadeUp}>
                <WhatIfPanel
                  categories={categoryItems}
                  projectedEndBalance={endingBalance}
                />
              </motion.div>
            )}

            {/* Spending anomalies */}
            {spendingAnomalies.length > 0 && (
              <motion.div variants={fadeUp}>
                <AnomalyAlerts anomalies={spendingAnomalies} />
              </motion.div>
            )}

            {/* Goal progress rings */}
            {activeGoals.length > 0 && (
              <motion.div variants={fadeUp}>
                <GoalRings goals={activeGoals} transactions={plan.transactions} />
              </motion.div>
            )}

            {/* Debt payoff planner */}
            {liabilityAccounts.length > 0 && (
              <motion.div variants={fadeUp}>
                <DebtPayoffPlanner accounts={liabilityAccounts} />
              </motion.div>
            )}

          </motion.section>
        </div>
      </div>

      {showSetup && (
        <OnboardingWizard onComplete={handleQuickSetupComplete} />
      )}

      <AnimatePresence>
        {showConfetti && (
          <ConfettiBurst onDone={() => setShowConfetti(false)} />
        )}
      </AnimatePresence>

      {/* Period-close modal */}
      {showClosePeriod && (
        <PeriodCloseModal
          plan={plan}
          period={period}
          endingBalance={endingBalance}
          actualIncome={actualIncome}
          actualSpending={actualSpending}
          actualSavings={actualSavings}
          actualLeftover={actualLeftover}
          carryForward={carryForward}
          onCarryForwardChange={setCarryForward}
          onClose={() => setShowClosePeriod(false)}
          onConfirm={doClose}
        />
      )}
    </main>
  );
}
