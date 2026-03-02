import { useMemo } from "react";
import type { Derived } from "@/lib/derive";
import type { Plan } from "@/data/plan";
import type { ConfidenceResult } from "@/lib/confidence";
import { dayDiff } from "@/lib/dateUtils";

export interface TodayLensData {
  hasData: boolean;
  tier: string;
  projectedEndBalance: number;
  tightestDay: { date: string; balance: number };
  /** How many £ per week to reduce to return to budget pace. 0 if on track. */
  weeklyTargetReduction: number;
}

export function useTodayLens(
  derived: Derived,
  plan: Plan,
  confidence: ConfidenceResult
): TodayLensData {
  return useMemo(() => {
    const hasData =
      plan.incomeRules.length > 0 ||
      plan.bills.length > 0 ||
      plan.transactions.length > 0 ||
      plan.setup.startingBalance > 0;

    // Projected end balance — last forecasted daily row
    const rows = derived.cashflow.daily;
    const projectedEndBalance = rows.length ? rows[rows.length - 1].balance : 0;

    // Tightest day — already computed by derive engine
    const tightestDay = derived.cashflow.lowest;

    // Spending pace gap → weekly target reduction
    const periodDays = dayDiff(derived.period.start, derived.period.end) + 1;
    const daysElapsed = Math.min(
      Math.max(dayDiff(derived.period.start, plan.setup.asOfDate) + 1, 0),
      periodDays
    );

    const budgetSpending = Math.max(
      0,
      derived.totals.committedBills +
        derived.totals.allocationsTotal -
        derived.savingsHealth.savingsThisPeriod
    );

    const actualSpending = plan.transactions
      .filter(
        (t) =>
          t.date >= derived.period.start &&
          t.date <= derived.period.end &&
          t.type === "outflow" &&
          t.category !== "savings"
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const targetDailyRate = periodDays > 0 ? budgetSpending / periodDays : 0;
    const actualDailyRate = daysElapsed > 0 ? actualSpending / daysElapsed : 0;
    const weeklyTargetReduction = Math.max(
      0,
      Math.round((actualDailyRate - targetDailyRate) * 7)
    );

    return {
      hasData,
      tier: confidence.status,
      projectedEndBalance,
      tightestDay,
      weeklyTargetReduction,
    };
  }, [derived, plan, confidence]);
}
