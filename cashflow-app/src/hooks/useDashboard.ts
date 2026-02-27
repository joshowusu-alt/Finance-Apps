import { useMemo } from "react";
import type { Plan } from "@/data/plan";
import type { Derived } from "@/lib/derive";
import { getUpcomingEvents, getVarianceByCategory } from "@/lib/cashflowEngine";
import { detectSubscriptions } from "@/lib/subscriptionDetection";
import { detectAnomalies } from "@/lib/anomalyDetection";
import { prettyDate } from "@/lib/formatUtils";
import type { CashflowDataPoint } from "@/components/charts";

export interface DashboardActuals {
  income: number;
  spending: number;
  savings: number;
}

/** Encapsulates all data-derivation memos for the dashboard page. */
export function useDashboard(plan: Plan, derived: Derived) {
  const period = derived.period;

  /** Transactions that fall within the current period, newest-first. */
  const periodTransactions = useMemo(
    () =>
      plan.transactions
        .filter((t) => t.date >= period.start && t.date <= period.end)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [plan, period]
  );

  /** Five most-recent transactions for <TransactionsWidget> (full Transaction objects). */
  const recentTransactions = useMemo(
    () => periodTransactions.slice(0, 5),
    [periodTransactions]
  );

  /**
   * Single-pass computation of income, spending, and savings for the period.
   * Replaces the three separate useMemo calls that each iterated periodTransactions.
   */
  const actuals = useMemo<DashboardActuals>(() => {
    let income = 0;
    let savings = 0;
    let spending = 0;
    for (const t of periodTransactions) {
      if (t.type === "income") {
        income += t.amount;
      } else if (t.category === "savings") {
        savings += t.amount;
      } else if (t.type === "outflow") {
        spending += t.amount;
      }
    }
    return { income, savings, spending };
  }, [periodTransactions]);

  /** Next four upcoming outflow events shaped for <BillsWidget>. */
  const upcomingBills = useMemo(() => {
    const raw = getUpcomingEvents(plan, plan.setup.selectedPeriodId, "outflow").slice(0, 4);
    return raw.map((b) => ({ id: b.id, label: b.label, amount: b.amount, date: b.date }));
  }, [plan]);

  /** Cashflow chart data: 30-day budget line + actuals overlay. */
  const cashflowChartData = useMemo<CashflowDataPoint[]>(() => {
    const rows = derived.cashflow.daily;
    const actualsMap = new Map(
      derived.cashflow.actualsDaily.map((d) => [d.date, d.balance])
    );
    return rows.slice(0, 30).map((row) => ({
      date: prettyDate(row.date),
      balance: row.balance,
      projected: actualsMap.get(row.date),
    }));
  }, [derived.cashflow.daily, derived.cashflow.actualsDaily]);

  /** Per-category budget vs actual items for <WhatIfPanel>. */
  const categoryItems = useMemo(() => {
    const variance = getVarianceByCategory(plan, plan.setup.selectedPeriodId);
    return Object.values(variance)
      .filter((v) => v && v.category !== "income" && v.category !== "savings")
      .map((v) => ({ category: v!.category, budgeted: v!.budgeted, actual: v!.actual }));
  }, [plan]);

  /** Savings goals that are active and have a target amount. */
  const activeGoals = useMemo(
    () =>
      (plan.savingsGoals ?? []).filter(
        (g) => g.status !== "paused" && g.targetAmount > 0
      ),
    [plan]
  );

  /** Liability accounts with a non-zero balance for <DebtPayoffPlanner>. */
  const liabilityAccounts = useMemo(
    () =>
      (plan.netWorthAccounts ?? []).filter(
        (a) =>
          ["credit-card", "loan", "mortgage", "other-liability"].includes(a.type) &&
          a.balance !== 0
      ),
    [plan]
  );

  /** Subscription nudge data, or null if nothing actionable. */
  const subscriptionNudge = useMemo(() => {
    if (plan.transactions.length < 3) return null;
    const subs = detectSubscriptions(plan.transactions);
    const actionable = subs.filter(
      (s) => s.recommendation === "review" || s.recommendation === "cancel"
    );
    if (actionable.length === 0) return null;
    const totalMonthly = actionable.reduce((sum, s) => sum + s.monthlyCost, 0);
    return { count: actionable.length, totalMonthly };
  }, [plan.transactions]);

  /** Spending anomalies detected from the plan. */
  const spendingAnomalies = useMemo(() => detectAnomalies(plan), [plan]);

  return {
    periodTransactions,
    recentTransactions,
    actuals,
    upcomingBills,
    cashflowChartData,
    categoryItems,
    activeGoals,
    liabilityAccounts,
    subscriptionNudge,
    spendingAnomalies,
  };
}
