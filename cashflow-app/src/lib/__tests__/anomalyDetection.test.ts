import { describe, it, expect } from "vitest";
import { detectAnomalies } from "../anomalyDetection";
import { PLAN_VERSION } from "@/data/plan";
import type { Plan, Period, Transaction } from "@/data/plan";

// ─── Minimal plan builder ────────────────────────────────────────────────────

function makePlan(
  periods: Period[],
  currentPeriodId: number,
  transactions: Transaction[]
): Plan {
  return {
    version: PLAN_VERSION,
    setup: {
      selectedPeriodId: currentPeriodId,
      asOfDate: "2026-02-25",
      windowDays: 30,
      startingBalance: 1000,
      rollForwardBalance: false,
      expectedMinBalance: 0,
      variableCap: 0,
    },
    periods,
    incomeRules: [],
    outflowRules: [],
    periodRuleOverrides: [],
    bills: [],
    periodOverrides: [],
    eventOverrides: [],
    overrides: [],
    transactions,
    savingsGoals: [],
  };
}

// Biweekly periods for controlled test dates, IDs 1–N
function biweeeklyPeriods(count: number): Period[] {
  const periods: Period[] = [];
  const origin = new Date("2026-01-01");
  for (let i = 0; i < count; i++) {
    const start = new Date(origin);
    start.setDate(origin.getDate() + i * 14);
    const end = new Date(start);
    end.setDate(start.getDate() + 13);
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    periods.push({ id: i + 1, label: `P${i + 1}`, start: fmt(start), end: fmt(end) });
  }
  return periods;
}

// Helper: make a spending transaction on the first day of a period
function spendTxn(
  id: string,
  date: string,
  amount: number,
  category: Plan["transactions"][number]["category"]
): Transaction {
  return { id, date, label: "Test spend", amount, type: "outflow", category };
}

function incomeTxn(id: string, date: string, amount: number): Transaction {
  return { id, date, label: "Salary", amount, type: "income", category: "income" };
}

// ── Core detection ───────────────────────────────────────────────────────────

describe("detectAnomalies", () => {
  it("returns empty array when there are no prior periods", () => {
    const periods = biweeeklyPeriods(1);
    const plan = makePlan(periods, 1, [
      spendTxn("t1", periods[0].start, 200, "allowance"),
    ]);

    expect(detectAnomalies(plan)).toHaveLength(0);
  });

  it("returns empty array when current spending is below the 1.5× threshold", () => {
    // 3 prior periods each with £100 allowance → avg 100
    // Current period: £140 (ratio 1.4 < 1.5) → no anomaly
    const periods = biweeeklyPeriods(4);
    const txns: Transaction[] = [
      spendTxn("p1", periods[0].start, 100, "allowance"),
      spendTxn("p2", periods[1].start, 100, "allowance"),
      spendTxn("p3", periods[2].start, 100, "allowance"),
      spendTxn("cur", periods[3].start, 140, "allowance"), // 140/100 = 1.4
    ];
    const plan = makePlan(periods, 4, txns);

    expect(detectAnomalies(plan)).toHaveLength(0);
  });

  it("flags an anomaly when current spending is at exactly 1.5× the rolling average", () => {
    const periods = biweeeklyPeriods(4);
    const txns: Transaction[] = [
      spendTxn("p1", periods[0].start, 100, "allowance"),
      spendTxn("p2", periods[1].start, 100, "allowance"),
      spendTxn("p3", periods[2].start, 100, "allowance"),
      spendTxn("cur", periods[3].start, 150, "allowance"), // ratio = 1.5 exactly
    ];
    const plan = makePlan(periods, 4, txns);

    const anomalies = detectAnomalies(plan);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].category).toBe("allowance");
    expect(anomalies[0].ratio).toBeCloseTo(1.5, 5);
    expect(anomalies[0].currentAmount).toBe(150);
    expect(anomalies[0].avgAmount).toBe(100);
  });

  it("reports correct anomaly fields for a clearly over-budget period", () => {
    const periods = biweeeklyPeriods(4);
    const txns: Transaction[] = [
      spendTxn("p1", periods[0].start, 80,  "bill"),
      spendTxn("p2", periods[1].start, 100, "bill"),
      spendTxn("p3", periods[2].start, 120, "bill"),
      spendTxn("cur", periods[3].start, 400, "bill"), // avg=(80+100+120)/3=100, ratio=4
    ];
    const plan = makePlan(periods, 4, txns);

    const anomalies = detectAnomalies(plan);
    expect(anomalies).toHaveLength(1);
    const a = anomalies[0];
    expect(a.category).toBe("bill");
    expect(a.currentAmount).toBe(400);
    expect(a.avgAmount).toBeCloseTo(100);
    expect(a.ratio).toBeCloseTo(4);
    expect(a.periodsUsed).toBe(3);
  });

  it("uses rolling window of 3 — ignores periods older than the last 3", () => {
    // 5 periods total, current = 5
    // Period 1 (oldest, outside window): allowance = 5000
    // Periods 2, 3, 4 (inside window):   allowance = 10 each → avg = 10
    // Current (5):                        allowance = 18   → ratio = 1.8 → ANOMALY
    // If period 1 were included: avg = (5000+10+10)/3 = 1673 → ratio ≈ 0.01 → no anomaly
    const periods = biweeeklyPeriods(5);
    const txns: Transaction[] = [
      spendTxn("p1", periods[0].start, 5000, "allowance"), // outside rolling window
      spendTxn("p2", periods[1].start, 10,   "allowance"),
      spendTxn("p3", periods[2].start, 10,   "allowance"),
      spendTxn("p4", periods[3].start, 10,   "allowance"),
      spendTxn("cur", periods[4].start, 18,  "allowance"), // 18/10 = 1.8 → anomaly
    ];
    const plan = makePlan(periods, 5, txns);

    const anomalies = detectAnomalies(plan);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].periodsUsed).toBe(3); // periods 2, 3, 4
    expect(anomalies[0].ratio).toBeCloseTo(1.8, 5);
  });
});

