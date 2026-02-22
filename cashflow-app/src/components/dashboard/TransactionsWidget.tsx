"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { formatMoney } from "@/lib/currency";
import { prettyDate } from "@/lib/formatUtils";

type Transaction = {
    id: string;
    date: string;
    merchant: string;
    amount: number;
};

type TransactionsWidgetProps = {
    transactions: Transaction[];
    href?: string;
};



export function TransactionsWidget({ transactions, href = "/transactions" }: TransactionsWidgetProps) {
    return (
        <div className="vn-card p-5 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                    </div>
                    <span className="text-sm font-semibold text-[var(--vn-text)]">Recent Activity</span>
                </div>
                <Link href={href} className="text-xs font-semibold text-[var(--vn-primary)] hover:underline">
                    View All
                </Link>
            </div>

            <div className="flex-1 space-y-3">
                {transactions.length === 0 ? (
                    <div className="text-sm text-[var(--vn-muted)] italic py-2">No recent transactions.</div>
                ) : (
                    transactions.slice(0, 3).map((t) => (
                        <div key={t.id} className="flex justify-between items-center group cursor-default">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-[var(--vn-text)] truncate max-w-[120px]">{t.merchant || "Unknown"}</span>
                                <span className="text-xs text-[var(--vn-muted)]">{prettyDate(t.date)}</span>
                            </div>
                            <span className="text-sm font-semibold text-[var(--vn-text)]">
                                {formatMoney(t.amount)}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {transactions.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[var(--vn-border)]">
                    <Link href={href} className="block w-full">
                        <motion.div
                            whileHover={{ x: 2 }}
                            className="flex items-center justify-between text-xs text-[var(--vn-muted)] hover:text-[var(--vn-primary)] transition-colors"
                        >
                            <span>{transactions.length > 3 ? `+ ${transactions.length - 3} more this period` : "See full history"}</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </motion.div>
                    </Link>
                </div>
            )}
        </div>
    );
}
