import { describe, it, expect } from "vitest";
import {
  generateEvents,
  buildTimeline,
  buildHybridTimeline,
  buildActualsTimeline,
  getStartingBalance,
  getSavingsTransferReconciliation,
  getVarianceByCategory,
} from "../cashflowEngine";
import { deriveApp } from "@/lib/derive";
import { SAMPLE_PLAN, PLAN_VERSION, Plan } from "@/data/plan";

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

  it("bills with non-bill categories (e.g. giving) count as committedBills not allocations", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, startingBalance: 0, rollForwardBalance: false },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      incomeRules: [
        { id: "salary", label: "Salary", amount: 5000, cadence: "monthly", seedDate: "2026-02-01", enabled: true },
      ],
      bills: [
        { id: "rent", label: "Rent", amount: 1200, dueDay: 1, category: "bill", enabled: true },
        { id: "tithe", label: "Tithe", amount: 410, dueDay: 1, category: "giving", enabled: true },
        { id: "parents", label: "Parents", amount: 140, dueDay: 1, category: "giving", enabled: true },
      ],
      outflowRules: [
        { id: "savings", label: "Savings", amount: 500, cadence: "monthly", seedDate: "2026-02-15", category: "savings", enabled: true },
      ],
    });

    const derived = deriveApp(plan);
    // Bills = rent(1200) + tithe(410) + parents(140) = 1750
    // Allocations = savings(500)
    expect(derived.totals.committedBills).toBe(1750);
    expect(derived.totals.allocationsTotal).toBe(500);
    expect(derived.totals.remaining).toBe(5000 - 1750 - 500);
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

// ── getVarianceByCategory ────────────────────────────────────────────

describe("getVarianceByCategory", () => {
  it("reports under when actual spending is below budget", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      bills: [{ id: "rent", label: "Rent", amount: 800, dueDay: 1, category: "bill", enabled: true }],
      transactions: [
        { id: "t1", date: "2026-02-01", label: "Rent", amount: 650, type: "outflow", category: "bill" },
      ],
    });

    const v = getVarianceByCategory(plan, 1);
    expect(v.bill?.budgeted).toBe(800);
    expect(v.bill?.actual).toBe(650);
    expect(v.bill?.variance).toBe(-150); // under
    expect(v.bill?.status).toBe("under");
  });

  it("reports over when actual spending exceeds budget", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      outflowRules: [
        { id: "groceries", label: "Groceries", amount: 100, cadence: "monthly", seedDate: "2026-02-01", category: "allowance", enabled: true },
      ],
      transactions: [
        { id: "t1", date: "2026-02-01", label: "Groceries", amount: 175, type: "outflow", category: "allowance" },
      ],
    });

    const v = getVarianceByCategory(plan, 1);
    expect(v.allowance?.budgeted).toBe(100);
    expect(v.allowance?.actual).toBe(175);
    expect(v.allowance?.variance).toBe(75); // over
    expect(v.allowance?.status).toBe("over");
  });

  it("reports neutral when variance is within ±5", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      bills: [{ id: "phone", label: "Phone", amount: 50, dueDay: 1, category: "bill", enabled: true }],
      transactions: [
        { id: "t1", date: "2026-02-01", label: "Phone", amount: 53, type: "outflow", category: "bill" },
      ],
    });

    const v = getVarianceByCategory(plan, 1);
    expect(v.bill?.variance).toBe(3); // ±5 → neutral
    expect(v.bill?.status).toBe("neutral");
  });

  it("shows zero actual when there are no matching transactions", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      bills: [{ id: "rent", label: "Rent", amount: 900, dueDay: 1, category: "bill", enabled: true }],
    });

    const v = getVarianceByCategory(plan, 1);
    expect(v.bill?.budgeted).toBe(900);
    expect(v.bill?.actual).toBe(0);
    expect(v.bill?.status).toBe("under");
  });

  it("captures unbudgeted ad-hoc spending as over-budget", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      transactions: [
        { id: "t1", date: "2026-02-05", label: "Restaurant", amount: 80, type: "outflow", category: "other" },
      ],
    });

    const v = getVarianceByCategory(plan, 1);
    // No budget for "other", but £80 was spent
    expect(v.other?.budgeted).toBe(0);
    expect(v.other?.actual).toBe(80);
    expect(v.other?.variance).toBe(80);
    expect(v.other?.status).toBe("over");
  });

  it("excludes transfer transactions from outflow variance", () => {
    // A savings outflow rule budgets £200; actual transaction is a transfer, not outflow
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      outflowRules: [
        { id: "sv", label: "Savings", amount: 200, cadence: "monthly", seedDate: "2026-02-15", category: "savings", enabled: true },
      ],
      transactions: [
        // transfer type — excluded from variance calc
        { id: "t1", date: "2026-02-15", label: "Transfer", amount: 200, type: "transfer", category: "savings" },
      ],
    });

    const v = getVarianceByCategory(plan, 1);
    // budgeted 200 (outflow rule), actual 0 (transfer excluded) → under
    expect(v.savings?.budgeted).toBe(200);
    expect(v.savings?.actual).toBe(0);
    expect(v.savings?.status).toBe("under");
  });

  it("only considers transactions within the selected period", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      bills: [{ id: "rent", label: "Rent", amount: 800, dueDay: 1, category: "bill", enabled: true }],
      transactions: [
        { id: "old", date: "2026-01-15", label: "Rent", amount: 800, type: "outflow", category: "bill" }, // outside P1
        { id: "t1",  date: "2026-02-01", label: "Rent", amount: 800, type: "outflow", category: "bill" }, // inside P1
      ],
    });

    const v = getVarianceByCategory(plan, 1);
    expect(v.bill?.actual).toBe(800); // only P1 transaction counted
    expect(v.bill?.variance).toBe(0);
  });
});

