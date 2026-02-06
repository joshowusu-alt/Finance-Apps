import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MAIN_COOKIE_NAME, ensureMainPlan } from "@/lib/mainStore";
import type { Plan } from "@/data/plan";

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
        const cookieStore = await cookies();
        const token = cookieStore.get(MAIN_COOKIE_NAME)?.value;

        if (!token) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        // Rate limiting
        if (!checkRateLimit(token)) {
            return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
        }

        const { message } = await req.json();

        if (!message || typeof message !== "string") {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // Get user's financial data
        const { plan } = await ensureMainPlan(token);
        const financialContext = analyzePlan(plan);

        // Check for OpenAI API key
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            // Fallback to rule-based responses if no API key
            return NextResponse.json({
                response: generateFallbackResponse(message, plan),
                source: "local"
            });
        }

        // Call OpenAI API
        const systemPrompt = `You are a helpful financial assistant for the Velanovo cashflow app. You help users understand their spending, budgeting, and provide actionable financial advice.

Be concise, friendly, and specific. Use the user's actual financial data to give personalized answers. Format currency in GBP (£).

When giving advice:
- Be encouraging but realistic
- Suggest specific, actionable steps
- Reference their actual spending data when relevant

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
                response: generateFallbackResponse(message, plan),
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

function generateFallbackResponse(message: string, plan: Plan): string {
    const lowerMessage = message.toLowerCase();

    const transactions = plan.transactions || [];
    const bills = plan.bills || [];

    const totalSpent = transactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

    // Simple keyword matching
    if (lowerMessage.includes("spent") || lowerMessage.includes("spending")) {
        return `Based on your transactions, you've spent ${formatCurrency(totalSpent)} this period across ${transactions.length} transactions. Your biggest spending categories are likely dining and shopping. Would you like more details on any specific category?`;
    }

    if (lowerMessage.includes("bill") || lowerMessage.includes("bills")) {
        const totalBills = bills.filter(b => b.enabled).reduce((sum, b) => sum + b.amount, 0);
        return `You have ${bills.length} bills totaling ${formatCurrency(totalBills)} per period. Your bills are ${bills.length > 0 ? "being tracked" : "not yet set up"}. Consider reviewing your subscriptions to find potential savings.`;
    }

    if (lowerMessage.includes("save") || lowerMessage.includes("saving")) {
        const leftover = plan.setup.startingBalance - totalSpent;
        return `Based on your current spending of ${formatCurrency(totalSpent)}, you have approximately ${formatCurrency(Math.max(0, leftover))} remaining from your starting balance. To save more, consider setting a weekly spending limit or reviewing your subscriptions.`;
    }

    if (lowerMessage.includes("budget")) {
        return `Your current budget setup: Starting balance of ${formatCurrency(plan.setup.startingBalance)} with an expected minimum of ${formatCurrency(plan.setup.expectedMinBalance)}. You've spent ${formatCurrency(totalSpent)} so far. Stay on track by checking your daily spending against your weekly allowance.`;
    }

    // Default response
    return `I can help you understand your finances! Try asking me:
• "How much have I spent this month?"
• "What are my biggest expenses?"
• "How can I save more money?"
• "Show me my bills"

For more personalized AI responses, an OpenAI API key can be configured.`;
}
