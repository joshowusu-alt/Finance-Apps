import { describe, it, expect } from "vitest";
import { deriveApp } from "@/lib/derive";
import type { Plan } from "@/data/plan";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlan(): Plan {
  return {
    version: 2,
    setup: {
      selectedPeriodId: 1,
      asOfDate: "2025-01-15",
      windowDays: 30,
      startingBalance: 1000,
      rollForwardBalance: false,
      expectedMinBalance: 200,
      variableCap: 500,
    },
    periods: [
      { id: 1, label: "Jan 2025", start: "2025-01-01", end: "2025-01-31" },
      { id: 2, label: "Feb 2025", start: "2025-02-01", end: "2025-02-28" },
    ],
    incomeRules: [],
    outflowRules: [],
    periodRuleOverrides: [],
    bills: [],
    periodOverrides: [],
    eventOverrides: [],
    overrides: [],
    transactions: [],
    savingsGoals: [],
  };
}

// ─── Blank plan ───────────────────────────────────────────────────────────────

describe("deriveApp — blank plan", () => {
  it("returns safe defaults with no NaN values", () => {
    const plan = makePlan();
    const derived = deriveApp(plan, 1);

    expect(derived.totals.incomeExpected).toBe(0);
    expect(derived.totals.committedBills).toBe(0);
    expect(derived.totals.allocationsTotal).toBe(0);
    expect(derived.totals.remaining).toBe(0);

    expect(Number.isNaN(derived.totals.remaining)).toBe(false);
    expect(Number.isNaN(derived.cashflow.lowest.balance)).toBe(false);
    expect(derived.cashflow.daysBelowMin).toBe(0);
    expect(derived.period.id).toBe(1);
  });

  it("returns a daily array with one entry per day in the period", () => {
    const plan = makePlan();
    const derived = deriveApp(plan, 1);
    // Jan 2025 = 31 days
    expect(derived.cashflow.daily).toHaveLength(31);
    expect(derived.cashflow.daily[0].date).toBe("2025-01-01");
    expect(derived.cashflow.daily[30].date).toBe("2025-01-31");
  });

  it("all daily balances start at the starting balance with no events", () => {
    const plan = makePlan();
    const derived = deriveApp(plan, 1);
    expect(derived.cashflow.daily.every((d) => d.balance === 1000)).toBe(true);
  });
});

// ─── Income totals ────────────────────────────────────────────────────────────

describe("deriveApp — income totals", () => {
  it("reflects a single monthly income rule", () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 2500, cadence: "monthly", seedDate: "2025-01-01", enabled: true },
      ],
    };
    const derived = deriveApp(plan, 1);
    expect(derived.totals.incomeExpected).toBe(2500);
  });

  it("sums multiple income rules firing in the period", () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary",    label: "Salary",    amount: 2000, cadence: "monthly", seedDate: "2025-01-01", enabled: true },
        { id: "freelance", label: "Freelance", amount: 500,  cadence: "monthly", seedDate: "2025-01-05", enabled: true },
      ],
    };
    const derived = deriveApp(plan, 1);
    expect(derived.totals.incomeExpected).toBe(2500);
  });

  it("ignores disabled income rules", () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 2000, cadence: "monthly", seedDate: "2025-01-01", enabled: true },
        { id: "bonus",  label: "Bonus",  amount: 999,  cadence: "monthly", seedDate: "2025-01-01", enabled: false },
      ],
    };
    const derived = deriveApp(plan, 1);
    expect(derived.totals.incomeExpected).toBe(2000);
  });
});

// ─── Spending totals ──────────────────────────────────────────────────────────

describe("deriveApp — spending totals", () => {
  it("separates bills (committedBills) from outflow rule allocations (allocationsTotal)", () => {
    const plan: Plan = {
      ...makePlan(),
      bills: [
        { id: "rent", label: "Rent", amount: 950, dueDay: 1, category: "bill", enabled: true },
      ],
      outflowRules: [
        // 5 Mondays in Jan 2025 (Jan 1, 8, 15, 22, 29) → 5 × 60 = 300
        { id: "groceries", label: "Groceries", amount: 60, cadence: "weekly", seedDate: "2025-01-01", category: "allowance", enabled: true },
      ],
    };
    const derived = deriveApp(plan, 1);
    expect(derived.totals.committedBills).toBe(950);
    expect(derived.totals.allocationsTotal).toBe(300);
  });

  it("includes disabled bills in neither total", () => {
    const plan: Plan = {
      ...makePlan(),
      bills: [
        { id: "rent",     label: "Rent",     amount: 950, dueDay: 1,  category: "bill", enabled: true  },
        { id: "internet", label: "Internet", amount: 35,  dueDay: 15, category: "bill", enabled: false },
      ],
    };
    const derived = deriveApp(plan, 1);
    expect(derived.totals.committedBills).toBe(950);
  });
});

