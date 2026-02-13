"use client";

import { motion } from "framer-motion";
import { useBranding } from "@/hooks/useBranding";

const SPRING_BOUNCY = { type: "spring" as const, stiffness: 200, damping: 15 };

export function WelcomeStep() {
  const brand = useBranding();
  const initial = (brand.name || "V").trim()[0]?.toUpperCase() || "V";
  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      {/* Animated logo mark */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={SPRING_BOUNCY}
        className="flex h-20 w-20 items-center justify-center rounded-3xl shadow-lg"
        style={{
          background: "linear-gradient(135deg, var(--vn-primary), var(--vn-accent))",
        }}
      >
        <span className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-playfair), serif" }}>
          {initial}
        </span>
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <h2
          className="text-2xl md:text-3xl font-bold"
          style={{ color: "var(--vn-text)", fontFamily: "var(--font-playfair), serif" }}
        >
          Welcome to {brand.name}
        </h2>
        {brand.tagline ? (
          <p
            className="mt-1 text-xs uppercase tracking-widest font-medium"
            style={{ color: "var(--vn-muted)" }}
          >
            {brand.tagline}
          </p>
        ) : null}
      </motion.div>

      {/* Value proposition */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="max-w-sm text-sm leading-relaxed"
        style={{ color: "var(--vn-muted)" }}
      >
        Take control of your money story. Plan every pound, track what actually
        happens, and see your financial future clearly.
      </motion.p>

      {/* Feature highlights */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="grid grid-cols-3 gap-4 w-full max-w-sm pt-2"
      >
        {[
          { icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z", label: "Plan" },
          { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", label: "Track" },
          { icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", label: "Forecast" },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 0.1 }}
            className="flex flex-col items-center gap-2 rounded-2xl p-3"
            style={{ background: "var(--vn-bg)" }}
          >
            <svg
              className="h-5 w-5"
              style={{ color: "var(--vn-primary)" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={item.icon} />
            </svg>
            <span className="text-xs font-semibold" style={{ color: "var(--vn-text)" }}>
              {item.label}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
