/**
 * Smart Bill Detection System
 * 
 * Analyzes transaction history to detect recurring charges that could be bills.
 * Uses pattern detection on merchant names, amounts, and timing.
 */

import type { Transaction, BillTemplate, CashflowCategory, Recurrence } from "@/data/plan";
import { dayDiff } from "@/lib/dateUtils";
import { normalizeMerchant } from "@/lib/textUtils";

export type DetectedBill = {
    id: string;
    merchantName: string;
    averageAmount: number;
    frequency: Recurrence;
    confidence: number; // 0-100
    occurrences: Array<{ date: string; amount: number }>;
    suggestedDueDay: number;
    suggestedCategory: CashflowCategory;
    suggestedBillTemplate: Partial<BillTemplate>;
};

type TransactionGroup = {
    merchantKey: string;
    transactions: Transaction[];
};

// Group transactions by normalized merchant name
function groupByMerchant(transactions: Transaction[]): TransactionGroup[] {
    const groups = new Map<string, Transaction[]>();

    for (const txn of transactions) {
        // Only consider outflows
        if (txn.type !== "outflow") continue;

        const key = normalizeMerchant(txn.label);
        if (!key || key.length < 3) continue;

        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(txn);
    }

    return Array.from(groups.entries())
        .map(([merchantKey, transactions]) => ({ merchantKey, transactions }))
        .filter((g) => g.transactions.length >= 2); // Need at least 2 occurrences
}

// Detect frequency pattern
function detectFrequency(dates: string[]): { frequency: Recurrence; confidence: number } | null {
    if (dates.length < 2) return null;

    const sortedDates = [...dates].sort();
    const gaps: number[] = [];

    for (let i = 1; i < sortedDates.length; i++) {
        gaps.push(dayDiff(sortedDates[i - 1], sortedDates[i]));
    }

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length;
    const stdDev = Math.sqrt(variance);

    // Calculate coefficient of variation (lower = more consistent)
    const cv = stdDev / avgGap;

    // Monthly: average gap around 28-31 days
    if (avgGap >= 26 && avgGap <= 35) {
        const confidence = Math.max(0, 100 - cv * 100);
        return { frequency: "monthly", confidence };
    }

    // Biweekly: average gap around 13-15 days
    if (avgGap >= 12 && avgGap <= 16) {
        const confidence = Math.max(0, 100 - cv * 100);
        return { frequency: "biweekly", confidence };
    }

    // Weekly: average gap around 6-8 days
    if (avgGap >= 5 && avgGap <= 9) {
        const confidence = Math.max(0, 100 - cv * 100);
        return { frequency: "weekly", confidence };
    }

    return null;
}

// Check if amounts are consistent (within tolerance)
function checkAmountConsistency(amounts: number[], tolerance = 0.15): { consistent: boolean; average: number; confidence: number } {
    const average = amounts.reduce((a, b) => a + b, 0) / amounts.length;

    // Count how many are within tolerance
    const withinTolerance = amounts.filter((amt) =>
        Math.abs(amt - average) / average <= tolerance
    ).length;

    const confidence = (withinTolerance / amounts.length) * 100;

    return {
        consistent: confidence >= 70,
        average: Math.round(average * 100) / 100,
        confidence,
    };
}

// Get most common day of month
function getMostCommonDueDay(dates: string[]): number {
    const dayCounts = new Map<number, number>();

    for (const date of dates) {
        const day = new Date(date + "T00:00:00").getDate();
        dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    }

    let maxCount = 0;
    let mostCommonDay = 1;

    dayCounts.forEach((count, day) => {
        if (count > maxCount) {
            maxCount = count;
            mostCommonDay = day;
        }
    });

    return mostCommonDay;
}

// Infer category from merchant and existing transaction categories
function inferCategory(transactions: Transaction[]): CashflowCategory {
    // Most common category in transactions
    const categoryCounts = new Map<CashflowCategory, number>();

    for (const txn of transactions) {
        categoryCounts.set(txn.category, (categoryCounts.get(txn.category) || 0) + 1);
    }

    let maxCount = 0;
    let mostCommon: CashflowCategory = "bill";

    categoryCounts.forEach((count, cat) => {
        if (count > maxCount) {
            maxCount = count;
            mostCommon = cat;
        }
    });

    return mostCommon;
}

// Generate unique ID for detected bill
function generateBillId(merchantKey: string): string {
    const clean = merchantKey.replace(/[^a-z0-9]/g, "-").slice(0, 20);
    return `detected-${clean}-${Date.now().toString(36)}`;
}

/**
 * Detect recurring bills from transaction history
 */
export function detectRecurringBills(
    transactions: Transaction[],
    existingBills: BillTemplate[] = []
): DetectedBill[] {
    const groups = groupByMerchant(transactions);
    const detectedBills: DetectedBill[] = [];

    // Get existing bill labels for filtering
    const existingLabels = new Set(
        existingBills.map((b) => normalizeMerchant(b.label))
    );

    for (const group of groups) {
        // Skip if already exists as a bill
        if (existingLabels.has(group.merchantKey)) continue;

        const dates = group.transactions.map((t) => t.date);
        const amounts = group.transactions.map((t) => t.amount);

        // Check frequency pattern
        const frequencyResult = detectFrequency(dates);
        if (!frequencyResult || frequencyResult.confidence < 50) continue;

        // Check amount consistency
        const amountResult = checkAmountConsistency(amounts);
        if (!amountResult.consistent) continue;

        // Calculate overall confidence
        const overallConfidence = (frequencyResult.confidence + amountResult.confidence) / 2;
        if (overallConfidence < 60) continue;

        // Get display name (capitalize)
        const displayName = group.merchantKey
            .split(" ")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");

        const dueDay = getMostCommonDueDay(dates);
        const category = inferCategory(group.transactions);

        const detectedBill: DetectedBill = {
            id: generateBillId(group.merchantKey),
            merchantName: displayName,
            averageAmount: amountResult.average,
            frequency: frequencyResult.frequency,
            confidence: Math.round(overallConfidence),
            occurrences: group.transactions.map((t) => ({ date: t.date, amount: t.amount })),
            suggestedDueDay: dueDay,
            suggestedCategory: category,
            suggestedBillTemplate: {
                id: generateBillId(group.merchantKey),
                label: displayName,
                amount: amountResult.average,
                dueDay,
                category,
                enabled: true,
            },
        };

        detectedBills.push(detectedBill);
    }

    // Sort by confidence (highest first)
    return detectedBills.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Convert detected bill to BillTemplate
 */
export function toBillTemplate(detected: DetectedBill): BillTemplate {
    return {
        id: detected.suggestedBillTemplate.id || detected.id,
        label: detected.suggestedBillTemplate.label || detected.merchantName,
        amount: detected.suggestedBillTemplate.amount || detected.averageAmount,
        dueDay: detected.suggestedBillTemplate.dueDay || detected.suggestedDueDay,
        category: detected.suggestedBillTemplate.category || detected.suggestedCategory,
        enabled: true,
    };
}

/**
 * Get confidence level label
 */
export function getBillConfidenceLabel(confidence: number): "high" | "medium" | "low" {
    if (confidence >= 80) return "high";
    if (confidence >= 60) return "medium";
    return "low";
}
