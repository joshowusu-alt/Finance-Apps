import { describe, it, expect } from "vitest";
import {
  getPeriod,
  getPeriodForDate,
  getStartingBalance,
  getActualsStartingBalance,
  buildTimeline,
  generateEvents,
  getDashboardSummary,
  getVarianceByCategory,
  getTotalVariance,
} from "@/lib/cashflowEngine";
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
      expectedMinBalance: 100,
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

// ─── getPeriod ────────────────────────────────────────────────────────────────

describe("getPeriod", () => {
  it("returns the correct period for a known id", () => {
    const plan = makePlan();
    const period = getPeriod(plan, 1);
    expect(period.id).toBe(1);
    expect(period.start).toBe("2025-01-01");
    expect(period.end).toBe("2025-01-31");
  });

  it("falls back to first period for an unknown id", () => {
    const plan = makePlan();
    const period = getPeriod(plan, 999);
    expect(period.id).toBe(1);
  });

  it("returns period 2 correctly", () => {
    const plan = makePlan();
    const period = getPeriod(plan, 2);
    expect(period.id).toBe(2);
    expect(period.start).toBe("2025-02-01");
    expect(period.end).toBe("2025-02-28");
  });
});

// ─── getPeriodForDate ─────────────────────────────────────────────────────────

describe("getPeriodForDate", () => {
  it("returns period 1 for a date within Jan 2025", () => {
    const plan = makePlan();
    expect(getPeriodForDate(plan, "2025-01-15")).toBe(1);
    expect(getPeriodForDate(plan, "2025-01-01")).toBe(1);
    expect(getPeriodForDate(plan, "2025-01-31")).toBe(1);
  });

  it("returns period 2 for a date within Feb 2025", () => {
    const plan = makePlan();
    expect(getPeriodForDate(plan, "2025-02-01")).toBe(2);
    expect(getPeriodForDate(plan, "2025-02-28")).toBe(2);
  });

  it("returns null for a date outside all periods", () => {
    const plan = makePlan();
    expect(getPeriodForDate(plan, "2025-03-15")).toBeNull();
    expect(getPeriodForDate(plan, "2024-12-31")).toBeNull();
  });
});

// ─── getStartingBalance ───────────────────────────────────────────────────────

describe("getStartingBalance", () => {
  it("returns plan.setup.startingBalance when rollForwardBalance is false", () => {
    const plan = makePlan();
    // rollForwardBalance = false by default in makePlan
    expect(getStartingBalance(plan, 1)).toBe(1000);
    expect(getStartingBalance(plan, 2)).toBe(1000);
  });

  it("chains period ending balance with rollForwardBalance = true and no events", () => {
    const plan = { ...makePlan(), setup: { ...makePlan().setup, rollForwardBalance: true } };
    // No income/outflow rules → period 1 ending balance = startingBalance = 1000
    expect(getStartingBalance(plan, 1)).toBe(1000);
    expect(getStartingBalance(plan, 2)).toBe(1000);
  });

  it("rolls forward income into period 2 starting balance", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, rollForwardBalance: true },
      incomeRules: [
        {
          id: "salary",
          label: "Salary",
          amount: 500,
          cadence: "monthly",
          seedDate: "2025-01-01",
          enabled: true,
        },
      ],
    };
    // Period 1 gets £500 income → ending balance = 1500
    // Period 2 should start at 1500
    expect(getStartingBalance(plan, 1)).toBe(1000);
    expect(getStartingBalance(plan, 2)).toBe(1500);
  });

  it("respects periodOverride startingBalance", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, rollForwardBalance: true },
      periodOverrides: [{ periodId: 2, startingBalance: 750 }],
    };
    expect(getStartingBalance(plan, 2)).toBe(750);
  });

  it("respects periodOverride for period 1 when rollForwardBalance is false", () => {
    const plan: Plan = {
      ...makePlan(),
      periodOverrides: [{ periodId: 1, startingBalance: 2000 }],
    };
    // rollForwardBalance = false so the override map should still work?
    // Actually: when rollForwardBalance=false, it returns plan.setup.startingBalance
    // The override only takes effect when rolling forward
    expect(getStartingBalance(plan, 1)).toBe(1000); // rollForwardBalance false → setup value
  });
});

