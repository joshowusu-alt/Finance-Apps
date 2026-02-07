"use client";

import { motion } from "framer-motion";

const SPRING = { type: "spring" as const, stiffness: 350, damping: 25 };

const billExamples = [
  { label: "Rent", amount: "550", timing: "Due 28th" },
  { label: "Electric & Gas", amount: "200", timing: "Due 26th" },
  { label: "Insurance", amount: "175", timing: "Due 28th" },
];

const outflowExamples = [
  { label: "Savings transfer", amount: "1,050", timing: "Monthly from 29th" },
  { label: "Weekly allowance", amount: "140", timing: "Weekly from 29th" },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.35 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: SPRING },
};

export function BillsVsOutflowsStep() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <div
          className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "color-mix(in srgb, var(--vn-primary) 12%, transparent)" }}
        >
          <svg
            className="h-7 w-7"
            style={{ color: "var(--vn-primary)" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 7h3m-3 4h3m-3 4h2" />
            <path d="M16 10l2 2-2 2" />
            <path d="M4 4h7v16H4zM13 4h7v16h-7z" opacity={0.3} />
          </svg>
        </div>
        <h2
          className="text-xl md:text-2xl font-bold"
          style={{ color: "var(--vn-text)", fontFamily: "var(--font-playfair), serif" }}
        >
          Two Kinds of Spending
        </h2>
        <p className="mt-2 text-sm leading-relaxed max-w-md mx-auto" style={{ color: "var(--vn-muted)" }}>
          Understanding the difference between <strong style={{ color: "var(--vn-text)" }}>Bills</strong> and{" "}
          <strong style={{ color: "var(--vn-text)" }}>Outflows</strong> is the key to mastering your cashflow.
        </p>
      </motion.div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* BILLS column */}
        <motion.div
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.15 }}
          className="rounded-3xl p-5 relative overflow-hidden"
          style={{
            background: "var(--vn-bg)",
            border: "1px solid var(--vn-border)",
          }}
        >
          {/* Accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
            style={{ background: "var(--vn-error)" }}
          />

          <div className="flex items-center gap-2 mb-3">
            <div
              className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--vn-error) 12%, transparent)" }}
            >
              <svg
                className="w-4 h-4"
                style={{ color: "var(--vn-error)" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--vn-text)" }}>Bills</h3>
              <p className="text-xs" style={{ color: "var(--vn-muted)" }}>Fixed obligations</p>
            </div>
          </div>

          {/* Key traits */}
          <div className="space-y-1.5 mb-4">
            {[
              "Due on a specific day of each month",
              "Same amount every time",
              "Must-pay commitments",
            ].map((trait, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-start gap-2 text-xs"
                style={{ color: "var(--vn-text)" }}
              >
                <span
                  className="mt-1 h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: "var(--vn-error)" }}
                />
                {trait}
              </motion.div>
            ))}
          </div>

          {/* Example items */}
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-2">
            {billExamples.map((bill) => (
              <motion.div
                key={bill.label}
                variants={itemVariants}
                className="flex items-center justify-between rounded-2xl px-3 py-2.5"
                style={{
                  background: "var(--vn-surface)",
                  border: "1px solid var(--vn-border)",
                }}
              >
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>
                    {bill.label}
                  </div>
                  <div className="text-xs" style={{ color: "var(--vn-muted)" }}>
                    {bill.timing}
                  </div>
                </div>
                <div className="text-sm font-bold" style={{ color: "var(--vn-error)" }}>
                  {"\u00A3"}{bill.amount}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Metaphor */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75 }}
            className="mt-4 rounded-xl px-3 py-2 text-xs font-medium text-center"
            style={{
              background: "color-mix(in srgb, var(--vn-error) 8%, transparent)",
              color: "var(--vn-error)",
            }}
          >
            Think: &ldquo;Pinned to the calendar&rdquo;
          </motion.div>
        </motion.div>

        {/* OUTFLOWS column */}
        <motion.div
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.25 }}
          className="rounded-3xl p-5 relative overflow-hidden"
          style={{
            background: "var(--vn-bg)",
            border: "1px solid var(--vn-border)",
          }}
        >
          {/* Accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
            style={{ background: "var(--vn-accent)" }}
          />

          <div className="flex items-center gap-2 mb-3">
            <div
              className="h-8 w-8 rounded-xl flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--vn-accent) 12%, transparent)" }}
            >
              <svg
                className="w-4 h-4"
                style={{ color: "var(--vn-accent)" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--vn-text)" }}>Outflows</h3>
              <p className="text-xs" style={{ color: "var(--vn-muted)" }}>Planned spending</p>
            </div>
          </div>

          {/* Key traits */}
          <div className="space-y-1.5 mb-4">
            {[
              "Repeat on a cadence (weekly / biweekly / monthly)",
              "Flow from a seed date forward",
              "Flexible \u2014 can shift or adjust",
            ].map((trait, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-start gap-2 text-xs"
                style={{ color: "var(--vn-text)" }}
              >
                <span
                  className="mt-1 h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: "var(--vn-accent)" }}
                />
                {trait}
              </motion.div>
            ))}
          </div>

          {/* Example items */}
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-2">
            {outflowExamples.map((outflow) => (
              <motion.div
                key={outflow.label}
                variants={itemVariants}
                className="flex items-center justify-between rounded-2xl px-3 py-2.5"
                style={{
                  background: "var(--vn-surface)",
                  border: "1px solid var(--vn-border)",
                }}
              >
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>
                    {outflow.label}
                  </div>
                  <div className="text-xs" style={{ color: "var(--vn-muted)" }}>
                    {outflow.timing}
                  </div>
                </div>
                <div className="text-sm font-bold" style={{ color: "var(--vn-accent)" }}>
                  {"\u00A3"}{outflow.amount}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Metaphor */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75 }}
            className="mt-4 rounded-xl px-3 py-2 text-xs font-medium text-center"
            style={{
              background: "color-mix(in srgb, var(--vn-accent) 8%, transparent)",
              color: "var(--vn-accent)",
            }}
          >
            Think: &ldquo;Recurring rhythm&rdquo;
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
