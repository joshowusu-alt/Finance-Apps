"use client";

import { motion } from "framer-motion";

const periods = [
  { label: "Period 1", dates: "29 Nov - 25 Dec", active: false },
  { label: "Period 2", dates: "26 Dec - 25 Jan", active: true },
  { label: "Period 3", dates: "26 Jan - 25 Feb", active: false },
];

export function PeriodsStep() {
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
            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2
          className="text-xl md:text-2xl font-bold"
          style={{ color: "var(--vn-text)", fontFamily: "var(--font-playfair), serif" }}
        >
          Your Budget Cycles
        </h2>
        <p className="mt-2 text-sm leading-relaxed max-w-md mx-auto" style={{ color: "var(--vn-muted)" }}>
          Velanovo organises your finances into <strong style={{ color: "var(--vn-text)" }}>periods</strong> &mdash;
          budget cycles that match your pay schedule. Each period has its own start date, end date, and balance tracking.
        </p>
      </motion.div>

      {/* Visual timeline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="relative"
      >
        {/* Connecting line */}
        <div
          className="absolute top-1/2 left-4 right-4 h-0.5 -translate-y-1/2"
          style={{ background: "var(--vn-border)" }}
        />

        <div className="relative flex justify-between gap-3">
          {periods.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
                delay: 0.4 + i * 0.12,
              }}
              className="relative flex-1 rounded-2xl p-4 text-center"
              style={{
                background: p.active ? "var(--vn-surface)" : "var(--vn-bg)",
                border: p.active
                  ? "2px solid var(--vn-primary)"
                  : "1px solid var(--vn-border)",
                boxShadow: p.active ? "0 8px 24px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {p.active && (
                <motion.div
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: "var(--vn-primary)",
                    color: "var(--vn-surface)",
                  }}
                >
                  Current
                </motion.div>
              )}
              <div
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: p.active ? "var(--vn-primary)" : "var(--vn-muted)" }}
              >
                {p.label}
              </div>
              <div
                className="mt-1 text-[11px]"
                style={{ color: "var(--vn-muted)" }}
              >
                {p.dates}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Tip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="rounded-2xl px-4 py-3 text-center text-xs leading-relaxed"
        style={{ background: "var(--vn-bg)", color: "var(--vn-muted)" }}
      >
        Set your periods to match your payday. Everything &mdash; income, bills,
        spending &mdash; flows within these cycles.
      </motion.div>
    </div>
  );
}
