"use client";

import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useState, useEffect } from "react";
import { MerchantLogo } from "@/components/MerchantLogo";
import type { DetectedBill } from "@/lib/billDetection";
import { getBillConfidenceLabel, toBillTemplate } from "@/lib/billDetection";
import { formatMoney } from "@/lib/currency";
import type { BillTemplate } from "@/data/plan";

type Props = {
    detectedBills: DetectedBill[];
    onAccept: (bill: BillTemplate) => void;
    onDismiss: (billId: string) => void;
    className?: string;
};

function getFrequencyLabel(frequency: string): string {
    const labels: Record<string, string> = {
        monthly: "Monthly",
        biweekly: "Every 2 weeks",
        weekly: "Weekly",
    };
    return labels[frequency] || frequency;
}

function SwipeableBillCard({ bill, onAccept, onDismiss, isDark }: {
    bill: DetectedBill;
    onAccept: (b: DetectedBill) => void;
    onDismiss: (id: string) => void;
    isDark: boolean;
}) {
    const x = useMotionValue(0);
    const acceptOpacity = useTransform(x, [0, 70], [0, 1]);
    const dismissOpacity = useTransform(x, [-70, 0], [1, 0]);
    const cardScale = useTransform(x, [-80, 0, 80], [0.97, 1, 0.97]);

    function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
        if (info.offset.x > 80) onAccept(bill);
        else if (info.offset.x < -80) onDismiss(bill.id);
    }

    return (
        <div className="relative overflow-hidden rounded-xl" style={{ touchAction: "pan-y" }}>
            {/* Accept hint: swipe right */}
            <motion.div
                className="absolute inset-0 flex items-center justify-start pl-5 rounded-xl"
                aria-hidden
                style={{ opacity: acceptOpacity, backgroundColor: isDark ? "rgba(16,185,129,0.18)" : "rgba(16,185,129,0.12)" }}
            >
                <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">✓ Add Bill</span>
            </motion.div>
            {/* Dismiss hint: swipe left */}
            <motion.div
                aria-hidden
                className="absolute inset-0 flex items-center justify-end pr-5 rounded-xl"
                style={{ opacity: dismissOpacity, backgroundColor: isDark ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.12)" }}
            >
                <span className="font-bold text-sm text-rose-600 dark:text-rose-400">✗ Dismiss</span>
            </motion.div>
            {/* Card */}
            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={handleDragEnd}
                style={{ x, scale: cardScale, backgroundColor: isDark ? "#27272a" : "#ffffff", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                className="relative rounded-xl p-4 cursor-grab active:cursor-grabbing z-10"
                whileTap={{ cursor: "grabbing" }}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <MerchantLogo merchantName={bill.merchantName} size="md" />
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium" style={{ color: isDark ? "#fafafa" : "#18181b" }}>{bill.merchantName}</span>
                                <ConfidenceBadge confidence={bill.confidence} />
                            </div>
                            <div className="mt-0.5 text-sm" style={{ color: isDark ? "#a1a1aa" : "#71717a" }}>
                                {formatMoney(bill.averageAmount)} • {getFrequencyLabel(bill.frequency)} • Day {bill.suggestedDueDay}
                            </div>
                            <div className="mt-1 text-xs" style={{ color: isDark ? "#52525b" : "#a1a1aa" }}>
                                {bill.occurrences.length} occurrences • <span className="text-[10px] opacity-70">Swipe to confirm or dismiss</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => onDismiss(bill.id)}
                            className="rounded-lg px-3 py-1.5 text-xs min-h-10 font-medium transition-colors"
                            style={{ backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", color: isDark ? "#a1a1aa" : "#71717a" }}
                        >Dismiss</motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => onAccept(bill)}
                            className="rounded-lg px-3 py-1.5 text-xs min-h-10 font-medium text-white transition-colors"
                            style={{ backgroundColor: "#6366f1" }}
                        >Add Bill</motion.button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
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
    const [isDark, setIsDark] = useState(() => typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark");
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
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
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span className="text-sm font-semibold" style={{ color: isDark ? "#e0e0e0" : "#1e293b" }}>Detected Recurring Bills</span>
                <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "#6366f1", color: "white" }}>
                    {visibleBills.length} found
                </span>
            </div>

            {/* Bill list — swipeable cards */}
            <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                    {visibleBills.slice(0, 5).map((bill) => (
                        <motion.div
                            key={bill.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, height: 0, marginBottom: 0, transition: { duration: 0.2 } }}
                        >
                            <SwipeableBillCard
                                bill={bill}
                                onAccept={handleAccept}
                                onDismiss={handleDismiss}
                                isDark={isDark}
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {visibleBills.length > 5 && (
                <div className="mt-3 text-center text-xs" style={{ color: isDark ? "#71717a" : "#a1a1aa" }}>
                    +{visibleBills.length - 5} more detected bills
                </div>
            )}
        </motion.div>
    );
}