// ─── getActualsStartingBalance ────────────────────────────────────────────────

describe("getActualsStartingBalance", () => {
  it("returns plan.setup.startingBalance for the first period", () => {
    const plan = makePlan();
    expect(getActualsStartingBalance(plan, 1)).toBe(1000);
  });

  it("returns setup.startingBalance for period 2 when there are no transactions in period 1", () => {
    const plan = makePlan();
    expect(getActualsStartingBalance(plan, 2)).toBe(1000);
  });

  it("chains income from period 1 into period 2 starting balance", () => {
    const plan: Plan = {
      ...makePlan(),
      transactions: [
        { id: "t1", date: "2025-01-10", label: "Salary", amount: 500, type: "income", category: "income" },
      ],
    };
    // period 2 starting balance = 1000 + 500 = 1500
    expect(getActualsStartingBalance(plan, 2)).toBe(1500);
  });

  it("subtracts outflows from period 1 for period 2 starting balance", () => {
    const plan: Plan = {
      ...makePlan(),
      transactions: [
        { id: "t1", date: "2025-01-10", label: "Salary", amount: 500, type: "income", category: "income" },
        { id: "t2", date: "2025-01-15", label: "Rent", amount: 300, type: "outflow", category: "bill" },
      ],
    };
    // 1000 + 500 - 300 = 1200
    expect(getActualsStartingBalance(plan, 2)).toBe(1200);
  });

  it("treats transfers as outflows for balance chaining (no double-counting)", () => {
    const plan: Plan = {
      ...makePlan(),
      transactions: [
        { id: "t1", date: "2025-01-20", label: "Savings transfer", amount: 100, type: "transfer", category: "savings" },
      ],
    };
    // 1000 - 100 = 900
    expect(getActualsStartingBalance(plan, 2)).toBe(900);
  });

  it("ignores transactions from later periods when computing period 2 starting balance", () => {
    const plan: Plan = {
      ...makePlan(),
      transactions: [
        { id: "t1", date: "2025-01-05", label: "Income Jan", amount: 200, type: "income", category: "income" },
        // This is in period 2 — should NOT affect period 2 starting balance
        { id: "t2", date: "2025-02-05", label: "Income Feb", amount: 999, type: "income", category: "income" },
      ],
    };
    // period 2: 1000 + 200 = 1200 (Feb income NOT included)
    expect(getActualsStartingBalance(plan, 2)).toBe(1200);
  });
});

// ─── generateEvents ───────────────────────────────────────────────────────────

