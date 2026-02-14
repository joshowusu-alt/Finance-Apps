/**
 * AI Context Builder
 * 
 * Generates rich financial context for the AI assistant by extracting
 * computed insights from the cashflow engine, variance analysis, and
 * bill detection systems.
 */

import type { Plan, Transaction, CashflowCategory, Period } from "@/data/plan";
import {
    generateEvents,
    getPeriod,
    getStartingBalance,
    buildTimeline,
    getVarianceByCategory,
    minPoint,
} from "@/lib/cashflowEngine";
import { detectSubscriptions } from "@/lib/subscriptionDetection";
import { formatMoney } from "@/lib/currency";
import { toUtcDay, dayDiff, clamp } from "@/lib/dateUtils";

// ============================================================================
// Types
// ============================================================================

export interface PaceStatus {
    status: "ahead" | "on-track" | "behind";
    progress: number;
    gapPercent: number;
}

export interface CategoryVariance {
    category: string;
    budgeted: number;
    actual: number;
    variance: number;
    status: "over" | "under" | "on-target";
}

export interface ProactiveInsight {
    type: "warning" | "success" | "info";
    message: string;
    priority: number;
}

export interface ForecastScenario {
    label: string;
    endBalance: number;
    leftover: number;
}

export interface DetectedSubscription {
    name: string;
    amount: number;
    frequency: string;
    confidence: number;
}

export interface AIFinancialContext {
    period: {
        label: string;
        start: string;
        end: string;
        daysElapsed: number;
        daysTotal: number;
        timeProgress: number;
    };

    budget: {
        income: number;
        spending: number;
        savings: number;
        leftover: number;
    };

    // Smart expected amounts based on scheduled events, not linear time
    expectedByToday: {
        income: number;
        spending: number;
        savings: number;
    };

    actuals: {
        income: { amount: number; progress: number; pace: PaceStatus };
        spending: { amount: number; progress: number; pace: PaceStatus };
        savings: { amount: number; progress: number; pace: PaceStatus };
        leftover: number;
    };

    // Smart pace that compares actual vs expected-by-today (not linear)
    smartPace: {
        spending: { status: "ahead" | "on-track" | "behind"; variance: number; isNormal: boolean; reason: string };
        income: { status: "ahead" | "on-track" | "behind"; variance: number; isNormal: boolean; reason: string };
        savings: { status: "ahead" | "on-track" | "behind"; variance: number; isNormal: boolean; reason: string };
        spendingPattern: "front-loaded" | "back-loaded" | "even";
    };

    variance: {
        overall: { status: "over" | "under" | "on-target"; amount: number };
        byCategory: CategoryVariance[];
        overspentCategories: string[];
        underspentCategories: string[];
    };

    forecast: {
        projectedEndBalance: number;
        lowestBalance: { date: string; amount: number } | null;
        riskDays: number;
        scenarios: ForecastScenario[];
    };

    subscriptions: {
        detected: DetectedSubscription[];
        totalMonthly: number;
    };

    insights: ProactiveInsight[];

    recentTransactions: Array<{
        date: string;
        label: string;
        amount: number;
        category: string;
        type: string;
    }>;
}

// ============================================================================
// Pace Analysis
// ============================================================================

export function calculatePace(actual: number, budget: number, timeProgress: number): PaceStatus {
    if (budget <= 0) {
        return { status: "on-track", progress: 0, gapPercent: 0 };
    }

    const progress = actual / budget;
    const gapPercent = progress - timeProgress;

    // Within 8% tolerance = on-track
    if (Math.abs(gapPercent) <= 0.08) {
        return { status: "on-track", progress, gapPercent };
    }

    return {
        status: gapPercent > 0 ? "ahead" : "behind",
        progress,
        gapPercent,
    };
}

// ============================================================================
// Proactive Insights Generator
// ============================================================================