// ─── Remaining (savings proxy) ────────────────────────────────────────────────

describe("deriveApp — remaining", () => {
  it("remaining = incomeExpected − committedBills − allocationsTotal", () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 2000, cadence: "monthly", seedDate: "2025-01-01", enabled: true },
      ],
      bills: [
        { id: "rent", label: "Rent", amount: 800, dueDay: 1, category: "bill", enabled: true },
      ],
      outflowRules: [
        { id: "groceries", label: "Groceries", amount: 100, cadence: "monthly", seedDate: "2025-01-15", category: "allowance", enabled: true },
      ],
    };
    const derived = deriveApp(plan, 1);
    // 2000 − 800 − 100 = 1100
    expect(derived.totals.remaining).toBe(1100);
  });

  it("remaining is negative when outflows exceed income", () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 500, cadence: "monthly", seedDate: "2025-01-01", enabled: true },
      ],
      bills: [
        { id: "rent", label: "Rent", amount: 800, dueDay: 1, category: "bill", enabled: true },
      ],
    };
    const derived = deriveApp(plan, 1);
    expect(derived.totals.remaining).toBe(-300);
  });
});

// ─── Health labels ────────────────────────────────────────────────────────────

describe("deriveApp — health labels", () => {
  it('returns "Healthy" when lowest balance stays above expectedMinBalance', () => {
    // startingBalance=1000, expectedMin=200, no outflows → lowest=1000 ≥ 200
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, startingBalance: 1000, expectedMinBalance: 200 },
    };
    const derived = deriveApp(plan, 1);
    expect(derived.health.label).toBe("Healthy");
  });

  it('returns "Healthy" when expectedMinBalance is 0 and balance stays non-negative', () => {
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, startingBalance: 500, expectedMinBalance: 0 },
    };
    const derived = deriveApp(plan, 1);
    expect(derived.health.label).toBe("Healthy");
  });

  it('returns "Watch" when lowest balance dips below expectedMinBalance but stays ≥ 0', () => {
    // startingBalance=1000, expectedMin=900, big bill on Jan 5 → lowest = 800 < 900
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, startingBalance: 1000, expectedMinBalance: 900 },
      bills: [
        { id: "rent", label: "Rent", amount: 200, dueDay: 5, category: "bill", enabled: true },
      ],
    };
    const derived = deriveApp(plan, 1);
    expect(derived.health.label).toBe("Watch");
  });

  it('returns "At Risk" when lowest balance goes negative', () => {
    // startingBalance=100, bill=500 on Jan 1 → lowest = −400 < 0
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, startingBalance: 100, expectedMinBalance: 0 },
      bills: [
        { id: "rent", label: "Rent", amount: 500, dueDay: 1, category: "bill", enabled: true },
      ],
    };
    const derived = deriveApp(plan, 1);
    expect(derived.health.label).toBe("At Risk");
  });

  it("health reason is a non-empty string for each label", () => {
    const planHealthy = makePlan();
    expect(deriveApp(planHealthy, 1).health.reason.length).toBeGreaterThan(0);

    const planWatch: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, startingBalance: 1000, expectedMinBalance: 900 },
      bills: [{ id: "rent", label: "Rent", amount: 200, dueDay: 5, category: "bill", enabled: true }],
    };
    expect(deriveApp(planWatch, 1).health.reason.length).toBeGreaterThan(0);

    const planAtRisk: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, startingBalance: 100, expectedMinBalance: 0 },
      bills: [{ id: "rent", label: "Rent", amount: 500, dueDay: 1, category: "bill", enabled: true }],
    };
    expect(deriveApp(planAtRisk, 1).health.reason.length).toBeGreaterThan(0);
  });
});

// ─── Income stability ─────────────────────────────────────────────────────────

