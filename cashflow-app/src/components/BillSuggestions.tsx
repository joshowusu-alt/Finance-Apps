"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { MerchantLogo } from "@/components/MerchantLogo";
import type { DetectedBill } from "@/lib/billDetection";
import { getBillConfidenceLabel, toBillTemplate } from "@/lib/billDetection";
import type { BillTemplate } from "@/data/plan";

type Props = {
    detectedBills: DetectedBill[];
    onAccept: (bill: BillTemplate) => void;
    onDismiss: (billId: string) => void;
    className?: string;
};

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: 2,
    }).format(amount);
}

function getFrequencyLabel(frequency: string): string {
    const labels: Record<string, string> = {
        monthly: "Monthly",
        biweekly: "Every 2 weeks",
        weekly: "Weekly",
    };
    return labels[frequency] || frequency;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
    const label = getBillConfidenceLabel(confidence);
    const colors = {
        high: { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981" },
        medium: { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b" },
        low: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444" },
    };
    const color = colors[label];

    return (
        <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: color.bg, color: color.text }}
        >
            {confidence}% match
        </span>
    );
}

export function BillSuggestions({ detectedBills, onAccept, onDismiss, className = "" }: Props) {
    const [isDark, setIsDark] = useState(false);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const isDarkMode = document.documentElement.getAttribute("data-theme") === "dark";
        setIsDark(isDarkMode);

        const observer = new MutationObserver(() => {
            const darkMode = document.documentElement.getAttribute("data-theme") === "dark";
            setIsDark(darkMode);
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        return () => observer.disconnect();
    }, []);

    const visibleBills = detectedBills.filter((b) => !dismissedIds.has(b.id));

    if (visibleBills.length === 0) {
        return null;
    }

    const handleAccept = (bill: DetectedBill) => {
        const template = toBillTemplate(bill);
        onAccept(template);
        setDismissedIds((prev) => new Set([...prev, bill.id]));
    };

    const handleDismiss = (billId: string) => {
        onDismiss(billId);
        setDismissedIds((prev) => new Set([...prev, billId]));
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-5 ${className}`}
            style={{
                backgroundColor: isDark ? "rgba(99, 102, 241, 0.08)" : "rgba(99, 102, 241, 0.05)",
                border: `1px solid ${isDark ? "rgba(99, 102, 241, 0.2)" : "rgba(99, 102, 241, 0.15)"}`,
            }}
        >
            {/* Header */}
            <div className="mb-4 flex items-center gap-2">
                <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                >
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span
                    className="text-sm font-semibold"
                    style={{ color: isDark ? "#e0e0e0" : "#1e293b" }}
                >
                    Detected Recurring Bills
                </span>
                <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                        backgroundColor: "#6366f1",
                        color: "white",
                    }}
                >
                    {visibleBills.length} found
                </span>
            </div>

            {/* Bill list */}
            <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                    {visibleBills.slice(0, 5).map((bill) => (
                        <motion.div
                            key={bill.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            className="rounded-xl p-4"
                            style={{
                                backgroundColor: isDark ? "#27272a" : "#ffffff",
                                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
                            }}
                        >
                            <div className="flex items-start justify-between gap-3">
                                {/* Left: Logo + Info */}
                                <div className="flex items-center gap-3">
                                    <MerchantLogo merchantName={bill.merchantName} size="md" />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="font-medium"
                                                style={{ color: isDark ? "#fafafa" : "#18181b" }}
                                            >
                                                {bill.merchantName}
                                            </span>
                                            <ConfidenceBadge confidence={bill.confidence} />
                                        </div>
                                        <div
                                            className="mt-0.5 text-sm"
                                            style={{ color: isDark ? "#a1a1aa" : "#71717a" }}
                                        >
                                            {formatCurrency(bill.averageAmount)} • {getFrequencyLabel(bill.frequency)} • Day {bill.suggestedDueDay}
                                        </div>
                                        <div
                                            className="mt-1 text-xs"
                                            style={{ color: isDark ? "#71717a" : "#a1a1aa" }}
                                        >
                                            {bill.occurrences.length} occurrences detected
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Actions */}
                                <div className="flex items-center gap-2">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleDismiss(bill.id)}
                                        className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                                        style={{
                                            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                                            color: isDark ? "#a1a1aa" : "#71717a",
                                        }}
                                    >
                                        Dismiss
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleAccept(bill)}
                                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
                                        style={{
                                            backgroundColor: "#6366f1",
                                        }}
                                    >
                                        Add Bill
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Show more indicator */}
            {visibleBills.length > 5 && (
                <div
                    className="mt-3 text-center text-xs"
                    style={{ color: isDark ? "#71717a" : "#a1a1aa" }}
                >
                    +{visibleBills.length - 5} more detected bills
                </div>
            )}
        </motion.div>
    );
}
