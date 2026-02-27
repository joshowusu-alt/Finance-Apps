import { describe, it, expect } from "vitest";
import { buildActualsTimeline, buildHybridTimeline } from "@/lib/cashflowEngine";
import type { Plan } from "@/data/plan";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Minimal plan factory. asOfDate is set to "2025-01-31" so the full Jan period
 * is covered by actuals; individual tests override as needed.
 */
function makePlan(): Plan {
  return {
    version: 2,
    setup: {
      selectedPeriodId: 1,
      asOfDate: "2025-01-31",
      windowDays: 30,
      startingBalance: 1000,
      rollForwardBalance: false,
      expectedMinBalance: 0,
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

// ─── buildActualsTimeline ─────────────────────────────────────────────────────

describe("buildActualsTimeline — empty transactions", () => {
  it("returns one row per day from period start up to asOfDate", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, asOfDate: "2025-01-10" },
      transactions: [],
    };
    const rows = buildActualsTimeline(plan, 1, 1000);
    expect(rows).toHaveLength(10); // Jan 1–10
    expect(rows[0].date).toBe("2025-01-01");
    expect(rows[9].date).toBe("2025-01-10");
  });

  it("returns an empty array when asOfDate is before the period start", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, asOfDate: "2024-12-31" },
    };
    const rows = buildActualsTimeline(plan, 1, 1000);
    expect(rows).toHaveLength(0);
  });

  it("holds a constant balance equal to startingBalance when there are no transactions", () => {
    const plan = makePlan(); // asOfDate = Jan 31
    const rows = buildActualsTimeline(plan, 1, 1500);
    expect(rows).toHaveLength(31);
    expect(rows.every((r) => r.balance === 1500)).toBe(true);
    expect(rows.every((r) => r.income === 0)).toBe(true);
    expect(rows.every((r) => r.outflow === 0)).toBe(true);
  });
});

describe("buildActualsTimeline — income transaction", () => {
  it("increases balance on the day an income transaction is recorded", () => {
    const plan: Plan = {
      ...makePlan(),
      transactions: [
        { id: "t1", date: "2025-01-10", label: "Salary", amount: 500, type: "income", category: "income" },
      ],
    };
    const rows = buildActualsTimeline(plan, 1, 1000);
    const jan10 = rows.find((r) => r.date === "2025-01-10")!;
    expect(jan10.income).toBe(500);
    expect(jan10.outflow).toBe(0);
    expect(jan10.net).toBe(500);
    expect(jan10.balance).toBe(1500);
  });

  it("carries the higher balance forward to subsequent days", () => {
    const plan: Plan = {
      ...makePlan(),
      transactions: [
        { id: "t1", date: "2025-01-05", label: "Salary", amount: 300, type: "income", category: "income" },
      ],
    };
    const rows = buildActualsTimeline(plan, 1, 1000);
    // All days after Jan 5 should have balance = 1300
    rows.filter((r) => r.date > "2025-01-05").forEach((r) => {
      expect(r.balance).toBe(1300);
    });
  });

  it("only includes income transactions on or before asOfDate", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, asOfDate: "2025-01-15" },
      transactions: [
        { id: "t1", date: "2025-01-10", label: "Early salary",  amount: 200, type: "income", category: "income" },
        { id: "t2", date: "2025-01-20", label: "Future salary", amount: 500, type: "income", category: "income" },
      ],
    };
    const rows = buildActualsTimeline(plan, 1, 1000);
    expect(rows).toHaveLength(15); // Jan 1–15 only
    const lastRow = rows[rows.length - 1];
    // Only t1 (Jan 10) should be applied; t2 (Jan 20) is excluded
    expect(lastRow.balance).toBe(1200);
  });
});