describe("deriveApp — income stability", () => {
  it('returns "Variable" with no income rules and explains accordingly', () => {
    const plan = makePlan();
    const derived = deriveApp(plan, 1);
    expect(derived.incomeStability.label).toBe("Variable");
    expect(derived.incomeStability.explanation).toContain("No income rules");
  });

  it('returns "Consistent" for a single income rule', () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 2000, cadence: "monthly", seedDate: "2025-01-01", enabled: true },
      ],
    };
    const derived = deriveApp(plan, 1);
    expect(derived.incomeStability.label).toBe("Consistent");
  });

  it('returns "Consistent" for two rules with same cadence and amounts within 10% spread', () => {
    // avg = 1025, spread = 50, threshold = 1025 * 0.1 = 102.5 → stable
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "r1", label: "Income A", amount: 1000, cadence: "monthly", seedDate: "2025-01-01", enabled: true },
        { id: "r2", label: "Income B", amount: 1050, cadence: "monthly", seedDate: "2025-01-15", enabled: true },
      ],
    };
    const derived = deriveApp(plan, 1);
    expect(derived.incomeStability.label).toBe("Consistent");
  });

  it('returns "Variable" for two rules with wildly different amounts (>10% spread)', () => {
    // avg = 1050, spread = 1900, threshold = 105 → unstable
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "r1", label: "Small",   amount: 100,  cadence: "monthly", seedDate: "2025-01-01", enabled: true },
        { id: "r2", label: "Big",     amount: 2000, cadence: "monthly", seedDate: "2025-01-05", enabled: true },
      ],
    };
    const derived = deriveApp(plan, 1);
    expect(derived.incomeStability.label).toBe("Variable");
  });

  it('returns "Variable" for rules with different cadences', () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 1000, cadence: "monthly", seedDate: "2025-01-01", enabled: true },
        { id: "weekly", label: "Weekly", amount: 1000, cadence: "weekly",  seedDate: "2025-01-01", enabled: true },
      ],
    };
    const derived = deriveApp(plan, 1);
    expect(derived.incomeStability.label).toBe("Variable");
  });

  it("variance is undefined when there are no income rules", () => {
    const plan = makePlan();
    const derived = deriveApp(plan, 1);
    expect(derived.incomeStability.variance).toBeUndefined();
  });

  it("variance is a number when income rules are present", () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 2000, cadence: "monthly", seedDate: "2025-01-01", enabled: true },
      ],
    };
    const derived = deriveApp(plan, 1);
    expect(typeof derived.incomeStability.variance).toBe("number");
  });
});

// ─── Savings streak ───────────────────────────────────────────────────────────

describe("deriveApp — savings streak", () => {
  it("reports streak=0 and prompts completion when no prior transactions exist", () => {
    // No transactions at all → historyExists = false
    const plan = makePlan();
    const derived = deriveApp(plan, 1);
    expect(derived.savingsHealth.streak).toBe(0);
    expect(derived.savingsHealth.streakExplanation).toContain("Complete a period");
  });

  it("reports streak=0 when savings target not met in most recent period (P2 not met, P1 met)", () => {
    const plan: Plan = {
      ...makePlan(),
      outflowRules: [
        { id: "sav", label: "Savings", amount: 250, cadence: "monthly", seedDate: "2025-01-01", category: "savings", enabled: true },
      ],
      transactions: [
        // P1 target met, but P2 (current when viewing P2) not yet met — streak breaks at P2
        { id: "t1", date: "2025-01-15", label: "Savings Jan", amount: 250, type: "transfer", category: "savings" },
      ],
    };
    // Viewing P2: loop starts at P2 (most recent) → P2 actual=0, budgeted=250 → break → streak=0
    // historyExists: Jan transaction < Feb 1 → true
    const derived = deriveApp(plan, 2);
    expect(derived.savingsHealth.streak).toBe(0);
    expect(derived.savingsHealth.streakExplanation).toContain("No savings streak");
  });

  it("reports streak=2 when both periods fully met the savings target", () => {
    const plan: Plan = {
      ...makePlan(),
      outflowRules: [
        { id: "sav", label: "Savings", amount: 250, cadence: "monthly", seedDate: "2025-01-01", category: "savings", enabled: true },
      ],
      transactions: [
        { id: "t1", date: "2025-01-15", label: "Savings Jan", amount: 250, type: "transfer", category: "savings" },
        { id: "t2", date: "2025-02-15", label: "Savings Feb", amount: 250, type: "transfer", category: "savings" },
      ],
    };
    // Viewing P2: P2 actual=250=budgeted → streak=1; P1 actual=250=budgeted → streak=2
    // historyExists: t1 Jan 15 < Feb 1 → true
    const derived = deriveApp(plan, 2);
    expect(derived.savingsHealth.streak).toBe(2);
    expect(derived.savingsHealth.streakExplanation).toContain("2 period");
  });

  it("reflects savings target in savingsThisPeriod via outflow category=savings rules", () => {
    const plan: Plan = {
      ...makePlan(),
      outflowRules: [
        { id: "sav", label: "Savings", amount: 300, cadence: "monthly", seedDate: "2025-01-01", category: "savings", enabled: true },
      ],
    };
    const derived = deriveApp(plan, 1);
    expect(derived.savingsHealth.savingsThisPeriod).toBe(300);
  });
});

