/**
 * Insights API
 * Returns proactive financial insights for the dashboard panel
 */

import { NextResponse } from "next/server";
import {
  resolveAuthWithCookie,
  loadActivePlan,
} from "@/lib/apiHelpers";
import { buildAIContext, type ProactiveInsight } from "@/lib/aiContext";
import { PLAN } from "@/data/plan";

export interface InsightsResponse {
  insights: ProactiveInsight[];
  summary: {
    spendingStatus: "on-track" | "ahead" | "behind";
    daysRemaining: number;
    dailyBudget: number;
    leftover: number;
  };
}

export async function GET(): Promise<
  NextResponse<InsightsResponse | { error: string }>
> {
  try {
    const auth = await resolveAuthWithCookie();
    if (!auth) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { plan } = await loadActivePlan(auth, PLAN);
    const ctx = buildAIContext(plan);

    const daysRemaining = ctx.period.daysTotal - ctx.period.daysElapsed;
    const dailyBudget =
      daysRemaining > 0 ? ctx.actuals.leftover / daysRemaining : 0;

    return NextResponse.json({
      insights: ctx.insights.slice(0, 5),
      summary: {
        spendingStatus: ctx.smartPace.spending.status,
        daysRemaining,
        dailyBudget,
        leftover: ctx.actuals.leftover,
      },
    });
  } catch (error) {
    console.error("Insights API error:", error);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 },
    );
  }
}
