"use client";

import { motion } from "framer-motion";

const incomeExamples = [
  { label: "Salary", amount: "3,500", cadence: "Monthly on 26th", delay: 0.3 },
  { label: "Side project", amount: "400", cadence: "Biweekly", delay: 0.42 },
  { label: "Freelance", amount: "100", cadence: "Weekly", delay: 0.54 },
];

export function IncomeStep() {
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
          style={{ background: "color-mix(in srgb, var(--vn-success) 12%, transparent)" }}
        >
          <svg
            className="h-7 w-7"
            style={{ color: "var(--vn-success)" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2
          className="text-xl md:text-2xl font-bold"
          style={{ color: "var(--vn-text)", fontFamily: "var(--font-playfair), serif" }}
        >
          Money Coming In
        </h2>
        <p className="mt-2 text-sm leading-relaxed max-w-md mx-auto" style={{ color: "var(--vn-muted)" }}>
          Set up <strong style={{ color: "var(--vn-text)" }}>income rules</strong> to tell Velanovo when you get paid.
          Rules can be weekly, biweekly, or monthly.
        </p>
      </motion.div>

      {/* Example income cards */}
      <div className="space-y-3">
        {incomeExamples.map((item) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 25,
              delay: item.delay,
            }}
            className="flex items-center justify-between rounded-2xl px-4 py-3"
            style={{
              background: "var(--vn-bg)",
              border: "1px solid var(--vn-border)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: "color-mix(in srgb, var(--vn-success) 12%, transparent)" }}
              >
                <svg
                  className="h-4 w-4"
                  style={{ color: "var(--vn-success)" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>
                  {item.label}
                </div>
                <div className="text-xs" style={{ color: "var(--vn-muted)" }}>
                  {item.cadence}
                </div>
              </div>
            </div>
            <div className="text-sm font-bold" style={{ color: "var(--vn-success)" }}>
              +{"\u00A3"}{item.amount}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="rounded-2xl px-4 py-3 text-center text-xs leading-relaxed"
        style={{ background: "var(--vn-bg)", color: "var(--vn-muted)" }}
      >
        Velanovo uses these rules to forecast your income across every period automatically.
      </motion.div>
    </div>
  );
}