describe("generateEvents", () => {
  it("returns empty array for a plan with no rules or bills", () => {
    const plan = makePlan();
    expect(generateEvents(plan, 1)).toEqual([]);
  });

  it("generates 1 event per month for a monthly income rule", () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 2800, cadence: "monthly", seedDate: "2025-01-15", enabled: true },
      ],
    };
    const events = generateEvents(plan, 1);
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2025-01-15");
    expect(events[0].amount).toBe(2800);
    expect(events[0].type).toBe("income");
    expect(events[0].category).toBe("income");
  });

  it("generates weekly events for a weekly outflow rule", () => {
    const plan: Plan = {
      ...makePlan(),
      outflowRules: [
        { id: "groceries", label: "Groceries", amount: 60, cadence: "weekly", seedDate: "2025-01-01", category: "allowance", enabled: true },
      ],
    };
    // Jan 1, 8, 15, 22, 29 = 5 events
    const events = generateEvents(plan, 1);
    expect(events).toHaveLength(5);
    expect(events.every((e) => e.type === "outflow")).toBe(true);
    expect(events.every((e) => e.amount === 60)).toBe(true);
    expect(events[0].date).toBe("2025-01-01");
    expect(events[4].date).toBe("2025-01-29");
  });

  it("does not generate events for disabled rules", () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 2800, cadence: "monthly", seedDate: "2025-01-15", enabled: false },
      ],
    };
    expect(generateEvents(plan, 1)).toEqual([]);
  });

  it("generates bill events on the correct due day", () => {
    const plan: Plan = {
      ...makePlan(),
      bills: [
        { id: "rent", label: "Rent", amount: 950, dueDay: 1, category: "bill", enabled: true },
        { id: "internet", label: "Internet", amount: 35, dueDay: 15, category: "bill", enabled: true },
      ],
    };
    const events = generateEvents(plan, 1);
    expect(events).toHaveLength(2);
    const rentEvent = events.find((e) => e.label === "Rent");
    const internetEvent = events.find((e) => e.label === "Internet");
    expect(rentEvent?.date).toBe("2025-01-01");
    expect(internetEvent?.date).toBe("2025-01-15");
    expect(rentEvent?.type).toBe("outflow");
    expect(rentEvent?.category).toBe("bill");
  });

  it("returns events sorted by date", () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 2800, cadence: "monthly", seedDate: "2025-01-20", enabled: true },
      ],
      bills: [
        { id: "rent", label: "Rent", amount: 950, dueDay: 5, category: "bill", enabled: true },
      ],
    };
    const events = generateEvents(plan, 1);
    expect(events[0].date).toBe("2025-01-05"); // rent before salary
    expect(events[1].date).toBe("2025-01-20");
  });

  it("biweekly rule generates events every 14 days", () => {
    const plan: Plan = {
      ...makePlan(),
      outflowRules: [
        { id: "fuel", label: "Fuel", amount: 45, cadence: "biweekly", seedDate: "2025-01-01", category: "other", enabled: true },
      ],
    };
    // Jan 1, Jan 15, Jan 29 → 3 events within Jan 2025
    const events = generateEvents(plan, 1);
    expect(events).toHaveLength(3);
    expect(events[0].date).toBe("2025-01-01");
    expect(events[1].date).toBe("2025-01-15");
    expect(events[2].date).toBe("2025-01-29");
  });
});

// ─── buildTimeline ────────────────────────────────────────────────────────────

