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
  Watch: {
    bg: "rgba(180,120,20,0.10)",
    text: "var(--vn-status-watch)",
    border: "rgba(180,120,20,0.20)",
    dot: "var(--vn-status-watch)",
  },
  "At Risk": {
    bg: "rgba(158,78,78,0.10)",
    text: "var(--vn-status-risk)",
    border: "rgba(158,78,78,0.20)",
    dot: "var(--vn-status-risk)",
  },
};

export default function ConfidenceStatusBar({ confidence, className = "" }: Props) {
  const cfg = STATUS_CONFIG[confidence.status];

  return (
    <div
      className={`flex items-center gap-4 rounded-xl px-4 py-3 ${className}`}
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
      role="status"
      aria-label={`Financial confidence: ${confidence.status}, score ${confidence.score}`}
    >
      {/* Left: large numeric score */}
      <div className="shrink-0 text-center">
        <div
          className="text-[10px] uppercase tracking-widest font-semibold mb-0.5"
          style={{ color: "rgba(240,237,232,0.45)" }}
        >
          Confidence
        </div>
        <div
          className="font-bold tabular-nums leading-none"
          style={{
            fontSize: "clamp(2rem,5vw,2.5rem)",
            color: cfg.text,
            transition: "color 400ms ease",
          }}
        >
          {confidence.score}
        </div>
      </div>

      {/* Divider */}
      <span
        className="block w-px self-stretch shrink-0"
        style={{ background: cfg.border }}
        aria-hidden="true"
      />

      {/* Right: tier label + explanation */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className="block w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: cfg.dot }}
            aria-hidden="true"
          />
          <span
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: cfg.text }}
          >
            {confidence.status}
          </span>
        </div>
        <p
          className="text-xs leading-relaxed line-clamp-2"
          style={{ color: "rgba(240,237,232,0.55)" }}
        >
          {confidence.explanation}
        </p>
      </div>
    </div>
  );
}

