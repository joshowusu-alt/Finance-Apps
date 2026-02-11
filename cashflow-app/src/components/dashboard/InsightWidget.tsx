"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type InsightTone = "good" | "bad" | "neutral";

type InsightWidgetProps = {
    insight: string;
    tone?: InsightTone;
    href?: string;
};

export function InsightWidget({ insight, tone = "neutral", href = "/insights" }: InsightWidgetProps) {
    const getIcon = () => {
        switch (tone) {
            case "good":
                return (
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    </div>
                );
            case "bad":
                return (
                    <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                );
            default:
                return (
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                );
        }
    };

    return (
        <Link href={href}>
            <motion.div
                whileHover={{ y: -2 }}
                className="vn-card p-5 h-full flex flex-col justify-between hover:border-blue-500/30 transition-colors cursor-pointer group"
            >
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                        {getIcon()}
                        <span className="text-sm font-semibold text-[var(--vn-text)]">Insight</span>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--vn-muted)]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>

                <div>
                    <p className="text-sm font-medium text-[var(--vn-text)] line-clamp-2 md:line-clamp-3">
                        {insight}
                    </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--vn-border)] flex items-center gap-2 text-xs text-[var(--vn-muted)] group-hover:text-[var(--vn-primary)] transition-colors">
                    <span>View full analysis</span>
                </div>
            </motion.div>
        </Link>
    );
}