// ── buildHybridTimeline ──────────────────────────────────────────────

describe("buildHybridTimeline", () => {
  it("uses actual transactions for dates on or before asOfDate", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, asOfDate: "2026-02-02", expectedMinBalance: 0 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-05" }],
      // Planned income of £500 on Feb 1 — should be ignored in favour of actuals
      incomeRules: [
        { id: "pay", label: "Pay", amount: 500, cadence: "monthly", seedDate: "2026-02-01", enabled: true },
      ],
      transactions: [
        { id: "t1", date: "2026-02-01", label: "Side gig", amount: 120, type: "income", category: "income" },
      ],
    });

    const rows = buildHybridTimeline(plan, 1, 1000);
    // Feb 1 is past → actual income £120 used, NOT the planned £500
    const feb1 = rows.find((r) => r.date === "2026-02-01")!;
    expect(feb1.income).toBe(120);
    expect(feb1.balance).toBe(1120);
  });

  it("uses planned events for dates after asOfDate", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, asOfDate: "2026-02-02", expectedMinBalance: 0 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-05" }],
      bills: [
        { id: "phone", label: "Phone", amount: 60, dueDay: 4, category: "bill", enabled: true },
      ],
    });

    const rows = buildHybridTimeline(plan, 1, 1000);
    // Feb 4 is in the future → planned bill £60 is used
    const feb4 = rows.find((r) => r.date === "2026-02-04")!;
    expect(feb4.outflow).toBe(60);
    expect(feb4.balance).toBe(940);
  });

  it("carries running balance seamlessly across the past/future boundary", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, asOfDate: "2026-02-02", expectedMinBalance: 0 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-04" }],
      incomeRules: [
        { id: "pay", label: "Pay", amount: 300, cadence: "monthly", seedDate: "2026-02-03", enabled: true },
      ],
      transactions: [
        { id: "t1", date: "2026-02-01", label: "Salary", amount: 1000, type: "income", category: "income" },
        { id: "t2", date: "2026-02-02", label: "Grocery", amount: 50,   type: "outflow", category: "allowance" },
      ],
    });

    const rows = buildHybridTimeline(plan, 1, 500);
    // Feb 1: 500 + 1000 = 1500 (actual)
    expect(rows[0].balance).toBe(1500);
    // Feb 2: 1500 - 50 = 1450 (actual)
    expect(rows[1].balance).toBe(1450);
    // Feb 3: 1450 + 300 = 1750 (planned)
    expect(rows[2].balance).toBe(1750);
    // Feb 4: no events = 1750
    expect(rows[3].balance).toBe(1750);
  });
});