export function generateProactiveInsights(
    plan: Plan,
    periodId: number,
    categoryVariance: CategoryVariance[],
    actualSpending: number,
    budgetSpending: number,
    actualSavings: number,
    budgetSavings: number,
    timeProgress: number,
    lowestBalance: { date: string; amount: number } | null,
    smartPace?: {
        spending: { status: string; variance: number; isNormal: boolean; reason: string };
        spendingPattern: "front-loaded" | "back-loaded" | "even";
    },
    daysRemaining?: number,
    dailyBudget?: number
): ProactiveInsight[] {
    const insights: ProactiveInsight[] = [];
    const daysLeft = daysRemaining ?? Math.max(1, Math.round((1 - timeProgress) * 30));
    const dailyBudgetAmount = dailyBudget ?? (budgetSpending - actualSpending) / daysLeft;

    // =========================================================================
    // SMART SPENDING INSIGHT (uses user's unique bill pattern)
    // =========================================================================
    if (smartPace) {
        if (smartPace.spending.isNormal || smartPace.spending.status === "on-track") {
            // User is on track - celebrate and give context
            if (smartPace.spendingPattern === "front-loaded" && timeProgress < 0.5) {
                insights.push({
                    type: "success",
                    message: `Your bills are front-loaded, so spending looks high but you're right on schedule. ${formatMoney(dailyBudgetAmount)}/day available.`,
                    priority: 9,
                });
            } else {
                insights.push({
                    type: "success",
                    message: `On track! You can comfortably spend ${formatMoney(dailyBudgetAmount)}/day for the next ${daysLeft} days.`,
                    priority: 9,
                });
            }
        } else if (smartPace.spending.status === "ahead" && !smartPace.spending.isNormal) {
            // Truly ahead of schedule - gentle guidance
            insights.push({
                type: "info",
                message: `Running ${formatMoney(Math.abs(smartPace.spending.variance))} ahead of your usual pace. Aim for ${formatMoney(Math.max(0, dailyBudgetAmount))}/day to stay balanced.`,
                priority: 8,
            });
        } else if (smartPace.spending.status === "behind") {
            // Under budget - positive reinforcement
            insights.push({
                type: "success",
                message: `Nice work! ${formatMoney(Math.abs(smartPace.spending.variance))} under your typical pace — extra cushion to save or enjoy.`,
                priority: 9,
            });
        }
    } else {
        // Fallback to linear pace if smart pace not available
        if (timeProgress > 0.1) {
            const spendingPace = budgetSpending > 0 ? actualSpending / budgetSpending : 0;
            if (spendingPace < timeProgress - 0.1) {
                insights.push({
                    type: "success",
                    message: `Spending nicely under pace. ${formatMoney(dailyBudgetAmount)}/day available.`,
                    priority: 7,
                });
            }
        }
    }

    // =========================================================================
    // CATEGORY-SPECIFIC INSIGHTS (personalized to their spending)
    // =========================================================================
    const overspent = categoryVariance.filter(v => v.status === "over" && v.variance > 20 && v.category !== "income");
    const underspent = categoryVariance.filter(v => v.status === "under" && Math.abs(v.variance) > 20 && v.category !== "income");

    if (overspent.length > 0) {
        const top = overspent.sort((a, b) => b.variance - a.variance)[0];
        // Give context, not just the number
        const percentOver = top.budgeted > 0 ? Math.round((top.variance / top.budgeted) * 100) : 0;
        insights.push({
            type: "info",
            message: `${top.category} is ${percentOver}% over (${formatMoney(top.variance)}) — worth reviewing if this continues.`,
            priority: 7,
        });
    }

    if (underspent.length > 0 && insights.length < 3) {
        const top = underspent.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))[0];
        insights.push({
            type: "success",
            message: `${formatMoney(Math.abs(top.variance))} unused in ${top.category} — could redirect to savings.`,
            priority: 5,
        });
    }

    // =========================================================================
    // SAVINGS INSIGHT (encouraging, not alarming)
    // =========================================================================
    if (budgetSavings > 0 && timeProgress > 0.2) {
        const savingsProgress = actualSavings / budgetSavings;
        if (savingsProgress >= 1) {
            insights.push({
                type: "success",
                message: "Savings goal already met! Consider adding more or treating yourself.",
                priority: 6,
            });
        } else if (savingsProgress >= timeProgress) {
            insights.push({
                type: "success",
                message: `Savings on track at ${Math.round(savingsProgress * 100)}% of target.`,
                priority: 4,
            });
        } else if (savingsProgress < timeProgress - 0.15) {
            const catchUpAmount = (budgetSavings - actualSavings) / Math.max(1, daysLeft / 7);
            insights.push({
                type: "info",
                message: `Savings slightly behind. ${formatMoney(catchUpAmount)}/week would catch you up.`,
                priority: 6,
            });
        }
    }

    // =========================================================================
    // BALANCE HEALTH (forward-looking, contextual)
    // =========================================================================
    if (lowestBalance && lowestBalance.amount < plan.setup.expectedMinBalance) {
        const shortfall = plan.setup.expectedMinBalance - lowestBalance.amount;
        const riskDate = new Date(lowestBalance.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        insights.push({
            type: "info",
            message: `Heads up: balance may dip ${formatMoney(shortfall)} below your buffer around ${riskDate}.`,
            priority: 8,
        });
    } else if (lowestBalance && insights.length < 4) {
        insights.push({
            type: "success",
            message: "Balance stays healthy throughout the period.",
            priority: 3,
        });
    }

    // Sort by priority (highest first) and return top insights
    return insights.sort((a, b) => b.priority - a.priority).slice(0, 4);
}