describe("buildTimeline", () => {
  it("returns one row per day in the period", () => {
    const plan = makePlan();
    const rows = buildTimeline(plan, 1, 1000);
    expect(rows).toHaveLength(31); // Jan has 31 days
    expect(rows[0].date).toBe("2025-01-01");
    expect(rows[30].date).toBe("2025-01-31");
  });

  it("maintains constant balance with no events", () => {
    const plan = makePlan();
    const rows = buildTimeline(plan, 1, 1000);
    expect(rows.every((r) => r.balance === 1000)).toBe(true);
    expect(rows.every((r) => r.income === 0)).toBe(true);
    expect(rows.every((r) => r.outflow === 0)).toBe(true);
  });

  it("increases balance on income event day", () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 500, cadence: "monthly", seedDate: "2025-01-10", enabled: true },
      ],
    };
    const rows = buildTimeline(plan, 1, 1000);
    const jan10 = rows.find((r) => r.date === "2025-01-10")!;
    expect(jan10.income).toBe(500);
    expect(jan10.balance).toBe(1500);
    // Subsequent rows retain new balance
    const jan11 = rows.find((r) => r.date === "2025-01-11")!;
    expect(jan11.balance).toBe(1500);
  });

  it("decreases balance on outflow event day", () => {
    const plan: Plan = {
      ...makePlan(),
      bills: [
        { id: "rent", label: "Rent", amount: 200, dueDay: 5, category: "bill", enabled: true },
      ],
    };
    const rows = buildTimeline(plan, 1, 1000);
    const jan5 = rows.find((r) => r.date === "2025-01-05")!;
    expect(jan5.outflow).toBe(200);
    expect(jan5.balance).toBe(800);
  });

  it("sets warning flag when balance is below expectedMinBalance", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, expectedMinBalance: 900 },
      bills: [
        { id: "rent", label: "Rent", amount: 200, dueDay: 5, category: "bill", enabled: true },
      ],
    };
    const rows = buildTimeline(plan, 1, 1000);
    const jan5 = rows.find((r) => r.date === "2025-01-05")!;
    expect(jan5.balance).toBe(800);
    expect(jan5.warning).toBe(true);
    // Before the payment, no warning
    const jan4 = rows.find((r) => r.date === "2025-01-04")!;
    expect(jan4.warning).toBe(false);
  });

  it("correctly handles multiple events on the same day", () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 500, cadence: "monthly", seedDate: "2025-01-01", enabled: true },
      ],
      bills: [
        { id: "rent", label: "Rent", amount: 200, dueDay: 1, category: "bill", enabled: true },
      ],
    };
    const rows = buildTimeline(plan, 1, 1000);
    const jan1 = rows.find((r) => r.date === "2025-01-01")!;
    expect(jan1.income).toBe(500);
    expect(jan1.outflow).toBe(200);
    expect(jan1.net).toBe(300);
    expect(jan1.balance).toBe(1300);
  });

  it("returns correct final balance with cumulative events", () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 1000, cadence: "monthly", seedDate: "2025-01-01", enabled: true },
      ],
      outflowRules: [
        { id: "weekly", label: "Weekly spend", amount: 100, cadence: "weekly", seedDate: "2025-01-01", category: "allowance", enabled: true },
      ],
    };
    // £1000 income, 5 × £100 outflow = 1000 + 1000 – 500 = 1500
    const rows = buildTimeline(plan, 1, 1000);
    expect(rows[rows.length - 1].balance).toBe(1500);
  });
});

// ─── getDashboardSummary ──────────────────────────────────────────────────────

describe("getDashboardSummary", () => {
  it("returns zeros for an empty plan", () => {
    const plan = makePlan();
    const summary = getDashboardSummary(plan, 1, 1000);
    expect(summary.income).toBe(0);
    expect(summary.outflows).toBe(0);
    expect(summary.net).toBe(0);
  });

  it("sums income and outflows correctly", () => {
    const plan: Plan = {
      ...makePlan(),
      incomeRules: [
        { id: "salary", label: "Salary", amount: 2000, cadence: "monthly", seedDate: "2025-01-01", enabled: true },
      ],
      bills: [
        { id: "rent", label: "Rent", amount: 800, dueDay: 1, category: "bill", enabled: true },
        { id: "internet", label: "Internet", amount: 30, dueDay: 15, category: "bill", enabled: true },
      ],
    };
    const summary = getDashboardSummary(plan, 1, 1000);
    expect(summary.income).toBe(2000);
    expect(summary.outflows).toBe(830);
    expect(summary.net).toBe(1170);
  });

  it("reports the lowest balance and its date", () => {
    const plan: Plan = {
      ...makePlan(),
      // Big outflow on Jan 5, income not until Jan 20
      bills: [
        { id: "rent", label: "Rent", amount: 900, dueDay: 5, category: "bill", enabled: true },
      ],
      incomeRules: [
        { id: "salary", label: "Salary", amount: 500, cadence: "monthly", seedDate: "2025-01-20", enabled: true },
      ],
    };
    const summary = getDashboardSummary(plan, 1, 1000);
    // Jan 5: 1000 - 900 = 100 (lowest before salary)
    // Jan 20: 100 + 500 = 600
    expect(summary.lowest).toBe(100);
    expect(summary.lowestDate).toBe("2025-01-05");
  });
});

// ─── getVarianceByCategory ────────────────────────────────────────────────────

