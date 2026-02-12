"use client";

import { useEffect, useState, useCallback } from "react";
import { formatMoney } from "@/lib/currency";
import { loadPlan, PLAN_UPDATED_EVENT } from "@/lib/storage";
import { buildAIContext } from "@/lib/aiContext";

interface ProactiveInsight {
    type: "warning" | "success" | "info";
    message: string;
    priority: number;
}

interface InsightsSummary {
    spendingStatus: "on-track" | "ahead" | "behind";
    daysRemaining: number;
    dailyBudget: number;
    leftover: number;
}

interface InsightsData {
    insights: ProactiveInsight[];
    summary: InsightsSummary;
}

function getInsightIcon(type: ProactiveInsight["type"]): string {
    switch (type) {
        case "success": return "✅";
        case "warning": return "💡";
        case "info": return "📊";
    }
}

function getStatusMessage(status: InsightsSummary["spendingStatus"]): { icon: string; text: string; color: string } {
    switch (status) {
        case "on-track":
            return { icon: "✅", text: "On track", color: "text-emerald-600 dark:text-emerald-400" };
        case "behind":
            return { icon: "💰", text: "Under budget", color: "text-emerald-600 dark:text-emerald-400" };
        case "ahead":
            return { icon: "💡", text: "Slightly ahead", color: "text-amber-600 dark:text-amber-400" };
    }
}

export default function InsightsPanel() {
    const [data, setData] = useState<InsightsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const buildLocalInsights = useCallback((): InsightsData | null => {
        try {
            const plan = loadPlan();
            const ctx = buildAIContext(plan);
            const daysRemaining = ctx.period.daysTotal - ctx.period.daysElapsed;
            const dailyBudget = daysRemaining > 0 ? ctx.actuals.leftover / daysRemaining : 0;
            return {
                insights: ctx.insights.slice(0, 5),
                summary: {
                    spendingStatus: ctx.smartPace.spending.status,
                    daysRemaining,
                    dailyBudget,
                    leftover: ctx.actuals.leftover,
                },
            };
        } catch {
            return null;
        }
    }, []);

    const fetchInsights = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/insights");
            if (res.ok) {
                const json = await res.json();
                setData(json);
                setError(null);
                return;
            }

            const local = buildLocalInsights();
            if (local) {
                setData(local);
                setError(null);
                return;
            }

            throw new Error("Failed to fetch insights");
        } catch (err) {
            const local = buildLocalInsights();
            if (local) {
                setData(local);
                setError(null);
                return;
            }
            setError(err instanceof Error ? err.message : "Failed to load insights");
        } finally {
            setLoading(false);
        }
    }, [buildLocalInsights]);

    useEffect(() => {
        fetchInsights();
        window.addEventListener(PLAN_UPDATED_EVENT, fetchInsights);
        window.addEventListener("focus", fetchInsights);
        return () => {
            window.removeEventListener(PLAN_UPDATED_EVENT, fetchInsights);
            window.removeEventListener("focus", fetchInsights);
        };
    }, [fetchInsights]);

    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
                        <span className="text-lg">📊</span>
                    </div>
                    <h3 className="font-semibold text-slate-800 dark:text-white">Your Financial Pulse</h3>
                </div>
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400 text-sm">Unable to load insights</p>
        </div>
        );
    }

    const status = getStatusMessage(data.summary.spendingStatus);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
                        <span className="text-lg">📊</span>
                    </div>
                    <h3 className="font-semibold text-slate-800 dark:text-white">Your Financial Pulse</h3>
                </div>
                <span className={`text-sm font-medium ${status.color}`}>
                    {status.icon} {status.text}
                </span>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Daily budget</p>
                    <p className="font-semibold text-slate-800 dark:text-white">{formatMoney(data.summary.dailyBudget)}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Days remaining</p>
                    <p className="font-semibold text-slate-800 dark:text-white">{data.summary.daysRemaining}</p>
                </div>
            </div>

            {/* Insights List */}
            {data.insights.length > 0 && (
                <div className="space-y-2">
                    {data.insights.slice(0, 3).map((insight, idx) => (
                        <div
                            key={idx}
                            className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                        >
                            <span className="flex-shrink-0">{getInsightIcon(insight.type)}</span>
                            <span>{insight.message}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                    {formatMoney(data.summary.leftover)} remaining this period
                </p>
            </div>
        </div>
    );
}