describe("buildActualsTimeline — outflow transaction", () => {
  it("decreases balance on the day an outflow transaction is recorded", () => {
    const plan: Plan = {
      ...makePlan(),
      transactions: [
        { id: "t1", date: "2025-01-05", label: "Rent", amount: 200, type: "outflow", category: "bill" },
      ],
    };
    const rows = buildActualsTimeline(plan, 1, 1000);
    const jan5 = rows.find((r) => r.date === "2025-01-05")!;
    expect(jan5.outflow).toBe(200);
    expect(jan5.income).toBe(0);
    expect(jan5.net).toBe(-200);
    expect(jan5.balance).toBe(800);
  });

  it("counts transfer transactions as outflows (reducing balance)", () => {
    const plan: Plan = {
      ...makePlan(),
      transactions: [
        { id: "t1", date: "2025-01-10", label: "Savings transfer", amount: 150, type: "transfer", category: "savings" },
      ],
    };
    const rows = buildActualsTimeline(plan, 1, 1000);
    const jan10 = rows.find((r) => r.date === "2025-01-10")!;
    expect(jan10.outflow).toBe(150);
    expect(jan10.balance).toBe(850);
  });
});

describe("buildActualsTimeline — multiple transactions on same day", () => {
  it("nets income and outflow on the same day correctly", () => {
    const plan: Plan = {
      ...makePlan(),
      transactions: [
        { id: "t1", date: "2025-01-01", label: "Salary",  amount: 500, type: "income",  category: "income" },
        { id: "t2", date: "2025-01-01", label: "Rent",    amount: 200, type: "outflow", category: "bill"   },
      ],
    };
    const rows = buildActualsTimeline(plan, 1, 1000);
    const jan1 = rows.find((r) => r.date === "2025-01-01")!;
    expect(jan1.income).toBe(500);
    expect(jan1.outflow).toBe(200);
    expect(jan1.net).toBe(300);
    expect(jan1.balance).toBe(1300);
  });

  it("handles three transactions on the same day with correct aggregate", () => {
    const plan: Plan = {
      ...makePlan(),
      transactions: [
        { id: "t1", date: "2025-01-15", label: "Income A", amount: 1000, type: "income",  category: "income"    },
        { id: "t2", date: "2025-01-15", label: "Bill B",   amount: 300,  type: "outflow", category: "bill"      },
        { id: "t3", date: "2025-01-15", label: "Savings",  amount: 100,  type: "transfer",category: "savings"   },
      ],
    };
    const rows = buildActualsTimeline(plan, 1, 500);
    const jan15 = rows.find((r) => r.date === "2025-01-15")!;
    // income=1000, outflow=300+100=400, net=600, balance=500+600=1100
    expect(jan15.income).toBe(1000);
    expect(jan15.outflow).toBe(400);
    expect(jan15.net).toBe(600);
    expect(jan15.balance).toBe(1100);
  });
});

describe("buildActualsTimeline — balance progression", () => {
  it("accumulates running balance day over day across multiple events", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, asOfDate: "2025-01-05" },
      transactions: [
        { id: "t1", date: "2025-01-02", label: "Income",  amount: 200, type: "income",  category: "income" },
        { id: "t2", date: "2025-01-04", label: "Expense", amount: 50,  type: "outflow", category: "other"  },
      ],
    };
    // Day 1: 1000
    // Day 2: 1000 + 200 = 1200
    // Day 3: 1200
    // Day 4: 1200 − 50 = 1150
    // Day 5: 1150
    const rows = buildActualsTimeline(plan, 1, 1000);
    expect(rows[0].balance).toBe(1000); // Jan 1
    expect(rows[1].balance).toBe(1200); // Jan 2
    expect(rows[2].balance).toBe(1200); // Jan 3
    expect(rows[3].balance).toBe(1150); // Jan 4
    expect(rows[4].balance).toBe(1150); // Jan 5
  });

  it("final balance matches manual calculation of all transactions", () => {
    const plan: Plan = {
      ...makePlan(),
      transactions: [
        { id: "t1", date: "2025-01-01", label: "Salary",    amount: 2000, type: "income",  category: "income"   },
        { id: "t2", date: "2025-01-05", label: "Rent",      amount: 800,  type: "outflow", category: "bill"     },
        { id: "t3", date: "2025-01-10", label: "Groceries", amount: 60,   type: "outflow", category: "allowance"},
        { id: "t4", date: "2025-01-20", label: "Savings",   amount: 200,  type: "transfer",category: "savings"  },
      ],
    };
    // start 1000 + 2000 − 800 − 60 − 200 = 1940
    const rows = buildActualsTimeline(plan, 1, 1000);
    const lastRow = rows[rows.length - 1];
    expect(lastRow.balance).toBe(1940);
  });

  it("sets the warning flag when balance drops below expectedMinBalance", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, expectedMinBalance: 900 },
      transactions: [
        { id: "t1", date: "2025-01-05", label: "Big expense", amount: 200, type: "outflow", category: "bill" },
      ],
    };
    const rows = buildActualsTimeline(plan, 1, 1000);
    // Jan 5: balance = 800 < 900 → warning
    const jan5 = rows.find((r) => r.date === "2025-01-05")!;
    expect(jan5.warning).toBe(true);
    // Jan 4: balance = 1000 ≥ 900 → no warning
    const jan4 = rows.find((r) => r.date === "2025-01-04")!;
    expect(jan4.warning).toBe(false);
  });
});

