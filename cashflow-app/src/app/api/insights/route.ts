/**
 * Insights API
 * Returns proactive financial insights for the dashboard panel
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureMainPlan, MAIN_COOKIE_NAME } from "@/lib/mainStore";
import { buildAIContext, type ProactiveInsight } from "@/lib/aiContext";

export interface InsightsResponse {
    insights: ProactiveInsight[];
    summary: {
        spendingStatus: "on-track" | "ahead" | "behind";
        daysRemaining: number;
        dailyBudget: number;
        leftover: number;
    };
}

export async function GET(): Promise<NextResponse<InsightsResponse | { error: string }>> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(MAIN_COOKIE_NAME)?.value;

        if (!token) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { plan } = await ensureMainPlan(token);
        const ctx = buildAIContext(plan);

        // Calculate daily budget for remaining days
        const daysRemaining = ctx.period.daysTotal - ctx.period.daysElapsed;
        const dailyBudget = daysRemaining > 0 ? ctx.actuals.leftover / daysRemaining : 0;

        return NextResponse.json({
            insights: ctx.insights.slice(0, 5), // Top 5 insights
            summary: {
                spendingStatus: ctx.smartPace.spending.status,
                daysRemaining,
                dailyBudget,
                leftover: ctx.actuals.leftover,
            },
        });
    } catch (error) {
        console.error("Insights API error:", error);
        return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
    }
}