// ============================================================================
// Main Context Builder
// ============================================================================

export function buildAIContext(plan: Plan): AIFinancialContext {
    const periodId = plan.setup.selectedPeriodId;
    const period = getPeriod(plan, periodId);

    // Period timing
    const periodDays = dayDiff(period.start, period.end) + 1;
    const daysElapsedRaw = dayDiff(period.start, plan.setup.asOfDate) + 1;
    const daysElapsed = clamp(daysElapsedRaw, 0, periodDays);
    const timeProgress = periodDays > 0 ? daysElapsed / periodDays : 0;

    // Generate events and timeline
    const events = generateEvents(plan, periodId);
    const startingBalance = getStartingBalance(plan, periodId);
    const timeline = buildTimeline(plan, periodId, startingBalance);
    const lowest = minPoint(timeline);

    // Filter period transactions
    const periodTransactions = plan.transactions.filter(
        t => t.date >= period.start && t.date <= period.end
    );

    // Budget calculations
    const budgetIncome = events.filter(e => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
    const budgetOutflows = events.filter(e => e.type === "outflow").reduce((sum, e) => sum + e.amount, 0);
    const budgetSavings = events
        .filter(e => e.type === "outflow" && e.category === "savings")
        .reduce((sum, e) => sum + e.amount, 0);
    const budgetSpending = budgetOutflows - budgetSavings;
    const budgetLeftover = budgetIncome - budgetOutflows;

    // Actual calculations
    const actualIncome = periodTransactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
    const actualSavings = periodTransactions
        .filter(t => t.category === "savings")
        .reduce((sum, t) => sum + t.amount, 0);
    const actualSpending = periodTransactions
        .filter(t => t.type === "outflow" && t.category !== "savings")
        .reduce((sum, t) => sum + t.amount, 0);
    const actualLeftover = actualIncome - actualSpending - actualSavings;

    // Pace calculations
    const incomePace = calculatePace(actualIncome, budgetIncome, timeProgress);
    const spendingPace = calculatePace(actualSpending, budgetSpending, timeProgress);
    const savingsPace = calculatePace(actualSavings, budgetSavings, timeProgress);

    // Variance analysis
    const varianceData = getVarianceByCategory(plan, periodId);
    const categoryVariance: CategoryVariance[] = Object.values(varianceData)
        .filter((v): v is NonNullable<typeof v> => v !== null && v !== undefined)
        .map(v => ({
            category: v.category,
            budgeted: v.budgeted,
            actual: v.actual,
            variance: v.variance,
            status: v.status as "over" | "under" | "on-target",
        }));

    const overspentCategories = categoryVariance
        .filter(v => v.status === "over" && v.category !== "income")
        .map(v => v.category);
    const underspentCategories = categoryVariance
        .filter(v => v.status === "under" && v.category !== "income")
        .map(v => v.category);

    // Overall variance
    const totalVariance = actualSpending - budgetSpending;
    const overallStatus: "over" | "under" | "on-target" =
        totalVariance > 10 ? "over" : totalVariance < -10 ? "under" : "on-target";

    // Forecast scenarios
    const projectedEndBalance = timeline.length > 0
        ? timeline[timeline.length - 1].balance
        : startingBalance;

    const projectedSpending = timeProgress > 0 ? actualSpending / timeProgress : actualSpending;
    const projectedIncome = timeProgress > 0 ? actualIncome / timeProgress : actualIncome;
    const projectedSavings = timeProgress > 0 ? actualSavings / timeProgress : actualSavings;

    const scenarios: ForecastScenario[] = [
        {
            label: "Conservative",
            endBalance: startingBalance + (projectedIncome * 0.95) - (projectedSpending * 1.05) - projectedSavings,
            leftover: (projectedIncome * 0.95) - (projectedSpending * 1.05) - projectedSavings,
        },
        {
            label: "Current Pace",
            endBalance: startingBalance + projectedIncome - projectedSpending - projectedSavings,
            leftover: projectedIncome - projectedSpending - projectedSavings,
        },
        {
            label: "Optimistic",
            endBalance: startingBalance + (projectedIncome * 1.05) - (projectedSpending * 0.95) - projectedSavings,
            leftover: (projectedIncome * 1.05) - (projectedSpending * 0.95) - projectedSavings,
        },
    ];

    // Risk days calculation
    const riskDays = timeline.filter(row => row.balance < plan.setup.expectedMinBalance).length;

    // Subscription detection
    const detectedSubscriptions = detectSubscriptions(plan.transactions, { asOfDate: plan.setup.asOfDate });
    const subscriptions: DetectedSubscription[] = detectedSubscriptions.map(sub => ({
        name: sub.merchantName,
        amount: sub.averageAmount,
        frequency: sub.frequency,
        confidence: sub.confidence,
    }));
    const totalMonthlySubscriptions = detectedSubscriptions.reduce((sum, s) => sum + s.monthlyCost, 0);

    // Recent transactions (last 10)
    const recentTransactions = [...periodTransactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)
        .map(t => ({
            date: t.date,
            label: t.label,
            amount: t.amount,
            category: t.category,
            type: t.type,
        }));

    // Generate proactive insights (deferred until after smart pace calculation)
    const lowestBalance = lowest ? { date: lowest.date, amount: lowest.balance } : null;

    // ========================================================================
    // SMART PACE ANALYSIS - Based on scheduled events, not linear time
    // ========================================================================

    // Calculate what SHOULD have been spent/received by today based on scheduled dates
    const today = plan.setup.asOfDate;
    const eventsUpToToday = events.filter(e => e.date <= today);

    const expectedIncomeByToday = eventsUpToToday
        .filter(e => e.type === "income")
        .reduce((sum, e) => sum + e.amount, 0);

    const expectedOutflowsByToday = eventsUpToToday
        .filter(e => e.type === "outflow")
        .reduce((sum, e) => sum + e.amount, 0);

    const expectedSavingsByToday = eventsUpToToday
        .filter(e => e.type === "outflow" && e.category === "savings")
        .reduce((sum, e) => sum + e.amount, 0);

    const expectedSpendingByToday = expectedOutflowsByToday - expectedSavingsByToday;

    // Detect spending pattern (front-loaded, back-loaded, or even)
    const firstHalfEnd = period.start.slice(0, 8) + String(Math.floor(periodDays / 2) + parseInt(period.start.slice(-2))).padStart(2, "0");
    const firstHalfEvents = events.filter(e => e.date <= firstHalfEnd && e.type === "outflow");
    const secondHalfEvents = events.filter(e => e.date > firstHalfEnd && e.type === "outflow");
    const firstHalfTotal = firstHalfEvents.reduce((sum, e) => sum + e.amount, 0);
    const secondHalfTotal = secondHalfEvents.reduce((sum, e) => sum + e.amount, 0);

    let spendingPattern: "front-loaded" | "back-loaded" | "even" = "even";
    if (budgetOutflows > 0) {
        const firstHalfRatio = firstHalfTotal / budgetOutflows;
        if (firstHalfRatio > 0.6) spendingPattern = "front-loaded";
        else if (firstHalfRatio < 0.4) spendingPattern = "back-loaded";
    }

    // Calculate smart pace (comparing actual to what was EXPECTED by today)
    function calculateSmartPace(actual: number, expectedByToday: number, totalBudget: number): {
        status: "ahead" | "on-track" | "behind";
        variance: number;
        isNormal: boolean;
        reason: string
    } {
        const variance = actual - expectedByToday;
        const percentOfBudget = totalBudget > 0 ? Math.abs(variance) / totalBudget : 0;

        // Within 5% of budget = on-track
        if (percentOfBudget <= 0.05) {
            return { status: "on-track", variance, isNormal: true, reason: "Aligned with scheduled expectations" };
        }

        if (variance > 0) {
            // Spending more than expected
            return {
                status: "ahead",
                variance,
                isNormal: false,
                reason: `${formatMoney(Math.abs(variance))} more than scheduled by today`
            };
        } else {
            // Spending less than expected
            return {
                status: "behind",
                variance,
                isNormal: true,
                reason: `${formatMoney(Math.abs(variance))} less spent than scheduled`
            };
        }
    }

    const smartSpendingPace = calculateSmartPace(actualSpending, expectedSpendingByToday, budgetSpending);
    const smartIncomePace = calculateSmartPace(actualIncome, expectedIncomeByToday, budgetIncome);
    const smartSavingsPace = calculateSmartPace(actualSavings, expectedSavingsByToday, budgetSavings);

    if (spendingPattern === "front-loaded" && timeProgress < 0.5 && smartSpendingPace.status === "ahead") {
        if (actualSpending <= expectedSpendingByToday * 1.1) {
            smartSpendingPace.status = "on-track";
            smartSpendingPace.isNormal = true;
            smartSpendingPace.reason = "Bills are front-loaded - spending is normal for your pattern";
        }
    }

    // NOW generate proactive insights with smart pace data
    const daysRemaining = periodDays - daysElapsed;
    const dailyBudget = daysRemaining > 0 ? (budgetSpending - actualSpending) / daysRemaining : 0;
    const insights = generateProactiveInsights(
        plan,
        periodId,
        categoryVariance,
        actualSpending,
        budgetSpending,
        actualSavings,
        budgetSavings,
        timeProgress,
        lowestBalance,
        { spending: smartSpendingPace, spendingPattern },
        daysRemaining,
        dailyBudget
    );

    return {
        period: {
            label: period.label,
            start: period.start,
            end: period.end,
            daysElapsed,
            daysTotal: periodDays,
            timeProgress,
        },
        budget: {
            income: budgetIncome,
            spending: budgetSpending,
            savings: budgetSavings,
            leftover: budgetLeftover,
        },
        expectedByToday: {
            income: expectedIncomeByToday,
            spending: expectedSpendingByToday,
            savings: expectedSavingsByToday,
        },
        actuals: {
            income: { amount: actualIncome, progress: budgetIncome > 0 ? actualIncome / budgetIncome : 0, pace: incomePace },
            spending: { amount: actualSpending, progress: budgetSpending > 0 ? actualSpending / budgetSpending : 0, pace: spendingPace },
            savings: { amount: actualSavings, progress: budgetSavings > 0 ? actualSavings / budgetSavings : 0, pace: savingsPace },
            leftover: actualLeftover,
        },
        smartPace: {
            spending: smartSpendingPace,
            income: smartIncomePace,
            savings: smartSavingsPace,
            spendingPattern,
        },
        variance: {
            overall: { status: overallStatus, amount: totalVariance },
            byCategory: categoryVariance,
            overspentCategories,
            underspentCategories,
        },
        forecast: {
            projectedEndBalance,
            lowestBalance,
            riskDays,
            scenarios,
        },
        subscriptions: {
            detected: subscriptions,
            totalMonthly: totalMonthlySubscriptions,
        },
        insights,
        recentTransactions,
    };
}

// ============================================================================
// Context Formatter for AI Prompt
// ============================================================================

export function formatContextForPrompt(ctx: AIFinancialContext): string {
    let prompt = `=== FINANCIAL CONTEXT: ${ctx.period.label} ===\n\n`;

    // Period info
    prompt += `PERIOD: ${ctx.period.start} to ${ctx.period.end}\n`;
    prompt += `Day ${ctx.period.daysElapsed} of ${ctx.period.daysTotal} (${Math.round(ctx.period.timeProgress * 100)}% through)\n\n`;

    // Budget vs Actuals
    prompt += `BUDGET VS ACTUALS:\n`;
    prompt += `• Income: ${formatMoney(ctx.actuals.income.amount)} of ${formatMoney(ctx.budget.income)} (${ctx.actuals.income.pace.status})\n`;
    prompt += `• Spending: ${formatMoney(ctx.actuals.spending.amount)} of ${formatMoney(ctx.budget.spending)} (${ctx.actuals.spending.pace.status})\n`;
    prompt += `• Savings: ${formatMoney(ctx.actuals.savings.amount)} of ${formatMoney(ctx.budget.savings)} (${ctx.actuals.savings.pace.status})\n`;
    prompt += `• Current Leftover: ${formatMoney(ctx.actuals.leftover)}\n\n`;

    // Variance summary
    if (ctx.variance.overspentCategories.length > 0) {
        prompt += `OVER BUDGET CATEGORIES: ${ctx.variance.overspentCategories.join(", ")}\n`;
    }
    if (ctx.variance.underspentCategories.length > 0) {
        prompt += `UNDER BUDGET CATEGORIES: ${ctx.variance.underspentCategories.join(", ")}\n`;
    }
    prompt += `\n`;

    // Category breakdown
    prompt += `SPENDING BY CATEGORY:\n`;
    ctx.variance.byCategory
        .filter(v => v.category !== "income" && v.actual > 0)
        .sort((a, b) => b.actual - a.actual)
        .slice(0, 6)
        .forEach(v => {
            const statusIcon = v.status === "over" ? "⚠️" : v.status === "under" ? "✅" : "";
            prompt += `• ${v.category}: ${formatMoney(v.actual)} / ${formatMoney(v.budgeted)} ${statusIcon}\n`;
        });
    prompt += `\n`;

    // Forecast
    prompt += `FORECAST:\n`;
    prompt += `• Projected End Balance: ${formatMoney(ctx.forecast.projectedEndBalance)}\n`;
    if (ctx.forecast.lowestBalance) {
        prompt += `• Lowest Point: ${formatMoney(ctx.forecast.lowestBalance.amount)} on ${ctx.forecast.lowestBalance.date}\n`;
    }
    if (ctx.forecast.riskDays > 0) {
        prompt += `• ⚠️ ${ctx.forecast.riskDays} days below safe minimum\n`;
    }
    prompt += `\n`;

    // Subscriptions
    if (ctx.subscriptions.detected.length > 0) {
        prompt += `DETECTED SUBSCRIPTIONS (${formatMoney(ctx.subscriptions.totalMonthly)}/month total):\n`;
        ctx.subscriptions.detected.slice(0, 5).forEach(s => {
            prompt += `• ${s.name}: ${formatMoney(s.amount)} (${s.frequency})\n`;
        });
        prompt += `\n`;
    }

    // Proactive insights
    if (ctx.insights.length > 0) {
        prompt += `KEY INSIGHTS:\n`;
        ctx.insights.forEach(i => {
            const icon = i.type === "warning" ? "⚠️" : i.type === "success" ? "✅" : "ℹ️";
            prompt += `${icon} ${i.message}\n`;
        });
        prompt += `\n`;
    }

    // Recent transactions
    if (ctx.recentTransactions.length > 0) {
        prompt += `RECENT TRANSACTIONS:\n`;
        ctx.recentTransactions.slice(0, 5).forEach(t => {
            const typeLabel = t.type === "income" ? "+" : "-";
            prompt += `• ${t.date}: ${t.label} ${typeLabel}${formatMoney(t.amount)} (${t.category})\n`;
        });
    }

    return prompt;
}
