import { describe, it, expect } from "vitest";
import { generateEvents, getSavingsTransferReconciliation } from "../cashflowEngine";
import { PLAN, PLAN_VERSION, Plan } from "@/data/plan";

function buildPlan(partial: Partial<Plan>): Plan {
  return {
    ...PLAN,
    ...partial,
    version: PLAN_VERSION,
    setup: { ...PLAN.setup, ...partial.setup },
    periods: partial.periods ?? PLAN.periods,
    incomeRules: partial.incomeRules ?? [],
    outflowRules: partial.outflowRules ?? [],
    bills: partial.bills ?? [],
    periodOverrides: partial.periodOverrides ?? [],
    eventOverrides: partial.eventOverrides ?? [],
    overrides: partial.overrides ?? [],
    transactions: partial.transactions ?? [],
  };
}

describe("cashflowEngine monthly scheduling", () => {
  it("clamps monthly income to month end", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      incomeRules: [
        {
          id: "pay",
          label: "Pay",
          amount: 100,
          cadence: "monthly",
          seedDate: "2026-01-31",
          enabled: true,
        },
      ],
    });

    const events = generateEvents(plan, 1).filter((e) => e.type === "income");
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2026-02-28");
  });

  it("clamps bill due day to month end", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      bills: [
        {
          id: "bill-1",
          label: "Test Bill",
          amount: 50,
          dueDay: 31,
          category: "bill",
          enabled: true,
        },
      ],
    });

    const events = generateEvents(plan, 1).filter((e) => e.sourceId === "bill-1");
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2026-02-28");
  });
});

describe("cashflowEngine savings reconciliation", () => {
  it("calculates transfer variance against budget", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      outflowRules: [
        {
          id: "savings",
          label: "Savings transfer",
          amount: 200,
          cadence: "monthly",
          seedDate: "2026-02-10",
          category: "savings",
          enabled: true,
        },
      ],
      transactions: [
        {
          id: "txn-1",
          date: "2026-02-10",
          label: "Transfer to savings",
          amount: 150,
          type: "transfer",
          category: "savings",
        },
      ],
    });

    const summary = getSavingsTransferReconciliation(plan, 1);
    expect(summary.budgeted).toBe(200);
    expect(summary.actual).toBe(150);
    expect(summary.variance).toBe(-50);
    expect(summary.status).toBe("under");
  });
});
