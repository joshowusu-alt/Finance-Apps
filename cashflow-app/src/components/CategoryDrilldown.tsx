"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo } from "react";
import type { Transaction, CashflowCategory } from "@/data/plan";
import { useDarkMode } from "@/hooks/useDarkMode";
import { getCategoryColor, getTextColor, getMutedColor } from "@/lib/chartConfig";
import { formatMoney } from "@/lib/currency";
import { prettyDate } from "@/lib/formatUtils";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    category: CashflowCategory | string;
    transactions: Transaction[];
    budgeted?: number;
    periodLabel?: string;
};



export function CategoryDrilldown({
    isOpen,
    onClose,
    category,
    transactions,
    budgeted,
    periodLabel,
}: Props) {
    const isDark = useDarkMode();

    const categoryColor = getCategoryColor(category);
    const textColor = getTextColor(isDark);
    const mutedColor = getMutedColor(isDark);

    const totalSpent = useMemo(
        () => transactions.reduce((sum, t) => sum + t.amount, 0),
        [transactions]
    );

    const variance = budgeted ? totalSpent - budgeted : 0;
    const variancePercent = budgeted ? ((variance / budgeted) * 100).toFixed(1) : 0;
    const isOverBudget = variance > 0;

    // Group transactions by date
    const groupedByDate = useMemo(() => {
        const groups: Record<string, Transaction[]> = {};
        transactions.forEach((t) => {
            if (!groups[t.date]) groups[t.date] = [];
            groups[t.date].push(t);
        });
        return Object.entries(groups)
            .sort(([a], [b]) => b.localeCompare(a)) // Most recent first
            .slice(0, 20); // Limit to 20 dates
    }, [transactions]);

    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed left-1/2 top-1/2 z-[201] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl shadow-2xl"
                        style={{
                            backgroundColor: isDark ? "#18181b" : "#ffffff",
                            border: `1px solid ${isDark ? "#3f3f46" : "#e4e4e7"}`,
                            maxHeight: "80vh",
                        }}
                    >
                        {/* Header */}
                        <div
                            className="relative px-6 py-5"
                            style={{
                                background: `linear-gradient(135deg, ${categoryColor}15 0%, transparent 100%)`,
                                borderBottom: `1px solid ${isDark ? "#3f3f46" : "#e4e4e7"}`,
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="h-10 w-10 rounded-full"
                                    style={{ backgroundColor: categoryColor }}
                                />
                                <div>
                                    <h2
                                        className="text-lg font-semibold capitalize"
                                        style={{ color: textColor }}
                                    >
                                        {category}
                                    </h2>
                                    {periodLabel && (
                                        <p className="text-xs" style={{ color: mutedColor }}>
                                            {periodLabel}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Close button */}
                            <button
                                onClick={onClose}
                                className="absolute right-4 top-4 h-10 w-10 rounded-full flex items-center justify-center transition-colors hover:bg-black/10"
                                style={{ color: mutedColor }}
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4 px-6 py-4" style={{ borderBottom: `1px solid ${isDark ? "#3f3f46" : "#e4e4e7"}` }}>
                            <div>
                                <p className="text-xs uppercase tracking-wide" style={{ color: mutedColor }}>
                                    Spent
                                </p>
                                <p className="mt-1 text-xl font-bold" style={{ color: textColor }}>
                                    {formatMoney(totalSpent)}
                                </p>
                            </div>
                            {budgeted !== undefined && (
                                <>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide" style={{ color: mutedColor }}>
                                            Budget
                                        </p>
                                        <p className="mt-1 text-xl font-bold" style={{ color: textColor }}>
                                            {formatMoney(budgeted)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-wide" style={{ color: mutedColor }}>
                                            Variance
                                        </p>
                                        <p
                                            className="mt-1 text-xl font-bold"
                                            style={{ color: isOverBudget ? "#ef4444" : "#10b981" }}
                                        >
                                            {isOverBudget ? "+" : ""}{formatMoney(variance)}
                                        </p>
                                        <p className="text-xs" style={{ color: isOverBudget ? "#ef4444" : "#10b981" }}>
                                            {isOverBudget ? "+" : ""}{variancePercent}%
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Transaction list */}
                        <div className="max-h-[40vh] overflow-y-auto px-6 py-4">
                            <p className="mb-3 text-xs font-medium uppercase tracking-wide" style={{ color: mutedColor }}>
                                Transactions ({transactions.length})
                            </p>

                            {groupedByDate.length === 0 ? (
                                <p className="py-8 text-center text-sm" style={{ color: mutedColor }}>
                                    No transactions in this category
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {groupedByDate.map(([date, txns]) => (
                                        <div key={date}>
                                            <p className="mb-2 text-xs font-medium" style={{ color: mutedColor }}>
                                                {prettyDate(date)}
                                            </p>
                                            <div className="space-y-2">
                                                {txns.map((t) => (
                                                    <motion.div
                                                        key={t.id}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        className="flex items-center justify-between rounded-xl px-3 py-2"
                                                        style={{
                                                            backgroundColor: isDark ? "#27272a" : "#f4f4f5",
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="h-2 w-2 rounded-full"
                                                                style={{ backgroundColor: categoryColor }}
                                                            />
                                                            <span className="text-sm" style={{ color: textColor }}>
                                                                {t.label}
                                                            </span>
                                                        </div>
                                                        <span
                                                            className="text-sm font-medium"
                                                            style={{ color: t.type === "income" ? "#10b981" : textColor }}
                                                        >
                                                            {t.type === "income" ? "+" : "-"}{formatMoney(t.amount)}
                                                        </span>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div
                            className="px-6 py-4"
                            style={{ borderTop: `1px solid ${isDark ? "#3f3f46" : "#e4e4e7"}` }}
                        >
                            <button
                                onClick={onClose}
                                className="w-full rounded-xl py-3 text-sm font-semibold transition-all hover:opacity-90"
                                style={{
                                    backgroundColor: isDark ? "#27272a" : "#f4f4f5",
                                    color: isDark ? "#f4f4f5" : "#18181b",
                                    border: `1px solid ${isDark ? "#3f3f46" : "#e4e4e7"}`,
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
