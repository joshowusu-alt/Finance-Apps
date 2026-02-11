import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MAIN_COOKIE_NAME, ensureMainPlan } from "@/lib/mainStore";
import { buildAIContext, formatContextForPrompt, type AIFinancialContext, type CategoryVariance } from "@/lib/aiContext";
import type { Plan } from "@/data/plan";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Simple in-memory rate limiting
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const limit = rateLimits.get(identifier);

    if (!limit || now > limit.resetTime) {
        rateLimits.set(identifier, { count: 1, resetTime: now + RATE_WINDOW });
        return true;
    }

    if (limit.count >= RATE_LIMIT) {
        return false;
    }

    limit.count++;
    return true;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function analyzePlan(plan: Plan): string {
    const period = plan.periods.find(p => p.id === plan.setup.selectedPeriodId);
    const periodLabel = period ? `${period.start} to ${period.end}` : "current period";

    // Calculate totals
    const transactions = plan.transactions || [];
    const bills = plan.bills || [];
    const incomeRules = plan.incomeRules || [];

    const totalSpent = transactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

    const totalIncome = transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const budgetedIncome = incomeRules
        .filter(r => r.enabled)
        .reduce((sum, r) => sum + r.amount, 0);

    const totalBills = bills
        .filter(b => b.enabled)
        .reduce((sum, b) => sum + b.amount, 0);

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    for (const t of transactions) {
        if (t.amount > 0) {
            const cat = t.category || "other";
            categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
        }
    }

    const topCategories = Object.entries(categoryTotals)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    // Build context
    let context = `=== FINANCIAL DATA FOR ${periodLabel.toUpperCase()} ===\n\n`;
    context += `Starting Balance: ${formatCurrency(plan.setup.startingBalance)}\n`;
    context += `Expected Minimum Balance: ${formatCurrency(plan.setup.expectedMinBalance)}\n`;
    context += `Budgeted Income: ${formatCurrency(budgetedIncome)}\n`;
    context += `Total Bills: ${formatCurrency(totalBills)}\n\n`;

    context += `ACTUAL SPENDING:\n`;
    context += `- Total Spent: ${formatCurrency(totalSpent)}\n`;
    context += `- Total Income: ${formatCurrency(totalIncome)}\n`;
    context += `- Net: ${formatCurrency(totalIncome - totalSpent)}\n\n`;

    context += `TOP SPENDING CATEGORIES:\n`;
    for (const [cat, amount] of topCategories) {
        context += `- ${cat}: ${formatCurrency(amount)}\n`;
    }

    context += `\nTRANSACTION COUNT: ${transactions.length}\n`;
    context += `BILLS COUNT: ${bills.length}\n`;

    // Recent transactions
    const recentTxns = [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

    if (recentTxns.length > 0) {
        context += `\nRECENT TRANSACTIONS:\n`;
        for (const t of recentTxns) {
            const type = t.amount > 0 ? "SPENT" : "RECEIVED";
            context += `- ${t.date}: ${t.label} - ${type} ${formatCurrency(Math.abs(t.amount))} (${t.category})\n`;
        }
    }

    return context;
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        let plan: Plan | null = null;
        let rateIdentifier = "";

        if (user) {
            const { data: scenarioRow } = await supabase
                .from("user_scenarios")
                .select("scenario_id")
                .eq("user_id", user.id)
                .eq("active", true)
                .maybeSingle();
            const scenarioId = scenarioRow?.scenario_id ?? "default";

            const { data: planRow } = await supabase
                .from("user_plans")
                .select("plan_json")
                .eq("user_id", user.id)
                .eq("scenario_id", scenarioId)
                .maybeSingle();

            if (planRow?.plan_json) {
                plan = typeof planRow.plan_json === "string"
                    ? (JSON.parse(planRow.plan_json) as Plan)
                    : (planRow.plan_json as Plan);
            }
            rateIdentifier = user.id;
        }

        if (!plan) {
            const cookieStore = await cookies();
            const token = cookieStore.get(MAIN_COOKIE_NAME)?.value;

            if (!token) {
                return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
            }

            if (!rateIdentifier) rateIdentifier = token;
            const main = await ensureMainPlan(token);
            plan = main.plan;
        }

        // Rate limiting
        if (!checkRateLimit(rateIdentifier)) {
            return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
        }

        const { message } = await req.json();

        if (!message || typeof message !== "string") {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // Get user's financial data with rich context
        const aiContext = buildAIContext(plan);
        const financialContext = formatContextForPrompt(aiContext);

        // Check for OpenAI API key
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            // Fallback to rule-based responses if no API key
            return NextResponse.json({
                response: generateFallbackResponse(message, plan, aiContext),
                source: "local"
            });
        }

        // Call OpenAI API with enhanced system prompt
        const systemPrompt = `You are a knowledgeable financial coach for Velanovo, a cashflow tracking app. You have full access to the user's financial data including their budget, actual spending, variance analysis, and forecasts.

PERSONALITY:
- Friendly, encouraging, but direct
- Reference specific numbers from their data
- Give actionable, specific advice
- Be concise (2-3 paragraphs max)
- Format currency in GBP (£)

CAPABILITIES:
- Explain their budget vs actual spending by category
- Analyze their spending pace (are they on track?)
- Identify problem areas (overspent categories)
- Provide savings recommendations
- Answer questions about bills and subscriptions
- Give forecasts for end-of-period balance

When the user asks a question, use the financial data below to give a personalized, data-driven response.

${financialContext}`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                max_tokens: 500,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error("OpenAI API error:", error);
            return NextResponse.json({
                response: generateFallbackResponse(message, plan, aiContext),
                source: "local"
            });
        }

        const data = await response.json();
        const aiResponse = data.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";

        return NextResponse.json({
            response: aiResponse,
            source: "openai"
        });

    } catch (error) {
        console.error("AI Assistant error:", error);
        return NextResponse.json(
            { error: "Failed to process request" },
            { status: 500 }
        );
    }
}

