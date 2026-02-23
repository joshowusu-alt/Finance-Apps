"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { SpendAnomaly } from "@/lib/anomalyDetection";
import { formatMoney } from "@/lib/currency";

const CATEGORY_LABELS: Record<string, string> = {
  allowance: "Allowance",
  bill: "Bills",
  giving: "Giving",
  savings: "Savings",
  other: "Other spending",
  buffer: "Buffer",
  income: "Income",
};

const CATEGORY_EMOJI: Record<string, string> = {
  allowance: "🛒",
  bill: "🧾",
  giving: "🫶",
  savings: "🏦",
  other: "💸",
  buffer: "🛡️",
};

function ratioLabel(ratio: number) {
  if (ratio >= 3) return "text-rose-500 dark:text-rose-400";
  if (ratio >= 2) return "text-orange-500 dark:text-orange-400";
  return "text-amber-500 dark:text-amber-400";
}

function ratioBar(ratio: number) {
  if (ratio >= 3) return "bg-rose-400";
  if (ratio >= 2) return "bg-orange-400";
  return "bg-amber-400";
}

interface Props {
  anomalies: SpendAnomaly[];
}

export default function AnomalyAlerts({ anomalies }: Props) {
  if (anomalies.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="vn-card overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--vn-border)]">
          <div>
            <div className="text-sm font-bold text-[var(--vn-text)] flex items-center gap-2">
              <span>⚠️</span>
              <span>Spending Anomalies</span>
            </div>
            <div className="text-xs text-[var(--vn-muted)] mt-0.5">
              Categories running above their 3-period average
            </div>
          </div>
          <Link
            href="/insights"
            className="text-xs font-semibold text-[var(--vn-primary)] hover:underline whitespace-nowrap"
          >
            Details →
          </Link>
        </div>

        {/* Anomaly rows */}
        <div className="divide-y divide-[var(--vn-border)]">
          {anomalies.map((a) => (
            <div key={a.category} className="px-5 py-3 flex items-center gap-4">
              {/* Emoji icon */}
              <div className="text-xl shrink-0 w-7 text-center">
                {CATEGORY_EMOJI[a.category] ?? "💸"}
              </div>

              {/* Label + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[var(--vn-text)]">
                    {CATEGORY_LABELS[a.category] ?? a.category}
                  </span>
                  <span className={`text-xs font-bold tabular-nums ${ratioLabel(a.ratio)}`}>
                    {a.ratio.toFixed(1)}× usual
                  </span>
                </div>

                {/* Visual ratio bar */}
                <div className="relative h-1.5 rounded-full bg-[var(--vn-border)]">
                  {/* Avg marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-[var(--vn-muted)] rounded-full opacity-60"
                    style={{ left: `${Math.min(95, (1 / a.ratio) * 95)}%` }}
                  />
                  {/* Fill */}
                  <motion.div
                    className={`absolute inset-y-0 left-0 rounded-full ${ratioBar(a.ratio)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(98, (a.ratio / (a.ratio + 1)) * 100)}%` }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                  />
                </div>

                <div className="flex justify-between text-[10px] mt-1 text-[var(--vn-muted)]">
                  <span>
                    {formatMoney(a.currentAmount)} this period
                  </span>
                  <span>
                    avg {formatMoney(a.avgAmount)} over {a.periodsUsed} period{a.periodsUsed !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
