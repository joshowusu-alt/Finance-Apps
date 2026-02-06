import { describe, it, expect } from "vitest";
import { detectRecurringBills, toBillTemplate, getBillConfidenceLabel } from "../billDetection";
import type { Transaction } from "@/data/plan";

// Helper to create test transactions
function createTransaction(
    label: string,
    amount: number,
    date: string,
    category: "bill" = "bill"
): Transaction {
    return {
        id: Math.random().toString(36),
        label,
        amount,
        date,
        type: "outflow",
        category,
    };
}

describe("billDetection", () => {
    describe("detectRecurringBills", () => {
        it("detects monthly recurring bills", () => {
            const transactions: Transaction[] = [
                createTransaction("Netflix", 15.99, "2024-01-15"),
                createTransaction("Netflix", 15.99, "2024-02-15"),
                createTransaction("Netflix", 15.99, "2024-03-15"),
            ];

            const detected = detectRecurringBills(transactions);

            expect(detected.length).toBeGreaterThan(0);
            expect(detected[0].merchantName.toLowerCase()).toContain("netflix");
            expect(detected[0].frequency).toBe("monthly");
            expect(detected[0].averageAmount).toBeCloseTo(15.99, 1);
        });

        it("detects weekly recurring bills", () => {
            const transactions: Transaction[] = [
                createTransaction("Gym Class", 10, "2024-01-07"),
                createTransaction("Gym Class", 10, "2024-01-14"),
                createTransaction("Gym Class", 10, "2024-01-21"),
                createTransaction("Gym Class", 10, "2024-01-28"),
            ];

            const detected = detectRecurringBills(transactions);

            expect(detected.length).toBeGreaterThan(0);
            expect(detected[0].frequency).toBe("weekly");
        });

        it("ignores transactions with inconsistent amounts", () => {
            const transactions: Transaction[] = [
                createTransaction("Random Store", 50, "2024-01-15"),
                createTransaction("Random Store", 150, "2024-02-15"),
                createTransaction("Random Store", 25, "2024-03-15"),
            ];

            const detected = detectRecurringBills(transactions);

            // Should not detect due to inconsistent amounts
            expect(detected.length).toBe(0);
        });

        it("ignores income transactions", () => {
            const transactions: Transaction[] = [
                { id: "1", label: "Salary", amount: 3000, date: "2024-01-15", type: "income", category: "income" },
                { id: "2", label: "Salary", amount: 3000, date: "2024-02-15", type: "income", category: "income" },
                { id: "3", label: "Salary", amount: 3000, date: "2024-03-15", type: "income", category: "income" },
            ];

            const detected = detectRecurringBills(transactions);

            // Should not detect income as bills
            expect(detected.length).toBe(0);
        });

        it("requires at least 2 occurrences", () => {
            const transactions: Transaction[] = [
                createTransaction("One Time Purchase", 100, "2024-01-15"),
            ];

            const detected = detectRecurringBills(transactions);
            expect(detected.length).toBe(0);
        });

        it("suggests correct due day", () => {
            const transactions: Transaction[] = [
                createTransaction("Internet Bill", 35, "2024-01-20"),
                createTransaction("Internet Bill", 35, "2024-02-20"),
                createTransaction("Internet Bill", 35, "2024-03-20"),
            ];

            const detected = detectRecurringBills(transactions);

            expect(detected.length).toBeGreaterThan(0);
            expect(detected[0].suggestedDueDay).toBe(20);
        });

        it("excludes existing bills", () => {
            const transactions: Transaction[] = [
                createTransaction("Netflix", 15.99, "2024-01-15"),
                createTransaction("Netflix", 15.99, "2024-02-15"),
                createTransaction("Netflix", 15.99, "2024-03-15"),
            ];

            const existingBills = [
                { id: "1", label: "Netflix", amount: 15.99, dueDay: 15, category: "bill" as const, enabled: true },
            ];

            const detected = detectRecurringBills(transactions, existingBills);

            // Should not suggest Netflix since it already exists
            expect(detected.length).toBe(0);
        });
    });

    describe("toBillTemplate", () => {
        it("converts detected bill to template", () => {
            const detected = {
                id: "test-id",
                merchantName: "Netflix",
                averageAmount: 15.99,
                frequency: "monthly" as const,
                confidence: 85,
                occurrences: [],
                suggestedDueDay: 15,
                suggestedCategory: "bill" as const,
                suggestedBillTemplate: {
                    id: "test-id",
                    label: "Netflix",
                    amount: 15.99,
                    dueDay: 15,
                    category: "bill" as const,
                },
            };

            const template = toBillTemplate(detected);

            expect(template.label).toBe("Netflix");
            expect(template.amount).toBe(15.99);
            expect(template.dueDay).toBe(15);
            expect(template.enabled).toBe(true);
        });
    });

    describe("getBillConfidenceLabel", () => {
        it("returns high for 80+", () => {
            expect(getBillConfidenceLabel(80)).toBe("high");
            expect(getBillConfidenceLabel(95)).toBe("high");
        });

        it("returns medium for 60-79", () => {
            expect(getBillConfidenceLabel(60)).toBe("medium");
            expect(getBillConfidenceLabel(79)).toBe("medium");
        });

        it("returns low for below 60", () => {
            expect(getBillConfidenceLabel(59)).toBe("low");
            expect(getBillConfidenceLabel(30)).toBe("low");
        });
    });
});