// ── buildActualsTimeline ─────────────────────────────────────────────

describe("buildActualsTimeline", () => {
  it("returns only rows up to and including asOfDate", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, asOfDate: "2026-02-03", expectedMinBalance: 0 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-10" }],
    });

    const rows = buildActualsTimeline(plan, 1, 1000);
    expect(rows).toHaveLength(3); // Feb 1, 2, 3 only
    expect(rows[rows.length - 1].date).toBe("2026-02-03");
  });

  it("returns empty array when asOfDate is before the period start", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, asOfDate: "2026-01-20", expectedMinBalance: 0 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
    });

    const rows = buildActualsTimeline(plan, 1, 1000);
    expect(rows).toHaveLength(0);
  });

  it("accumulates only actual transaction balances, ignoring planned events", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1, asOfDate: "2026-02-03", expectedMinBalance: 0 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-10" }],
      // A planned rule that should NOT appear in actuals
      incomeRules: [
        { id: "pay", label: "Pay", amount: 500, cadence: "monthly", seedDate: "2026-02-01", enabled: true },
      ],
      transactions: [
        { id: "t1", date: "2026-02-01", label: "Freelance", amount: 200, type: "income",  category: "income" },
        { id: "t2", date: "2026-02-03", label: "Rent",      amount: 400, type: "outflow", category: "bill" },
      ],
    });

    const rows = buildActualsTimeline(plan, 1, 1000);
    expect(rows[0].income).toBe(200);   // actual, not planned £500
    expect(rows[0].balance).toBe(1200);
    expect(rows[1].balance).toBe(1200); // Feb 2, no transaction
    expect(rows[2].outflow).toBe(400);
    expect(rows[2].balance).toBe(800);
  });
});

// ── Period rule overrides ────────────────────────────────────────────

describe("periodRuleOverrides", () => {
  it("disables an enabled rule for a specific period only", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [
        { id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" },
        { id: 2, label: "P2", start: "2026-03-01", end: "2026-03-31" },
      ],
      incomeRules: [
        { id: "pay", label: "Pay", amount: 2000, cadence: "monthly", seedDate: "2026-02-01", enabled: true },
      ],
      periodRuleOverrides: [
        { periodId: 1, ruleId: "pay", type: "income", enabled: false },
      ],
    });

    // Period 1: rule disabled by override → no income events
    const p1Events = generateEvents(plan, 1).filter((e) => e.type === "income");
    expect(p1Events).toHaveLength(0);

    // Period 2: override doesn't apply → income events present
    const p2Events = generateEvents(plan, 2).filter((e) => e.type === "income");
    expect(p2Events).toHaveLength(1);
    expect(p2Events[0].amount).toBe(2000);
  });

  it("overrides the amount of an outflow rule for a specific period", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      outflowRules: [
        { id: "groceries", label: "Groceries", amount: 100, cadence: "monthly", seedDate: "2026-02-15", category: "allowance", enabled: true },
      ],
      periodRuleOverrides: [
        { periodId: 1, ruleId: "groceries", type: "outflow", amount: 250 },
      ],
    });

    const events = generateEvents(plan, 1).filter((e) => e.sourceId === "groceries");
    expect(events).toHaveLength(1);
    expect(events[0].amount).toBe(250); // overridden from 100 → 250
  });

  it("enables a disabled rule for a specific period", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      incomeRules: [
        { id: "bonus", label: "Bonus", amount: 500, cadence: "monthly", seedDate: "2026-02-15", enabled: false },
      ],
      periodRuleOverrides: [
        { periodId: 1, ruleId: "bonus", type: "income", enabled: true },
      ],
    });

    const events = generateEvents(plan, 1).filter((e) => e.type === "income");
    expect(events).toHaveLength(1);
    expect(events[0].amount).toBe(500);
  });
});

// ── Event overrides ──────────────────────────────────────────────────

