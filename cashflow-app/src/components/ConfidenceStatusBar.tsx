"use client";

import { motion } from "framer-motion";
import type { ConfidenceResult, ConfidenceStatus } from "@/lib/confidence";

interface Props {
  confidence: ConfidenceResult;
  className?: string;
}

const STATUS_CONFIG: Record<ConfidenceStatus, {
  bg: string;
  text: string;
  border: string;
  dot: string;
  label: string;
}> = {
  Secure: {
    bg: "rgba(47, 122, 85, 0.12)",
    text: "var(--vn-status-secure)",
    border: "rgba(47, 122, 85, 0.25)",
    dot: "var(--vn-status-secure)",
    label: "Secure",
  },
  Stable: {
    bg: "rgba(197, 160, 70, 0.12)",
    text: "var(--vn-status-stable)",
    border: "rgba(197, 160, 70, 0.25)",
    dot: "var(--vn-status-stable)",
    label: "Stable",
  },
  Watch: {
    bg: "rgba(180, 120, 20, 0.12)",
    text: "var(--vn-status-watch)",
    border: "rgba(180, 120, 20, 0.25)",
    dot: "var(--vn-status-watch)",
    label: "Watch",
  },
  "At Risk": {
    bg: "rgba(158, 78, 78, 0.12)",
    text: "var(--vn-status-risk)",
    border: "rgba(158, 78, 78, 0.25)",
    dot: "var(--vn-status-risk)",
    label: "At Risk",
  },
};

export default function ConfidenceStatusBar({ confidence, className = "" }: Props) {
  const cfg = STATUS_CONFIG[confidence.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={`flex items-start gap-3 rounded-xl px-4 py-3 ${className}`}
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
      role="status"
      aria-label={`Financial confidence: ${confidence.status}`}
    >
      {/* Status badge */}
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        <span
          className="block w-2 h-2 rounded-full"
          style={{ background: cfg.dot }}
          aria-hidden="true"
        />
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: cfg.text, letterSpacing: "0.1em" }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Divider */}
      <span
        className="block w-px self-stretch shrink-0"
        style={{ background: cfg.border }}
        aria-hidden="true"
      />

      {/* Reason */}
      <p
        className="text-xs leading-relaxed"
        style={{ color: "var(--vn-muted)" }}
      >
        {confidence.shortReason}
      </p>
    </motion.div>
  );
}
