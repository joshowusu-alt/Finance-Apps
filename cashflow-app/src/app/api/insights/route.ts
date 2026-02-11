/**
 * Insights API
 * Returns proactive financial insights for the dashboard panel
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ensureMainPlan, MAIN_COOKIE_NAME } from "@/lib/mainStore";
import { buildAIContext, type ProactiveInsight } from "@/lib/aiContext";
import { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/data/plan";

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
        const supabase = await createClient();
        const user = supabase ? (await supabase.auth.getUser()).data.user : null;

        let plan: Plan | null = null;

        if (user && supabase) {
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
        }

        if (!plan) {
            const cookieStore = await cookies();
            const token = cookieStore.get(MAIN_COOKIE_NAME)?.value;

            if (!token) {
                return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
            }

            const main = await ensureMainPlan(token);
            plan = main.plan;
        }

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