// ─── buildHybridTimeline ──────────────────────────────────────────────────────

describe("buildHybridTimeline — hybrid actuals + planned", () => {
  it("returns one row per day for the entire period", () => {
    const plan = makePlan();
    const rows = buildHybridTimeline(plan, 1, 1000);
    expect(rows).toHaveLength(31); // Jan has 31 days
    expect(rows[0].date).toBe("2025-01-01");
    expect(rows[30].date).toBe("2025-01-31");
  });

  it("uses actual transaction data for days on or before asOfDate", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, asOfDate: "2025-01-15" },
      transactions: [
        { id: "t1", date: "2025-01-10", label: "Actual salary", amount: 700, type: "income", category: "income" },
      ],
      incomeRules: [
        // Planned salary on Jan 20 — should only appear on future days
        { id: "salary", label: "Salary", amount: 2000, cadence: "monthly", seedDate: "2025-01-20", enabled: true },
      ],
    };
    const rows = buildHybridTimeline(plan, 1, 1000);
    const jan10 = rows.find((r) => r.date === "2025-01-10")!;
    // The actual transaction amount should be used, not the planned rule
    expect(jan10.income).toBe(700);
    expect(jan10.balance).toBe(1700);
  });

  it("uses planned events for days after asOfDate", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, asOfDate: "2025-01-10" },
      bills: [
        { id: "rent", label: "Rent", amount: 500, dueDay: 20, category: "bill", enabled: true },
      ],
      transactions: [], // no actuals
    };
    const rows = buildHybridTimeline(plan, 1, 1000);
    const jan20 = rows.find((r) => r.date === "2025-01-20")!;
    // Jan 20 is after asOfDate=Jan 10, so planned bill applies
    expect(jan20.outflow).toBe(500);
    expect(jan20.balance).toBe(500);
  });

  it("maintains constant balance before and after asOfDate when no events exist", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, asOfDate: "2025-01-15" },
      transactions: [],
    };
    const rows = buildHybridTimeline(plan, 1, 750);
    expect(rows.every((r) => r.balance === 750)).toBe(true);
  });

  it("seamlessly carries the running balance from the actuals section into the forecast section", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: { ...makePlan().setup, asOfDate: "2025-01-10" },
      transactions: [
        // Actual on Jan 5: +300
        { id: "t1", date: "2025-01-05", label: "Income actual", amount: 300, type: "income", category: "income" },
      ],
      bills: [
        // Planned bill on Jan 20: −200
        { id: "rent", label: "Rent", amount: 200, dueDay: 20, category: "bill", enabled: true },
      ],
    };
    const rows = buildHybridTimeline(plan, 1, 1000);
    // Jan 5 (actual): 1000 + 300 = 1300
    const jan5 = rows.find((r) => r.date === "2025-01-05")!;
    expect(jan5.balance).toBe(1300);
    // Jan 20 (planned): 1300 − 200 = 1100
    const jan20 = rows.find((r) => r.date === "2025-01-20")!;
    expect(jan20.balance).toBe(1100);
  });
});