describe("eventOverrides", () => {
  it("disabling an event removes it from the timeline", () => {
    // Income rule generates event id "pay-2026-02-01"
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      incomeRules: [
        { id: "pay", label: "Pay", amount: 1000, cadence: "monthly", seedDate: "2026-02-01", enabled: true },
      ],
      eventOverrides: [
        { id: "eo-1", eventId: "pay-2026-02-01", disabled: true },
      ],
    });

    const events = generateEvents(plan, 1).filter((e) => e.type === "income");
    expect(events).toHaveLength(0);
  });

  it("date override shifts the event to a new date within the period", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      incomeRules: [
        { id: "pay", label: "Pay", amount: 1000, cadence: "monthly", seedDate: "2026-02-01", enabled: true },
      ],
      eventOverrides: [
        { id: "eo-1", eventId: "pay-2026-02-01", date: "2026-02-20" },
      ],
    });

    const events = generateEvents(plan, 1).filter((e) => e.type === "income");
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2026-02-20");
    expect(events[0].amount).toBe(1000);
  });

  it("amount override changes the event amount", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      bills: [
        { id: "rent", label: "Rent", amount: 900, dueDay: 1, category: "bill", enabled: true },
      ],
      eventOverrides: [
        { id: "eo-1", eventId: "rent-2026-02-01", amount: 950 },
      ],
    });

    const events = generateEvents(plan, 1).filter((e) => e.sourceId === "rent");
    expect(events).toHaveLength(1);
    expect(events[0].amount).toBe(950); // overridden from 900 → 950
  });

  it("event overridden to a date outside the period is excluded", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      incomeRules: [
        { id: "pay", label: "Pay", amount: 1000, cadence: "monthly", seedDate: "2026-02-01", enabled: true },
      ],
      eventOverrides: [
        { id: "eo-1", eventId: "pay-2026-02-01", date: "2026-03-05" }, // outside period
      ],
    });

    const events = generateEvents(plan, 1).filter((e) => e.type === "income");
    expect(events).toHaveLength(0); // pushed out of period bounds
  });
});

// ── Disabled rules and bills ─────────────────────────────────────────

describe("disabled rules and bills", () => {
  it("disabled income rule produces no events", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      incomeRules: [
        { id: "pay", label: "Pay", amount: 2000, cadence: "monthly", seedDate: "2026-02-01", enabled: false },
      ],
    });

    const events = generateEvents(plan, 1).filter((e) => e.type === "income");
    expect(events).toHaveLength(0);
  });

  it("disabled outflow rule produces no events", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      outflowRules: [
        { id: "groceries", label: "Groceries", amount: 80, cadence: "weekly", seedDate: "2026-02-02", category: "allowance", enabled: false },
      ],
    });

    const events = generateEvents(plan, 1).filter((e) => e.sourceId === "groceries");
    expect(events).toHaveLength(0);
  });

  it("disabled bill produces no events", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [{ id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" }],
      bills: [
        { id: "gym", label: "Gym", amount: 30, dueDay: 10, category: "bill", enabled: false },
      ],
    });

    const events = generateEvents(plan, 1).filter((e) => e.sourceId === "gym");
    expect(events).toHaveLength(0);
  });

  it("per-period disabled bill is excluded only for that period", () => {
    const plan = buildPlan({
      setup: { selectedPeriodId: 1 },
      periods: [
        { id: 1, label: "P1", start: "2026-02-01", end: "2026-02-28" },
        { id: 2, label: "P2", start: "2026-03-01", end: "2026-03-31" },
      ],
      bills: [
        { id: "gym", label: "Gym", amount: 30, dueDay: 10, category: "bill", enabled: true },
      ],
      periodOverrides: [
        { periodId: 1, disabledBills: ["gym"] },
      ],
    });

    const p1Events = generateEvents(plan, 1).filter((e) => e.sourceId === "gym");
    expect(p1Events).toHaveLength(0); // disabled for P1

    const p2Events = generateEvents(plan, 2).filter((e) => e.sourceId === "gym");
    expect(p2Events).toHaveLength(1); // still active in P2
  });
});