function generateFallbackResponse(message: string, plan: Plan, ctx: AIFinancialContext): string {
    const lowerMessage = message.toLowerCase();
    const fmt = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

    // Calculate key metrics for coaching
    const daysLeft = ctx.period.daysTotal - ctx.period.daysElapsed;
    const dailyBudgetRemaining = daysLeft > 0 ? ctx.actuals.leftover / daysLeft : 0;
    const overspentAmount = ctx.actuals.spending.amount - (ctx.budget.spending * ctx.period.timeProgress);
    const topOverspent = ctx.variance.byCategory
        .filter(c => c.status === "over" && c.category !== "income")
        .sort((a, b) => b.variance - a.variance)[0];

    // Budget/track questions - THE MAIN COACHING RESPONSE (uses SMART PACE)
    if (lowerMessage.includes("budget") || lowerMessage.includes("track")) {
        const smartPace = ctx.smartPace.spending;

        // If it looks high but is actually normal for the pattern
        if (smartPace.isNormal || smartPace.status === "on-track") {
            let advice = `Looking good! You're right on track.\n\n`;
            advice += `Spent: ${fmt(ctx.actuals.spending.amount)} of ${fmt(ctx.budget.spending)} · ${fmt(ctx.actuals.leftover)} remaining\n\n`;

            // Explain why it might LOOK high but isn't
            if (ctx.smartPace.spendingPattern === "front-loaded" && ctx.period.timeProgress < 0.5) {
                advice += `Your bills are front-loaded, so most outflows happen early in the period. This is completely normal for your setup — you've spent what was scheduled.\n\n`;
            }

            advice += `For the remaining ${daysLeft} days, you can comfortably spend around ${fmt(dailyBudgetRemaining)} per day.\n\n`;
            advice += `Keep doing what you're doing!`;
            return advice;
        }

        if (smartPace.status === "ahead" && !smartPace.isNormal) {
            // Spending a bit more than scheduled - gentle guidance
            const extraAmount = Math.abs(smartPace.variance);
            let advice = `You're running a bit ahead of your usual pace.\n\n`;
            advice += `Spent: ${fmt(ctx.actuals.spending.amount)} of ${fmt(ctx.budget.spending)} · ${fmt(ctx.actuals.leftover)} remaining\n\n`;
            advice += `You've spent about ${fmt(extraAmount)} more than typically scheduled by this point. Nothing to worry about — just something to be mindful of.\n\n`;
            advice += `**A few gentle suggestions:**\n`;

            if (topOverspent) {
                advice += `• ${topOverspent.category} is slightly higher than usual\n`;
            }
            advice += `• Aim for around ${fmt(Math.max(0, dailyBudgetRemaining))} per day going forward\n`;
            advice += `• Consider reviewing recent purchases to spot any patterns\n\n`;
            advice += `You've got plenty of room to adjust. Would you like help finding areas to trim?`;
            return advice;

        } else if (smartPace.status === "behind") {
            // Spending less - positive reinforcement
            const savedAmount = Math.abs(smartPace.variance);
            let advice = `Nice work! You're spending less than expected.\n\n`;
            advice += `Spent: ${fmt(ctx.actuals.spending.amount)} of ${fmt(ctx.budget.spending)} · ${fmt(ctx.actuals.leftover)} remaining\n\n`;
            advice += `You're about ${fmt(savedAmount)} under your typical pace — that's extra breathing room.\n\n`;
            advice += `**Some ideas:**\n`;
            advice += `• Move some of that to savings\n`;
            advice += `• Build up your emergency fund\n`;
            advice += `• Or just enjoy the cushion!\n\n`;
            advice += `Whatever you decide, you're in a good spot.`;
            return advice;
        }

        // Fallback on-track
        let advice = `You're doing well! Everything looks balanced.\n\n`;
        advice += `Spent: ${fmt(ctx.actuals.spending.amount)} of ${fmt(ctx.budget.spending)} · ${fmt(ctx.actuals.leftover)} remaining\n\n`;
        advice += `For the next ${daysLeft} days, aim for around ${fmt(dailyBudgetRemaining)} per day.\n\n`;
        advice += `Check back in a few days if you'd like an update.`;
        return advice;
    }

    // Spending questions
    if (lowerMessage.includes("spent") || lowerMessage.includes("spending")) {
        const topCategories = ctx.variance.byCategory
            .filter(c => c.category !== "income" && c.actual > 0)
            .sort((a, b) => b.actual - a.actual)
            .slice(0, 3);

        let advice = `You've spent ${fmt(ctx.actuals.spending.amount)} (${Math.round(ctx.actuals.spending.progress * 100)}% of budget).\n\n`;
        advice += `**Top categories:** ${topCategories.map(c => `${c.category}: ${fmt(c.actual)}`).join(", ")}\n\n`;

        if (ctx.actuals.spending.pace.status === "ahead") {
            advice += `**💡 Action needed:** You're spending faster than planned.\n`;
            advice += `• Try a "no-spend day" tomorrow\n`;
            advice += `• Before any purchase over £20, wait 24 hours\n`;
        } else {
            advice += `**💡 Keep it up:** Your spending pace is healthy!\n`;
        }

        advice += `\n**Next step:** Review your largest transaction this week - was it necessary?`;
        return advice;
    }

    // Savings questions
    if (lowerMessage.includes("save") || lowerMessage.includes("saving")) {
        const savingsProgress = Math.round(ctx.actuals.savings.progress * 100);
        const targetSavings = ctx.budget.savings * ctx.period.timeProgress;
        const savingsGap = targetSavings - ctx.actuals.savings.amount;

        let advice = `Saved: ${fmt(ctx.actuals.savings.amount)} of ${fmt(ctx.budget.savings)} (${savingsProgress}%)\n\n`;

        if (ctx.actuals.savings.pace.status === "behind") {
            advice += `You're a bit behind on savings — about ${fmt(savingsGap)} to catch up.\n\n`;
            advice += `**Some ideas to get back on track:**\n`;
            advice += `• Transfer ${fmt(savingsGap / Math.max(1, daysLeft) * 7)} this week\n`;
            advice += `• Check if there's a subscription you could pause\n`;
            advice += `• Try cooking at home this weekend instead of eating out\n\n`;
            advice += `Small adjustments add up. You've got this!`;
        } else {
            advice += `Excellent progress! You're ahead of your savings target.\n\n`;
            advice += `**Ways to build on this momentum:**\n`;
            advice += `• Consider increasing your savings goal by 10% next period\n`;
            advice += `• Put any extra toward your emergency fund\n\n`;
            advice += `Keep it up — consistency is what builds wealth over time.`;
        }
        return advice;
    }

    // Forecast questions
    if (lowerMessage.includes("forecast") || lowerMessage.includes("end") || lowerMessage.includes("project")) {
        let advice = `**End-of-period forecast:** ${fmt(ctx.forecast.projectedEndBalance)}\n\n`;

        if (ctx.forecast.riskDays > 0) {
            advice += `⚠️ **Warning:** Your balance may drop below ${fmt(plan.setup.expectedMinBalance)} on ${ctx.forecast.lowestBalance?.date}\n\n`;
            advice += `**💡 How to avoid this:**\n`;
            advice += `1. Delay any large purchases until after your next income\n`;
            advice += `2. Review upcoming bills - can any be rescheduled?\n`;
            advice += `3. Consider a temporary spending freeze on non-essentials\n`;
        } else {
            advice += `✅ Balance stays healthy throughout the period.\n\n`;
            advice += `**💡 Optimize further:**\n`;
            advice += `1. Any leftover could boost your emergency fund\n`;
            advice += `2. Consider paying extra on any debts\n`;
        }

        advice += `\n**Next step:** Mark your calendar to check your balance 3 days before your lowest point.`;
        return advice;
    }

    // Over budget questions
    if (lowerMessage.includes("over") && (lowerMessage.includes("budget") || lowerMessage.includes("category"))) {
        if (ctx.variance.overspentCategories.length === 0) {
            return `✅ Great news - no categories over budget!\n\n**💡 Keep winning:**\n1. Document what's working so you can repeat it\n2. Consider if any budget amounts could be reduced\n\n**Next step:** Set these same budget limits for next period.`;
        }

        let advice = `**Over budget in:** ${ctx.variance.overspentCategories.join(", ")}\n\n`;

        if (topOverspent) {
            advice += `Biggest issue: ${topOverspent.category} (${fmt(topOverspent.variance)} over)\n\n`;
            advice += `**💡 Fix this category:**\n`;

            if (topOverspent.category === "allowance") {
                advice += `1. Try the envelope method - withdraw weekly cash and stick to it\n`;
                advice += `2. Unsubscribe from shopping newsletters\n`;
                advice += `3. Wait 48 hours before any non-essential purchase\n`;
            } else if (topOverspent.category === "bill") {
                advice += `1. Call providers to negotiate lower rates\n`;
                advice += `2. Review if all subscriptions are still needed\n`;
                advice += `3. Bundle services where possible\n`;
            } else if (topOverspent.category === "giving") {
                advice += `1. Set a monthly giving budget at the start of each period\n`;
                advice += `2. Consider setting up recurring donations to avoid one-time overspending\n`;
            } else {
                advice += `1. Track every expense in this category for a week\n`;
                advice += `2. Identify the top 3 merchants and find alternatives\n`;
                advice += `3. Set a weekly sub-limit for this category\n`;
            }
        }

        advice += `\n**Next step:** Review your ${topOverspent?.category || "overspent"} transactions now and mark which were avoidable.`;
        return advice;
    }

    // Subscription questions
    if (lowerMessage.includes("subscription") || lowerMessage.includes("recurring")) {
        if (ctx.subscriptions.detected.length === 0) {
            return `No recurring subscriptions detected yet.\n\n**💡 Tip:** As more transactions come in, I'll spot patterns. Most people have 2-3 subscriptions they've forgotten about!\n\n**Next step:** Manually check your bank statement for any recurring £5-20 charges.`;
        }

        let advice = `**Monthly subscriptions:** ${fmt(ctx.subscriptions.totalMonthly)}\n\n`;
        ctx.subscriptions.detected.slice(0, 5).forEach(s => {
            advice += `• ${s.name}: ${fmt(s.amount)} (${s.frequency})\n`;
        });

        advice += `\n**💡 Subscription audit:**\n`;
        advice += `1. Which of these haven't you used in 30 days? Cancel it.\n`;
        advice += `2. Can any be downgraded to a cheaper tier?\n`;
        advice += `3. Are there annual options that would save money?\n`;
        advice += `\n**Next step:** Pick ONE subscription to cancel or downgrade this week.`;
        return advice;
    }

    // Default response with proactive coaching
    if (ctx.insights.length > 0) {
        const topInsight = ctx.insights[0];
        const icon = topInsight.type === "warning" ? "⚠️" : "✅";

        let advice = `${icon} ${topInsight.message}\n\n`;
        advice += `**💡 What you should do:**\n`;

        if (topInsight.type === "warning") {
            advice += `1. Review your spending in the affected areas\n`;
            advice += `2. Set a spending limit for the rest of this period\n`;
            advice += `3. Consider what triggered the overspending\n`;
        } else {
            advice += `1. Keep doing what you're doing!\n`;
            advice += `2. Consider increasing your savings rate\n`;
            advice += `3. Document your success for future reference\n`;
        }

        advice += `\n**Ask me:** "How can I save more?" or "What's my forecast?"`;
        return advice;
    }

    return `👋 I'm your financial coach! I can help you:\n\n• Understand if you're on track\n• Find areas to cut spending\n• Build better saving habits\n• Avoid cash flow problems\n\n**Try asking:** "Am I on track with my budget?"`;
}
