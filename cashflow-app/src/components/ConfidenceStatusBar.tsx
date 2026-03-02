"use client";

import type { ConfidenceResult, ConfidenceStatus } from "@/lib/confidence";

interface Props {
  confidence: ConfidenceResult;
  className?: string;
}

const STATUS_CONFIG: Record<
  ConfidenceStatus,
  { bg: string; text: string; border: string; dot: string }
> = {
  Secure: {
    bg: "rgba(47,122,85,0.10)",
    text: "var(--vn-status-secure)",
    border: "rgba(47,122,85,0.20)",
    dot: "var(--vn-status-secure)",
  },
  Stable: {
    bg: "rgba(197,160,70,0.10)",
    text: "var(--vn-status-stable)",
    border: "rgba(197,160,70,0.20)",
    dot: "var(--vn-status-stable)",
  },
  "Watch zone": {
    bg: "rgba(180,120,20,0.10)",
    text: "var(--vn-status-watch)",
    border: "rgba(180,120,20,0.20)",
    dot: "var(--vn-status-watch)",
  },
  "Tight zone": {
    bg: "rgba(158,78,78,0.10)",
    text: "var(--vn-status-tight)",
    border: "rgba(158,78,78,0.20)",
    dot: "var(--vn-status-tight)",
  },
};

/**
 * Inline pill variant — dot + tier label + one-line explanation.
 * The full numeric score + pillar breakdown lives in ConfidenceScoreModule.
 */
export default function ConfidenceStatusBar({ confidence, className = "" }: Props) {
  const cfg = STATUS_CONFIG[confidence.status];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${className}`}
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
      role="status"
      aria-label={`Financial confidence: ${confidence.status}`}
    >
      {/* Status dot */}
      <span
        className="block w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: cfg.dot }}
        aria-hidden="true"
      />
      {/* Tier label */}
      <span
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: cfg.text }}
      >
        {confidence.status}
      </span>
      {/* Separator + one-line explanation (hidden on very small screens) */}
      <span
        className="hidden sm:inline text-xs"
        style={{ color: cfg.border }}
        aria-hidden="true"
      >
        ·
      </span>
      <span
        className="hidden sm:inline text-xs line-clamp-1"
        style={{ color: "rgba(240,237,232,0.55)" }}
      >
        {confidence.explanation}
      </span>
    </div>
  );
}

