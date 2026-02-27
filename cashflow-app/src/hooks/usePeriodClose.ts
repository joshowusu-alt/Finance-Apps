import { useState } from "react";
import type { Plan, Period } from "@/data/plan";
import { savePlan } from "@/lib/storage";

interface UsePeriodCloseParams {
  plan: Plan;
  period: Period;
  endingBalance: number;
  /** Income − spending − savings for the period; positive value triggers confetti. */
  actualLeftover: number;
}

/**
 * Manages all state and the mutation for closing the current budget period.
 *
 * - Tracks the modal open/closed state (`showClosePeriod`)
 * - Tracks whether the ending balance should carry forward (`carryForward`)
 * - Triggers the confetti burst when the period ends with a surplus (`showConfetti`)
 * - Exposes `doClose()` which advances the plan to the next period
 */
export function usePeriodClose({
  plan,
  period,
  endingBalance,
  actualLeftover,
}: UsePeriodCloseParams) {
  const [showClosePeriod, setShowClosePeriod] = useState(false);
  const [carryForward, setCarryForward] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  function doClose() {
    const nextPeriod = plan.periods.find((p) => p.id === period.id + 1);
    if (!nextPeriod) return;

    const newStartBalance = carryForward ? endingBalance : plan.setup.startingBalance;
    const existingIdx = plan.periodOverrides.findIndex(
      (o) => o.periodId === nextPeriod.id
    );
    const newOverrides =
      existingIdx >= 0
        ? plan.periodOverrides.map((o, i) =>
            i === existingIdx ? { ...o, startingBalance: newStartBalance } : o
          )
        : [
            ...plan.periodOverrides,
            { periodId: nextPeriod.id, startingBalance: newStartBalance },
          ];

    const updated = {
      ...plan,
      setup: { ...plan.setup, selectedPeriodId: nextPeriod.id },
      periodOverrides: newOverrides,
    };

    savePlan(updated);
    setShowClosePeriod(false);
    if (actualLeftover >= 0) setShowConfetti(true);
  }

  return {
    showClosePeriod,
    setShowClosePeriod,
    carryForward,
    setCarryForward,
    showConfetti,
    setShowConfetti,
    doClose,
  };
}