// ── Exclusions ───────────────────────────────────────────────────────────────

describe("detectAnomalies exclusions", () => {
  it("never flags the income category, even at very high ratios", () => {
    const periods = biweeeklyPeriods(4);
    const txns: Transaction[] = [
      incomeTxn("p1", periods[0].start, 100),
      incomeTxn("p2", periods[1].start, 100),
      incomeTxn("p3", periods[2].start, 100),
      incomeTxn("cur", periods[3].start, 9999), // absurdly high income
    ];
    const plan = makePlan(periods, 4, txns);

    expect(detectAnomalies(plan)).toHaveLength(0);
  });

  it("never flags the buffer category", () => {
    const periods = biweeeklyPeriods(4);
    const txns: Transaction[] = [
      spendTxn("p1", periods[0].start, 100, "buffer"),
      spendTxn("p2", periods[1].start, 100, "buffer"),
      spendTxn("p3", periods[2].start, 100, "buffer"),
      spendTxn("cur", periods[3].start, 9999, "buffer"),
    ];
    const plan = makePlan(periods, 4, txns);

    const anomalies = detectAnomalies(plan).filter((a) => a.category === "buffer");
    expect(anomalies).toHaveLength(0);
  });

  it("ignores categories whose rolling average is below £5", () => {
    // Prior spend: £2 each → avg 2 (below MIN_AVG_AMOUNT of £5)
    const periods = biweeeklyPeriods(4);
    const txns: Transaction[] = [
      spendTxn("p1", periods[0].start, 2, "other"),
      spendTxn("p2", periods[1].start, 2, "other"),
      spendTxn("p3", periods[2].start, 2, "other"),
      spendTxn("cur", periods[3].start, 100, "other"), // ratio = 50 but avg < £5
    ];
    const plan = makePlan(periods, 4, txns);

    expect(detectAnomalies(plan)).toHaveLength(0);
  });

  it("does not flag a category with no prior spending history", () => {
    // allowance only appears in the current period — no prior totals to compare
    const periods = biweeeklyPeriods(4);
    const txns: Transaction[] = [
      spendTxn("p1", periods[0].start, 50, "bill"), // different category
      spendTxn("p2", periods[1].start, 50, "bill"),
      spendTxn("p3", periods[2].start, 50, "bill"),
      spendTxn("cur", periods[3].start, 200, "allowance"), // only in current, no prior history
    ];
    const plan = makePlan(periods, 4, txns);

    const anomalies = detectAnomalies(plan);
    const allowanceAnomaly = anomalies.find((a) => a.category === "allowance");
    expect(allowanceAnomaly).toBeUndefined();
  });
});

// ── Sorting & multiple anomalies ─────────────────────────────────────────────

describe("detectAnomalies sorting", () => {
  it("returns multiple anomalies sorted by ratio descending", () => {
    const periods = biweeeklyPeriods(4);
    const txns: Transaction[] = [
      // "bill" category: avg 50, current 300 → ratio 6
      spendTxn("p1-bill", periods[0].start, 50,  "bill"),
      spendTxn("p2-bill", periods[1].start, 50,  "bill"),
      spendTxn("p3-bill", periods[2].start, 50,  "bill"),
      // "allowance" category: avg 100, current 200 → ratio 2
      spendTxn("p1-alw", periods[0].start, 100, "allowance"),
      spendTxn("p2-alw", periods[1].start, 100, "allowance"),
      spendTxn("p3-alw", periods[2].start, 100, "allowance"),
      // Current period
      spendTxn("cur-bill", periods[3].start, 300, "bill"),         // ratio 6
      spendTxn("cur-alw",  periods[3].start, 200, "allowance"),    // ratio 2
    ];
    const plan = makePlan(periods, 4, txns);

    const anomalies = detectAnomalies(plan);
    expect(anomalies.length).toBeGreaterThanOrEqual(2);
    // Highest ratio first
    expect(anomalies[0].category).toBe("bill");
    expect(anomalies[0].ratio).toBeCloseTo(6);
    expect(anomalies[1].category).toBe("allowance");
    expect(anomalies[1].ratio).toBeCloseTo(2);
  });
});

// ── Transfer transactions ─────────────────────────────────────────────────────

describe("detectAnomalies with transfer transactions", () => {
  it("includes transfer transactions in category totals", () => {
    // detectAnomalies uses sumByCategory which includes both outflow + transfer
    const periods = biweeeklyPeriods(4);
    const txns: Transaction[] = [
      // Prior periods: £50/period savings via transfer
      { id: "p1", date: periods[0].start, label: "Savings", amount: 50, type: "transfer", category: "savings" },
      { id: "p2", date: periods[1].start, label: "Savings", amount: 50, type: "transfer", category: "savings" },
      { id: "p3", date: periods[2].start, label: "Savings", amount: 50, type: "transfer", category: "savings" },
      // Current: £200 savings transfer → ratio 4 → anomaly
      { id: "cur", date: periods[3].start, label: "Savings", amount: 200, type: "transfer", category: "savings" },
    ];
    const plan = makePlan(periods, 4, txns);

    const anomalies = detectAnomalies(plan);
    const savingsAnomaly = anomalies.find((a) => a.category === "savings");
    expect(savingsAnomaly).toBeDefined();
    expect(savingsAnomaly!.ratio).toBeCloseTo(4);
  });
});
