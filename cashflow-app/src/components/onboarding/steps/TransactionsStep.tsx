"use client";

import { motion } from "framer-motion";
import { useBranding } from "@/hooks/useBranding";

const transactions = [
  { label: "Tesco Weekly Shop", amount: "45.60", category: "Allowance", categoryColor: "var(--vn-warning)" },
  { label: "Electric Bill", amount: "198.00", category: "Bill", categoryColor: "var(--vn-error)" },
  { label: "TfL Travel", amount: "7.20", category: "Other", categoryColor: "var(--vn-muted)" },
];

export function TransactionsStep() {
  const brand = useBranding();
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <div
          className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "color-mix(in srgb, var(--vn-warning) 12%, transparent)" }}
        >
          <svg
            className="h-7 w-7"
            style={{ color: "var(--vn-warning)" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <h2
          className="text-xl md:text-2xl font-bold"
          style={{ color: "var(--vn-text)", fontFamily: "var(--font-playfair), serif" }}
        >
          Track What Actually Happens
        </h2>
        <p className="mt-2 text-sm leading-relaxed max-w-md mx-auto" style={{ color: "var(--vn-muted)" }}>
          Log real transactions as they occur. {brand.name} compares your{" "}
          <strong style={{ color: "var(--vn-text)" }}>actuals against your plan</strong> to show where you really stand.
        </p>
      </motion.div>

      {/* Transaction examples */}
      <div className="space-y-3">
        {transactions.map((txn, i) => (
          <motion.div
            key={txn.label}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 25,
              delay: 0.3 + i * 0.12,
            }}
            className="flex items-center justify-between rounded-2xl px-4 py-3"
            style={{
              background: "var(--vn-bg)",
              border: "1px solid var(--vn-border)",
            }}
          >
            <div className="flex items-center gap-3">
              {/* Animated checkmark */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 15,
                  delay: 0.6 + i * 0.15,
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: "color-mix(in srgb, var(--vn-success) 12%, transparent)" }}
              >
                <svg
                  className="h-4 w-4"
                  style={{ color: "var(--vn-success)" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>
                  {txn.label}
                </div>
                <div
                  className="text-xs font-medium"
                  style={{ color: txn.categoryColor }}
                >
                  {txn.category}
                </div>
              </div>
            </div>
            <div className="text-sm font-bold" style={{ color: "var(--vn-text)" }}>
              {"\u00A3"}{txn.amount}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="rounded-2xl px-4 py-3 text-center text-xs leading-relaxed"
        style={{ background: "var(--vn-bg)", color: "var(--vn-muted)" }}
      >
        Match transactions to your bills and outflows for precise budget-vs-actual tracking.
      </motion.div>
    </div>
  );
}