// ─── Period selection ─────────────────────────────────────────────────────────

describe("deriveApp — period selection", () => {
  it("uses plan.setup.selectedPeriodId when no periodId argument is given", () => {
    const plan: Plan = { ...makePlan(), setup: { ...makePlan().setup, selectedPeriodId: 2 } };
    const derived = deriveApp(plan);
    expect(derived.period.id).toBe(2);
    expect(derived.period.start).toBe("2025-02-01");
  });

  it("uses the explicit periodId argument when provided", () => {
    const plan = makePlan(); // selectedPeriodId=1
    const derived = deriveApp(plan, 2);
    expect(derived.period.id).toBe(2);
    expect(derived.period.start).toBe("2025-02-01");
    expect(derived.period.end).toBe("2025-02-28");
  });

  it("period.days array has one ISO string per calendar day in the period", () => {
    const plan = makePlan();
    const derived = deriveApp(plan, 2); // Feb 2025 = 28 days
    expect(derived.period.days).toHaveLength(28);
    expect(derived.period.days[0]).toBe("2025-02-01");
    expect(derived.period.days[27]).toBe("2025-02-28");
  });

  it("derived values reflect the selected period when period 2 has income that period 1 does not", () => {
    // Monthly rules fire on the same day-of-month in every period, so use a
    // weekly rule seeded after period 1 ends (Feb 3) — it won't walk back into Jan.
    // In period 2 (Feb 1-28): Feb 3, Feb 10, Feb 17, Feb 24 → 4 events × 500 = 2000
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 500, cadence: "weekly", seedDate: "2025-02-03", enabled: true },
      ],
    };
    expect(deriveApp(plan, 1).totals.incomeExpected).toBe(0);
    expect(deriveApp(plan, 2).totals.incomeExpected).toBe(2000);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("deriveApp — edge cases", () => {
  it("does not throw with an empty transactions array", () => {
    const plan: Plan = { ...makePlan(), transactions: [] };
    expect(() => deriveApp(plan, 1)).not.toThrow();
  });

  it("handles a period with no budget (no rules, bills, or transactions)", () => {
    const plan = makePlan();
    const derived = deriveApp(plan, 1);
    expect(derived.totals.incomeExpected).toBe(0);
    expect(derived.totals.committedBills).toBe(0);
    expect(derived.totals.allocationsTotal).toBe(0);
    expect(derived.totals.remaining).toBe(0);
  });

  it("handles a plan with income but no outflow rules or bills", () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 1000, cadence: "monthly", seedDate: "2025-01-01", enabled: true },
      ],
      outflowRules: [],
      bills: [],
    };
    const derived = deriveApp(plan, 1);
    expect(derived.totals.committedBills).toBe(0);
    expect(derived.totals.allocationsTotal).toBe(0);
    expect(derived.totals.remaining).toBe(1000);
  });

  it("flags.hasStartingBalance is true when startingBalance is non-zero", () => {
    const plan = makePlan(); // startingBalance=1000
    const derived = deriveApp(plan, 1);
    expect(derived.flags.hasStartingBalance).toBe(true);
  });

  it("flags.hasStartingBalance is false when startingBalance is 0 and no period override", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, startingBalance: 0 },
    };
    const derived = deriveApp(plan, 1);
    expect(derived.flags.hasStartingBalance).toBe(false);
  });
});
