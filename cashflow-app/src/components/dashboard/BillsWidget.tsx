"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { formatMoney } from "@/lib/currency";
import { prettyDate } from "@/lib/formatUtils";
import { getDaysUntil } from "@/lib/dateUtils";

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
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <span className="text-sm font-semibold text-(--vn-text)">Upcoming Bills</span>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-(--vn-muted)">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-center min-h-[80px]">
                    {nextBill ? (
                        <>
                            <div className="flex items-baseline justify-between w-full mb-1">
                                <span className="text-sm font-medium text-(--vn-text) truncate mr-2">{nextBill.label}</span>
                                <span className="text-lg font-bold text-(--vn-text)">{formatMoney(nextBill.amount)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${getDaysUntil(nextBill.date).includes("Overdue") ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" :
                                    getDaysUntil(nextBill.date).includes("today") ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                                        "bg-(--vn-bg) text-(--vn-muted)"
                                    }`}>
                                    {getDaysUntil(nextBill.date)}
                                </span>
                                <span className="text-xs text-(--vn-muted)">{prettyDate(nextBill.date)}</span>
                            </div>
                        </>
                    ) : (
                        <div className="text-sm text-(--vn-muted) italic text-center">No upcoming bills</div>
                    )}
                </div>

                <div className="mt-4 pt-3 border-t border-(--vn-border) flex items-center justify-between text-xs text-(--vn-muted) group-hover:text-(--vn-primary) transition-colors">
                    <span>
                        {otherBillCount > 0 ? `+ ${otherBillCount} other bills queued` : "View bill calendar"}
                    </span>
                </div>
            </motion.div>
        </Link>
    );
}