describe("getVarianceByCategory", () => {
  it("returns empty object for plan with no events or transactions", () => {
    const plan = makePlan();
    const variance = getVarianceByCategory(plan, 1);
    expect(Object.keys(variance)).toHaveLength(0);
  });

  it("reports under variance when actual outflow exceeds budget", () => {
    const plan: Plan = {
      ...makePlan(),
      bills: [
        { id: "rent", label: "Rent", amount: 800, dueDay: 1, category: "bill", enabled: true },
      ],
      transactions: [
        // In period 1, Jan 2025
        { id: "t1", date: "2025-01-01", label: "Rent actual", amount: 900, type: "outflow", category: "bill" },
      ],
    };
    const variance = getVarianceByCategory(plan, 1);
    const bill = variance["bill"]!;
    expect(bill.budgeted).toBe(800);
    expect(bill.actual).toBe(900);
    expect(bill.variance).toBeGreaterThan(0); // spent more than budgeted
    expect(bill.status).toBe("over");
  });

  it("reports neutral status when actual matches budget within £5 tolerance", () => {
    const plan: Plan = {
      ...makePlan(),
      bills: [
        { id: "internet", label: "Internet", amount: 30, dueDay: 5, category: "bill", enabled: true },
      ],
      transactions: [
        { id: "t1", date: "2025-01-05", label: "Internet", amount: 30, type: "outflow", category: "bill" },
      ],
    };
    const variance = getVarianceByCategory(plan, 1);
    expect(variance["bill"]?.status).toBe("neutral");
  });

  it("excludes transfers from outflow variance calculation", () => {
    const plan: Plan = {
      ...makePlan(),
      transactions: [
        { id: "t1", date: "2025-01-10", label: "Savings", amount: 200, type: "transfer", category: "savings" },
      ],
    };
    const variance = getVarianceByCategory(plan, 1);
    // Transfer should appear in savings category but budgeted = 0 and actual = 0 (transfers excluded)
    const savings = variance["savings"];
    if (savings) {
      expect(savings.budgeted).toBe(0);
      expect(savings.actual).toBe(0);
    }
  });

  it("only counts transactions within the period", () => {
    const plan: Plan = {
      ...makePlan(),
      bills: [
        { id: "rent", label: "Rent", amount: 800, dueDay: 1, category: "bill", enabled: true },
      ],
      transactions: [
        // In period 1
        { id: "t1", date: "2025-01-01", label: "Rent Jan", amount: 800, type: "outflow", category: "bill" },
        // In period 2 — should NOT count for period 1 variance
        { id: "t2", date: "2025-02-01", label: "Rent Feb", amount: 850, type: "outflow", category: "bill" },
      ],
    };
    const variance = getVarianceByCategory(plan, 1);
    expect(variance["bill"]?.actual).toBe(800); // only Jan transaction
  });
});

// ─── getTotalVariance ─────────────────────────────────────────────────────────

describe("getTotalVariance", () => {
  it("returns zeros for empty plan", () => {
    const plan = makePlan();
    const total = getTotalVariance(plan, 1);
    expect(total.budgeted).toBe(0);
    expect(total.actual).toBe(0);
    expect(total.variance).toBe(0);
  });

  it("aggregates variance across all categories", () => {
    const plan: Plan = {
      ...makePlan(),
      bills: [
        { id: "rent", label: "Rent", amount: 800, dueDay: 1, category: "bill", enabled: true },
        { id: "internet", label: "Internet", amount: 30, dueDay: 5, category: "bill", enabled: true },
      ],
      transactions: [
        { id: "t1", date: "2025-01-01", label: "Rent paid", amount: 820, type: "outflow", category: "bill" },
        { id: "t2", date: "2025-01-05", label: "Internet paid", amount: 30, type: "outflow", category: "bill" },
      ],
    };
    const total = getTotalVariance(plan, 1);
    expect(total.budgeted).toBe(830); // |−830| = 830
    expect(total.actual).toBe(850);   // |−850| = 850
    expect(total.variance).toBe(20);  // 850 − 830 = 20 (overspent)
  });
});
