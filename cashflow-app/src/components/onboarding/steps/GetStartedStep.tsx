"use client";

import { motion } from "framer-motion";

export function GetStartedStep({
  onComplete,
}: {
  onComplete: (choice: "fresh" | "sample") => void;
}) {
  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{
          background: "linear-gradient(135deg, var(--vn-success), color-mix(in srgb, var(--vn-success) 70%, var(--vn-primary)))",
        }}
      >
        <svg
          className="h-10 w-10 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <motion.path
            d="M5 13l4 4L19 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.4, duration: 0.5, ease: "easeOut" }}
          />
        </svg>
      </motion.div>

      {/* Floating particles */}
      {[
        { x: -60, y: -40, delay: 0.3, size: 6 },
        { x: 70, y: -30, delay: 0.4, size: 4 },
        { x: -40, y: 30, delay: 0.5, size: 5 },
        { x: 55, y: 40, delay: 0.35, size: 4 },
      ].map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: "var(--vn-primary)",
            left: "50%",
            top: "30%",
          }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
          animate={{
            x: p.x,
            y: [0, p.y, p.y - 20],
            opacity: [0, 1, 0],
            scale: [0, 1.2, 0],
          }}
          transition={{
            delay: p.delay,
            duration: 1.2,
            ease: "easeOut",
          }}
        />
      ))}

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <h2
          className="text-2xl md:text-3xl font-bold"
          style={{ color: "var(--vn-text)", fontFamily: "var(--font-playfair), serif" }}
        >
          You&rsquo;re All Set
        </h2>
        <p className="mt-2 text-sm leading-relaxed max-w-sm mx-auto" style={{ color: "var(--vn-muted)" }}>
          Start with sample data to explore how everything works, or begin fresh with your own numbers.
        </p>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <button
          onClick={() => onComplete("fresh")}
          className="vn-btn vn-btn-primary w-full py-3 text-sm font-semibold"
        >
          Start Fresh
        </button>
        <button
          onClick={() => onComplete("sample")}
          className="vn-btn vn-btn-secondary w-full py-3 text-sm font-semibold"
        >
          Explore Sample Data
        </button>
      </motion.div>

      {/* Reassurance */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-xs"
        style={{ color: "var(--vn-muted)" }}
      >
        You can replay this guide any time from Settings.
      </motion.p>
    </div>
  );
}
