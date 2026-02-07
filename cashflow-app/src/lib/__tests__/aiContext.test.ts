import { describe, it, expect } from "vitest";
import {
    buildAIContext,
    calculatePace,
    generateProactiveInsights,
    formatContextForPrompt
} from "../aiContext";
import type { Plan } from "@/data/plan";

// Sample plan for testing
const createTestPlan = (overrides: Partial<Plan> = {}): Plan => ({
    version: 2,
    setup: {
        selectedPeriodId: 1,
        asOfDate: "2026-01-15",
        windowDays: 30,
        startingBalance: 1000,
        rollForwardBalance: true,
        expectedMinBalance: 500,
        variableCap: 300,
    },
    periods: [
        { id: 1, label: "Jan 2026", start: "2026-01-01", end: "2026-01-31" },
    ],
    incomeRules: [
        { id: "salary", label: "Salary", amount: 3000, cadence: "monthly", seedDate: "2026-01-26", enabled: true },
    ],
    outflowRules: [
        { id: "savings", label: "Savings", amount: 500, cadence: "monthly", seedDate: "2026-01-01", category: "savings", enabled: true },
    ],
    periodRuleOverrides: [],
    bills: [
        { id: "rent", label: "Rent", amount: 800, dueDay: 1, category: "bill", enabled: true },
        { id: "internet", label: "Internet", amount: 40, dueDay: 15, category: "bill", enabled: true },
    ],
    periodOverrides: [],
    eventOverrides: [],
    overrides: [],
    transactions: [
        { id: "txn-1", date: "2026-01-02", label: "Salary", amount: 3000, type: "income", category: "income" },
        { id: "txn-2", date: "2026-01-03", label: "Rent", amount: 800, type: "outflow", category: "bill" },
        { id: "txn-3", date: "2026-01-05", label: "Groceries", amount: 150, type: "outflow", category: "allowance" },
        { id: "txn-4", date: "2026-01-10", label: "Savings Transfer", amount: 500, type: "transfer", category: "savings" },
        { id: "txn-5", date: "2026-01-12", label: "Dining Out", amount: 80, type: "outflow", category: "allowance" },
    ],
    ...overrides,
});

describe("aiContext", () => {
    describe("calculatePace", () => {
        it("returns on-track when within 8% tolerance", () => {
            const result = calculatePace(500, 1000, 0.5);
            expect(result.status).toBe("on-track");
            expect(result.progress).toBe(0.5);
        });

        it("returns ahead when progress exceeds time by more than 8%", () => {
            const result = calculatePace(700, 1000, 0.5);
            expect(result.status).toBe("ahead");
            expect(result.gapPercent).toBeGreaterThan(0.08);
        });

        it("returns behind when progress is less than time by more than 8%", () => {
            const result = calculatePace(300, 1000, 0.5);
            expect(result.status).toBe("behind");
            expect(result.gapPercent).toBeLessThan(-0.08);
        });

        it("returns on-track for zero budget", () => {
            const result = calculatePace(100, 0, 0.5);
            expect(result.status).toBe("on-track");
            expect(result.progress).toBe(0);
        });
    });

    describe("buildAIContext", () => {
        it("returns correct structure with sample plan", () => {
            const plan = createTestPlan();
            const ctx = buildAIContext(plan);

            expect(ctx).toHaveProperty("period");
            expect(ctx).toHaveProperty("budget");
            expect(ctx).toHaveProperty("actuals");
            expect(ctx).toHaveProperty("variance");
            expect(ctx).toHaveProperty("forecast");
            expect(ctx).toHaveProperty("subscriptions");
            expect(ctx).toHaveProperty("insights");
            expect(ctx).toHaveProperty("recentTransactions");
        });

        it("calculates period timing correctly", () => {
            const plan = createTestPlan();
            const ctx = buildAIContext(plan);

            expect(ctx.period.label).toBe("Jan 2026");
            expect(ctx.period.start).toBe("2026-01-01");
            expect(ctx.period.end).toBe("2026-01-31");
            expect(ctx.period.daysTotal).toBe(31);
            expect(ctx.period.daysElapsed).toBe(15); // asOfDate is 2026-01-15
        });

        it("calculates actuals from transactions", () => {
            const plan = createTestPlan();
            const ctx = buildAIContext(plan);

            expect(ctx.actuals.income.amount).toBe(3000);
            expect(ctx.actuals.savings.amount).toBe(500);
            // Spending = 800 (rent) + 150 (groceries) + 80 (dining) = 1030
            expect(ctx.actuals.spending.amount).toBe(1030);
        });

        it("includes recent transactions", () => {
            const plan = createTestPlan();
            const ctx = buildAIContext(plan);

            expect(ctx.recentTransactions.length).toBeGreaterThan(0);
            expect(ctx.recentTransactions.length).toBeLessThanOrEqual(10);
        });

        it("includes variance by category", () => {
            const plan = createTestPlan();
            const ctx = buildAIContext(plan);

            expect(ctx.variance.byCategory.length).toBeGreaterThan(0);
            expect(ctx.variance.byCategory[0]).toHaveProperty("category");
            expect(ctx.variance.byCategory[0]).toHaveProperty("budgeted");
            expect(ctx.variance.byCategory[0]).toHaveProperty("actual");
            expect(ctx.variance.byCategory[0]).toHaveProperty("status");
        });
    });

    describe("generateProactiveInsights", () => {
        it("generates warning for overspent category", () => {
            const categoryVariance = [
                { category: "dining", budgeted: 100, actual: 200, variance: 100, status: "over" as const },
            ];

            const insights = generateProactiveInsights(
                createTestPlan(),
                1,
                categoryVariance,
                500,  // actualSpending
                400,  // budgetSpending
                100,  // actualSavings
                100,  // budgetSavings
                0.5,  // timeProgress
                null  // lowestBalance
            );

            const insight = insights.find(i => i.type === "info" && i.message.includes("dining"));
            expect(insight).toBeDefined();
        });

        it("generates success for good spending pace", () => {
            const insights = generateProactiveInsights(
                createTestPlan(),
                1,
                [],
                200,   // actualSpending (low)
                1000,  // budgetSpending
                100,   // actualSavings
                100,   // budgetSavings
                0.5,   // timeProgress (50% through)
                null
            );

            // 20% spent with 50% time = good pace
            const successInsight = insights.find(i => i.type === "success" && i.message.includes("under pace"));
            expect(successInsight).toBeDefined();
        });

        it("generates warning for balance risk", () => {
            const lowestBalance = { date: "2026-01-20", amount: 300 };

            const insights = generateProactiveInsights(
                createTestPlan(), // expectedMinBalance is 500
                1,
                [],
                500,
                500,
                100,
                100,
                0.5,
                lowestBalance
            );

            const riskInsight = insights.find(i => i.type === "info" && i.message.includes("balance may dip"));
            expect(riskInsight).toBeDefined();
        });
    });

    describe("formatContextForPrompt", () => {
        it("formats context into readable string", () => {
            const plan = createTestPlan();
            const ctx = buildAIContext(plan);
            const formatted = formatContextForPrompt(ctx);

            expect(formatted).toContain("FINANCIAL CONTEXT");
            expect(formatted).toContain("BUDGET VS ACTUALS");
            expect(formatted).toContain("SPENDING BY CATEGORY");
            expect(formatted).toContain("FORECAST");
        });

        it("includes currency formatting", () => {
            const plan = createTestPlan();
            const ctx = buildAIContext(plan);
            const formatted = formatContextForPrompt(ctx);

            // Should contain GBP currency formatting
            expect(formatted).toMatch(/£[\d,]+\.?\d*/);
        });
    });
});
