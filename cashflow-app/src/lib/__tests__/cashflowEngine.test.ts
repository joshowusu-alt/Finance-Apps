import { describe, it, expect } from "vitest";
import { generateEvents, buildTimeline, minPoint, getStartingBalance, getSavingsTransferReconciliation } from "../cashflowEngine";
import { deriveApp } from "@/lib/derive";
import { PLAN, SAMPLE_PLAN, PLAN_VERSION, Plan } from "@/data/plan";

type PlanPatch = Omit<Partial<Plan>, "setup"> & { setup?: Partial<Plan["setup"]> };

function buildPlan(partial: PlanPatch): Plan {
  return {
    ...SAMPLE_PLAN,
    ...partial,
    version: PLAN_VERSION,
    setup: { ...SAMPLE_PLAN.setup, ...partial.setup },
    periods: partial.periods ?? SAMPLE_PLAN.periods,
    incomeRules: partial.incomeRules ?? [],
    outflowRules: partial.outflowRules ?? [],
    bills: partial.bills ?? [],
    periodOverrides: partial.periodOverrides ?? [],
    eventOverrides: partial.eventOverrides ?? [],
    overrides: partial.overrides ?? [],
    transactions: partial.transactions ?? [],
  };
}

// ── Monthly scheduling ──────────────────────────────────────────────

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

// ── Weekly / biweekly scheduling ────────────────────────────────────

describe("cashflowEngine weekly and biweekly scheduling", () => {
  it("generates weekly income events within the period", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      incomeRules: [
        {
          id: "weekly-pay",
          label: "Weekly freelance",
          amount: 200,
          cadence: "weekly",
          seedDate: "2026-02-01",
          enabled: true,
        },
      ],
    });

    const events = generateEvents(plan, 1).filter((e) => e.type === "income");
    // Feb 1, 8, 15, 22 = 4 weekly events in a 28-day February
    expect(events).toHaveLength(4);
    expect(events.map((e) => e.date)).toEqual([
      "2026-02-01",
      "2026-02-08",
      "2026-02-15",
      "2026-02-22",
    ]);
  });

  it("generates biweekly income events within the period", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      incomeRules: [
        {
          id: "biweekly-pay",
          label: "Biweekly salary",
          amount: 1500,
          cadence: "biweekly",
          seedDate: "2026-02-01",
          enabled: true,
        },
      ],
    });

    const events = generateEvents(plan, 1).filter((e) => e.type === "income");
    // Feb 1 and Feb 15 = 2 biweekly events
    expect(events).toHaveLength(2);
    expect(events[0].date).toBe("2026-02-01");
    expect(events[1].date).toBe("2026-02-15");
  });
});

// ── Cross-period spanning month boundary ────────────────────────────

describe("cashflowEngine cross-month period", () => {
  it("handles a period spanning month boundaries correctly", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-01-25", end: "2026-02-24" }],
      incomeRules: [
        {
          id: "salary",
          label: "Salary",
          amount: 3000,
          cadence: "monthly",
          seedDate: "2026-01-28",
          enabled: true,
        },
      ],
      bills: [
        {
          id: "rent",
          label: "Rent",
          amount: 1200,
          dueDay: 1,
          category: "bill",
          enabled: true,
        },
      ],
    });

    const events = generateEvents(plan, 1);
    const incomes = events.filter((e) => e.type === "income");
    const bills = events.filter((e) => e.sourceId === "rent");

    // Salary: Jan 28 and Feb 28 — but Feb 28 > period end (Feb 24), so only Jan 28
    expect(incomes).toHaveLength(1);
    expect(incomes[0].date).toBe("2026-01-28");

    // Rent due day 1: Jan 1 not in period (starts Jan 25), Feb 1 is in period
    expect(bills).toHaveLength(1);
    expect(bills[0].date).toBe("2026-02-01");
  });
});

// ── Savings reconciliation ──────────────────────────────────────────

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

// ── deriveApp tests ─────────────────────────────────────────────────

