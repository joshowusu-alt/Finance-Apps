"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { formatMoney } from "@/lib/currency";
import { prettyDate } from "@/lib/formatUtils";

type Bill = {
    id: string;
    label: string;
    amount: number;
    date: string;
};

type BillsWidgetProps = {
    bills: Bill[]; // Sorted by date soonest first
    href?: string;
};



function getDaysUntil(dateStr: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    return `In ${diffDays} days`;
}

export function BillsWidget({ bills, href = "/bills" }: BillsWidgetProps) {
    const nextBill = bills[0];
    const otherBillCount = bills.length - 1;

    return (
        <Link href={href}>
            <motion.div
                whileHover={{ y: -2 }}
                className="vn-card p-5 h-full flex flex-col justify-between hover:border-amber-500/30 transition-colors cursor-pointer group"
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold text-[var(--vn-text)]">Upcoming Bills</span>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--vn-muted)]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-center min-h-[80px]">
                    {nextBill ? (
                        <>
                            <div className="flex items-baseline justify-between w-full mb-1">
                                <span className="text-sm font-medium text-[var(--vn-text)] truncate mr-2">{nextBill.label}</span>
                                <span className="text-lg font-bold text-[var(--vn-text)]">{formatMoney(nextBill.amount)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${getDaysUntil(nextBill.date).includes("Overdue") ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                    getDaysUntil(nextBill.date).includes("today") ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                                        "bg-[var(--vn-bg)] text-[var(--vn-muted)]"
                                    }`}>
                                    {getDaysUntil(nextBill.date)}
                                </span>
                                <span className="text-xs text-[var(--vn-muted)]">{prettyDate(nextBill.date)}</span>
                            </div>
                        </>
                    ) : (
                        <div className="text-sm text-[var(--vn-muted)] italic text-center">No upcoming bills</div>
                    )}
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--vn-border)] flex items-center justify-between text-xs text-[var(--vn-muted)] group-hover:text-[var(--vn-primary)] transition-colors">
                    <span>
                        {otherBillCount > 0 ? `+ ${otherBillCount} other bills queued` : "View bill calendar"}
                    </span>
                </div>
            </motion.div>
        </Link>
    );
}
