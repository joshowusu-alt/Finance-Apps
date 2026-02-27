import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { Plan } from "@/data/plan";

// ─── localStorage stub ────────────────────────────────────────────────────────
// storage.ts checks `typeof window` at call time (not at import time), so
// stubbing `window` here — before any test runs but after imports — is safe.

const store: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (index: number) => Object.keys(store)[index] ?? null,
};

vi.stubGlobal("window", {
  localStorage: localStorageMock,
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

// currency.ts accesses `localStorage` as a bare global (not window.localStorage)
// so we need to stub it separately to avoid ReferenceError in the audit path.
vi.stubGlobal("localStorage", localStorageMock);

// Import after stubbing global — functions see `window` at call time.
import {
  savePlan,
  loadPlan,
  hasStoredPlan,
  createFreshPlan,
  advancePlanToCurrentPeriod,
} from "@/lib/storage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlan(): Plan {
  return {
    version: 2,
    setup: {
      selectedPeriodId: 1,
      asOfDate: "2025-06-15",
      windowDays: 30,
      startingBalance: 500,
      rollForwardBalance: false,
      expectedMinBalance: 0,
      variableCap: 0,
    },
    periods: [
      { id: 1, label: "P1", start: "2025-06-01", end: "2025-06-30" },
      { id: 2, label: "P2", start: "2025-07-01", end: "2025-07-31" },
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

// ─── beforeEach: wipe localStorage between tests ──────────────────────────────

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// ─── savePlan + loadPlan roundtrip ────────────────────────────────────────────

describe("savePlan + loadPlan roundtrip", () => {
  it("loads back a plan identical to the one that was saved", () => {
    const original = makePlan();
    original.setup.startingBalance = 1234;
    original.setup.asOfDate = "2025-06-20";

    savePlan(original);
    const loaded = loadPlan();

    expect(loaded.setup.startingBalance).toBe(1234);
    expect(loaded.setup.asOfDate).toBe("2025-06-20");
    expect(loaded.setup.selectedPeriodId).toBe(1);
  });

  it("preserves income, outflow and bill arrays through a roundtrip", () => {
    const plan = makePlan();
    plan.incomeRules = [
      { id: "salary", label: "Salary", amount: 2000, cadence: "monthly", seedDate: "2025-06-01", enabled: true },
    ];
    plan.bills = [
      { id: "rent", label: "Rent", amount: 800, dueDay: 1, category: "bill", enabled: true },
    ];
    plan.transactions = [
      { id: "t1", date: "2025-06-01", label: "Salary", amount: 2000, type: "income", category: "income" },
    ];

    savePlan(plan);
    const loaded = loadPlan();

    expect(loaded.incomeRules).toHaveLength(1);
    expect(loaded.incomeRules[0].amount).toBe(2000);
    expect(loaded.bills).toHaveLength(1);
    expect(loaded.bills[0].id).toBe("rent");
    expect(loaded.transactions).toHaveLength(1);
    expect(loaded.transactions[0].id).toBe("t1");
  });

  it("round-trips nested savingsGoals data", () => {
    const plan = makePlan();
    plan.savingsGoals = [
      {
        id: "goal-1",
        name: "Emergency Fund",
        targetAmount: 3000,
        currentAmount: 500,
        createdAt: "2025-01-01",
        icon: "🛡️",
      },
    ];

    savePlan(plan);
    const loaded = loadPlan();

    expect(loaded.savingsGoals).toHaveLength(1);
    expect(loaded.savingsGoals![0].name).toBe("Emergency Fund");
    expect(loaded.savingsGoals![0].targetAmount).toBe(3000);
  });
});

// ─── hasStoredPlan ────────────────────────────────────────────────────────────

describe("hasStoredPlan", () => {
  it("returns false when localStorage is empty", () => {
    expect(hasStoredPlan()).toBe(false);
  });

  it("returns true after savePlan is called", () => {
    savePlan(makePlan());
    expect(hasStoredPlan()).toBe(true);
  });

  it("returns false again after localStorage is cleared", () => {
    savePlan(makePlan());
    expect(hasStoredPlan()).toBe(true);
    localStorageMock.clear();
    expect(hasStoredPlan()).toBe(false);
  });
});

// ─── createFreshPlan ──────────────────────────────────────────────────────────

describe("createFreshPlan", () => {
  it("returns a plan with empty incomeRules, outflowRules, bills, and transactions", () => {
    const plan = createFreshPlan();
    expect(plan.incomeRules).toEqual([]);
    expect(plan.outflowRules).toEqual([]);
    expect(plan.bills).toEqual([]);
    expect(plan.transactions).toEqual([]);
  });

  it("returns a plan with empty overrides arrays", () => {
    const plan = createFreshPlan();
    expect(plan.periodOverrides).toEqual([]);
    expect(plan.eventOverrides).toEqual([]);
    expect(plan.overrides).toEqual([]);
  });

  it("sets asOfDate to today's date (ISO string)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27"));
    try {
      const plan = createFreshPlan();
      expect(plan.setup.asOfDate).toBe("2026-02-27");
    } finally {
      vi.useRealTimers();
    }
  });
});

// ─── advancePlanToCurrentPeriod ───────────────────────────────────────────────

describe("advancePlanToCurrentPeriod", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates asOfDate to today when autoUpdateAsOfDate is true (default)", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: {
        ...makePlan().setup,
        asOfDate: "2025-01-15",
        selectedPeriodId: 1,
        // autoUpdateAsOfDate omitted → defaults to true
      },
      periods: [
        { id: 1, label: "Jan 2026", start: "2026-01-01", end: "2026-01-31" },
        { id: 2, label: "Feb 2026", start: "2026-02-01", end: "2026-02-28" },
      ],
    };

    const advanced = advancePlanToCurrentPeriod(plan);
    // Today is 2026-02-27 → should advance asOfDate
    expect(advanced.setup.asOfDate).toBe("2026-02-27");
  });

  it("selects the period that contains today", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: {
        ...makePlan().setup,
        asOfDate: "2026-01-01",
        selectedPeriodId: 1,
      },
      periods: [
        { id: 1, label: "Jan 2026", start: "2026-01-01", end: "2026-01-31" },
        { id: 2, label: "Feb 2026", start: "2026-02-01", end: "2026-02-28" }, // ← today is here
        { id: 3, label: "Mar 2026", start: "2026-03-01", end: "2026-03-31" },
      ],
    };

    const advanced = advancePlanToCurrentPeriod(plan);
    // Today (Feb 27) is in period 2
    expect(advanced.setup.selectedPeriodId).toBe(2);
  });

  it("does NOT update asOfDate when autoUpdateAsOfDate is false", () => {
    const originalAsOfDate = "2025-12-01";
    const plan: Plan = {
      ...makePlan(),
      setup: {
        ...makePlan().setup,
        asOfDate: originalAsOfDate,
        autoUpdateAsOfDate: false,
        selectedPeriodId: 1,
      },
      periods: [
        { id: 1, label: "Feb 2026", start: "2026-02-01", end: "2026-02-28" },
      ],
    };

    const advanced = advancePlanToCurrentPeriod(plan);
    // autoUpdateAsOfDate=false → asOfDate is left untouched
    expect(advanced.setup.asOfDate).toBe(originalAsOfDate);
  });

  it("still selects the current period even when autoUpdateAsOfDate is false", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: {
        ...makePlan().setup,
        asOfDate: "2025-12-01",
        autoUpdateAsOfDate: false,
        selectedPeriodId: 99, // bogus — should be replaced
      },
      periods: [
        { id: 1, label: "Jan 2026", start: "2026-01-01", end: "2026-01-31" },
        { id: 2, label: "Feb 2026", start: "2026-02-01", end: "2026-02-28" },
      ],
    };

    const advanced = advancePlanToCurrentPeriod(plan);
    expect(advanced.setup.selectedPeriodId).toBe(2); // Feb 2026 contains today
  });

  it("does not mutate the original plan object", () => {
    const plan = makePlan();
    const originalAsOfDate = plan.setup.asOfDate;
    advancePlanToCurrentPeriod(plan);
    // Original plan is untouched (function returns a new object)
    expect(plan.setup.asOfDate).toBe(originalAsOfDate);
  });

  it("leaves asOfDate unchanged when it is already today", () => {
    const plan: Plan = {
      ...makePlan(),
      setup: {
        ...makePlan().setup,
        asOfDate: "2026-02-27", // already today
        selectedPeriodId: 1,
      },
      periods: [
        { id: 1, label: "Feb 2026", start: "2026-02-01", end: "2026-02-28" },
      ],
    };

    const advanced = advancePlanToCurrentPeriod(plan);
    expect(advanced.setup.asOfDate).toBe("2026-02-27");
    expect(advanced.setup.selectedPeriodId).toBe(1);
  });
});

// ─── Plan cache invalidation ──────────────────────────────────────────────────

describe("plan cache invalidation", () => {
  it("returns the newly saved plan after overwriting with a different plan", () => {
    const planA = makePlan();
    planA.setup.startingBalance = 1000;

    const planB = makePlan();
    planB.setup.startingBalance = 9999;

    savePlan(planA);
    expect(loadPlan().setup.startingBalance).toBe(1000);

    savePlan(planB);
    expect(loadPlan().setup.startingBalance).toBe(9999);
  });

  it("reflects structural changes (new income rule) after re-save", () => {
    const base = makePlan();
    savePlan(base);
    expect(loadPlan().incomeRules).toHaveLength(0);

    const updated = {
      ...base,
      incomeRules: [
        { id: "salary", label: "Salary", amount: 2000, cadence: "monthly" as const, seedDate: "2025-06-01", enabled: true },
      ],
    };
    savePlan(updated);
    expect(loadPlan().incomeRules).toHaveLength(1);
    expect(loadPlan().incomeRules[0].id).toBe("salary");
  });
});