describe("deriveApp", () => {
  it("computes lowest balance and days below minimum", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, startingBalance: 100, expectedMinBalance: 50, rollForwardBalance: false },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-03" }],
      outflowRules: [
        {
          id: "rent",
          label: "Rent",
          amount: 80,
          cadence: "monthly",
          seedDate: "2026-02-01",
          category: "other",
          enabled: true,
        },
      ],
    });

    const derived = deriveApp(plan);
    expect(derived.cashflow.lowest.balance).toBe(20);
    expect(derived.cashflow.daysBelowMin).toBe(3);
  });

  it("does not flag below-min days when expectedMinBalance is 0", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, startingBalance: 100, expectedMinBalance: 0, rollForwardBalance: false },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-03" }],
      outflowRules: [
        {
          id: "rent",
          label: "Rent",
          amount: 80,
          cadence: "monthly",
          seedDate: "2026-02-01",
          category: "other",
          enabled: true,
        },
      ],
    });

    const derived = deriveApp(plan);
    expect(derived.cashflow.daysBelowMin).toBe(0);
    expect(derived.cashflow.daily.every((day) => !day.belowMin)).toBe(true);
  });

  it("uses Remaining After Plan as leftover label", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-03" }],
    });

    const derived = deriveApp(plan);
    expect(derived.savingsHealth.leftoverLabel).toBe("Remaining After Plan");
  });

  // ── New tests below ──

  it("reports At Risk when balance goes negative", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, startingBalance: 50, expectedMinBalance: 100, rollForwardBalance: false },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-03" }],
      outflowRules: [
        {
          id: "big-bill",
          label: "Big bill",
          amount: 200,
          cadence: "monthly",
          seedDate: "2026-02-01",
          category: "other",
          enabled: true,
        },
      ],
    });

    const derived = deriveApp(plan);
    expect(derived.cashflow.lowest.balance).toBe(-150);
    expect(derived.health.label).toBe("At Risk");
    expect(derived.health.reason).toContain("goes negative");
  });

  it("reports Watch when below minimum but not negative", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, startingBalance: 500, expectedMinBalance: 400, rollForwardBalance: false },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-03" }],
      outflowRules: [
        {
          id: "groceries",
          label: "Groceries",
          amount: 200,
          cadence: "monthly",
          seedDate: "2026-02-01",
          category: "other",
          enabled: true,
        },
      ],
    });

    const derived = deriveApp(plan);
    expect(derived.cashflow.lowest.balance).toBe(300);
    expect(derived.health.label).toBe("Watch");
    expect(derived.health.reason).toContain("dips below your minimum");
  });

  it("reports Healthy when balance stays above minimum", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, startingBalance: 1000, expectedMinBalance: 100, rollForwardBalance: false },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-03" }],
      incomeRules: [
        {
          id: "pay",
          label: "Pay",
          amount: 500,
          cadence: "monthly",
          seedDate: "2026-02-01",
          enabled: true,
        },
      ],
    });

    const derived = deriveApp(plan);
    expect(derived.health.label).toBe("Healthy");
    expect(derived.health.reason).toContain("stays above your minimum");
  });

  it("computes Remaining After Plan correctly", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, startingBalance: 0, rollForwardBalance: false },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      incomeRules: [
        { id: "salary", label: "Salary", amount: 3000, cadence: "monthly", seedDate: "2026-02-01", enabled: true },
      ],
      bills: [
        { id: "rent", label: "Rent", amount: 1200, dueDay: 1, category: "bill", enabled: true },
      ],
      outflowRules: [
        { id: "savings", label: "Savings", amount: 300, cadence: "monthly", seedDate: "2026-02-15", category: "savings", enabled: true },
        { id: "allowance", label: "Allowance", amount: 200, cadence: "monthly", seedDate: "2026-02-08", category: "allowance", enabled: true },
      ],
    });

    const derived = deriveApp(plan);
    // Remaining = income - bills - allocations = 3000 - 1200 - (300 + 200) = 1300
    expect(derived.totals.incomeExpected).toBe(3000);
    expect(derived.totals.committedBills).toBe(1200);
    expect(derived.totals.allocationsTotal).toBe(500);
    expect(derived.totals.remaining).toBe(1300);
    expect(derived.savingsHealth.leftoverValue).toBe(1300);
  });

  it("negative Remaining After Plan with low starting balance causes At Risk", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, startingBalance: 100, expectedMinBalance: 200, rollForwardBalance: false },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      incomeRules: [
        { id: "salary", label: "Salary", amount: 1000, cadence: "monthly", seedDate: "2026-02-15", enabled: true },
      ],
      bills: [
        { id: "rent", label: "Rent", amount: 800, dueDay: 1, category: "bill", enabled: true },
      ],
      outflowRules: [
        { id: "savings", label: "Savings", amount: 300, cadence: "monthly", seedDate: "2026-02-20", category: "savings", enabled: true },
      ],
    });

    const derived = deriveApp(plan);
    // Remaining = 1000 - 800 - 300 = -100 (negative)
    expect(derived.totals.remaining).toBe(-100);
    // Starting 100, rent 800 on day 1 → balance drops to -700 → At Risk
    expect(derived.health.label).toBe("At Risk");
  });

  it("handles user with no starting balance and expectedMinBalance set", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, startingBalance: 0, expectedMinBalance: 500, rollForwardBalance: false },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-03" }],
    });

    const derived = deriveApp(plan);
    // Balance starts at 0, never rises — all days below 500
    expect(derived.cashflow.daysBelowMin).toBe(3);
    expect(derived.health.label).toBe("Watch");
    expect(derived.flags.hasStartingBalance).toBe(false);
  });

  it("savings streak is 0 for users with no history", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      transactions: [],
    });

    const derived = deriveApp(plan);
    expect(derived.savingsHealth.streak).toBe(0);
    expect(derived.savingsHealth.streakExplanation).toContain("Complete a period");
  });
});

