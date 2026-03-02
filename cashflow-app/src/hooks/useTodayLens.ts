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

    // Weekly target reduction — SSOT from derived.spendingPace, no time-based comparison
    const periodDays = dayDiff(derived.period.start, derived.period.end) + 1;
    const daysElapsed = Math.min(
      Math.max(dayDiff(derived.period.start, plan.setup.asOfDate) + 1, 0),
      periodDays
    );
    const { varianceToExpected, paceStatus: spPaceStatus } = derived.spendingPace;
    const daysRemaining = Math.max(1, periodDays - daysElapsed);
    const weeksRemaining = Math.max(1, daysRemaining / 7);
    const weeklyTargetReduction = spPaceStatus === "running-ahead"
      ? Math.max(0, Math.round(varianceToExpected / weeksRemaining))
      : 0;

    return {
      hasData,
      tier: confidence.status,
      projectedEndBalance,
      tightestDay,
      weeklyTargetReduction,
    };
  }, [derived, plan, confidence]);
}