// ── buildTimeline running balance ───────────────────────────────────

describe("buildTimeline", () => {
  it("computes deterministic running balance", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, expectedMinBalance: 0 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-03" }],
      incomeRules: [
        { id: "pay", label: "Pay", amount: 100, cadence: "monthly", seedDate: "2026-02-01", enabled: true },
      ],
      outflowRules: [
        { id: "sub", label: "Sub", amount: 30, cadence: "monthly", seedDate: "2026-02-02", category: "other", enabled: true },
      ],
    });

    const rows = buildTimeline(plan, 1, 500);
    // Day 1: 500 + 100 = 600
    expect(rows[0].balance).toBe(600);
    expect(rows[0].income).toBe(100);
    // Day 2: 600 - 30 = 570
    expect(rows[1].balance).toBe(570);
    expect(rows[1].outflow).toBe(30);
    // Day 3: no events = 570
    expect(rows[2].balance).toBe(570);
  });

  it("warning field respects expectedMinBalance=0 guard (C2 fix)", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, startingBalance: -10, expectedMinBalance: 0, rollForwardBalance: false },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-01" }],
    });

    const rows = buildTimeline(plan, 1, -10);
    // Balance is -10 but expectedMin is 0, so warning should be false
    expect(rows[0].balance).toBe(-10);
    expect(rows[0].warning).toBe(false);
  });
});

// ── getStartingBalance with rollForward ─────────────────────────────

describe("getStartingBalance with rollForward", () => {
  it("chains balance from previous period", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 2, startingBalance: 1000, rollForwardBalance: true },
      periods: [
        { id: 1, label: "P1", start: "2026-01-01", end: "2026-01-31" },
        { id: 2, label: "P2", start: "2026-02-01", end: "2026-02-28" },
      ],
      outflowRules: [
        { id: "rent", label: "Rent", amount: 400, cadence: "monthly", seedDate: "2026-01-15", category: "bill", enabled: true },
      ],
    });

    const balance = getStartingBalance(plan, 2);
    // P1 starts with 1000, rent of 400 → ends at 600
    expect(balance).toBe(600);
  });
});
