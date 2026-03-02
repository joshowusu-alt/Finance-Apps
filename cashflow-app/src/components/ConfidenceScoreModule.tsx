"use client";

import { useState, useId } from "react";
import { useReducedMotion } from "framer-motion";
import type { ConfidenceResult, ConfidenceStatus } from "@/lib/confidence";

// ── Arc math ────────────────────────────────────────────────────────────────
// The gauge uses a 240° arc going from 7 o'clock (210°) to 5 o'clock (−30°)
// sweeping through 12 o'clock (the top).
//
// Angles are in standard math convention (CCW from east, y-up).
// polarToXY converts to SVG space (y-down) by negating sin.
// sweepFlag=0 → CCW in SVG screen = CW in math = goes upward through the top ✓

const ARC_START_DEG = 210; // 7 o'clock
const ARC_TOTAL_DEG = 240; // total sweep

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad), // negate sin to convert math y-up → SVG y-down
  };
}

/** Build an SVG arc path for a given sweep (0 = empty, 240 = full). */
function buildArcPath(
  cx: number,
  cy: number,
  r: number,
  sweepDeg: number
): string {
  if (sweepDeg <= 0) return "";
  const start = polarToXY(cx, cy, r, ARC_START_DEG);
  const endAngle = ARC_START_DEG - sweepDeg; // decrease = CW in math
  const end = polarToXY(cx, cy, r, endAngle);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  const sweepFlag = 0; // CCW in SVG → arc goes up through the top
  return [
    `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
  ].join(" ");
}

// ── Colour config (CSS tokens only — no hardcoded hex) ──────────────────────
const STATUS_CONFIG: Record<
  ConfidenceStatus,
  { color: string; bg: string }
> = {
  Secure:       { color: "var(--vn-status-secure)",  bg: "color-mix(in srgb, var(--vn-status-secure) 12%, transparent)" },
  Stable:       { color: "var(--vn-status-stable)",  bg: "color-mix(in srgb, var(--vn-status-stable) 12%, transparent)" },
  "Watch zone": { color: "var(--vn-status-watch)",   bg: "color-mix(in srgb, var(--vn-status-watch) 12%, transparent)" },
  "Tight zone": { color: "var(--vn-status-tight)",   bg: "color-mix(in srgb, var(--vn-status-tight) 12%, transparent)" },
};

// ── Pillar bar ───────────────────────────────────────────────────────────────
function PillarBar({
  label,
  value,
  max,
  color,
  reducedMotion,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  reducedMotion: boolean | null;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <div className="flex items-center justify-between gap-1">
        {/* text-xs + var(--vn-text): WCAG AA in both light and dark themes */}
        <span
          className="text-xs uppercase tracking-widest font-medium truncate"
          style={{ color: "var(--vn-text)" }}
        >
          {label}
        </span>
        <span
          className="text-xs font-bold tabular-nums shrink-0"
          style={{ color: "var(--vn-text)" }}
        >
          {value}
        </span>
      </div>
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ background: "var(--vn-border)" }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${value} of ${max}`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: color,
            transition: reducedMotion
              ? "none"
              : "width 0.9s cubic-bezier(0.25,0.46,0.45,0.94)",
          }}
        />
      </div>
    </div>
  );
}

// ── Inline collapsible ──────────────────────────────────────────────────────
function InlineCollapsible({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs focus:outline-none focus-visible:rounded"
        aria-expanded={open}
        aria-controls={id}
        style={{ color: "var(--vn-muted)" }}
      >
        <span>{label}</span>
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div id={id} className="mt-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
interface Props {
  confidence: ConfidenceResult;
}

const CX = 84;
const CY = 84;
const TRACK_R = 66;
const SVG_SIZE = 168;

export default function ConfidenceScoreModule({ confidence }: Props) {
  const reducedMotion = useReducedMotion();
  const cfg = STATUS_CONFIG[confidence.status];
  // Req 2: score must equal liquidity+behaviour+momentum; fall back if missing
  const score =
    confidence.score ?? Math.min(100, confidence.liquidity + confidence.behaviour + confidence.momentum);
  const fraction = Math.min(1, Math.max(0, score / 100));
  const scoreSweep = fraction * ARC_TOTAL_DEG;
  const trackPath = buildArcPath(CX, CY, TRACK_R, ARC_TOTAL_DEG);
  const scorePath = buildArcPath(CX, CY, TRACK_R, scoreSweep);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Lead: tier label + plain-English meaning ─────────────── */}
      <div>
        <div
          className="text-xs uppercase tracking-widest font-semibold mb-1"
          style={{ color: cfg.color }}
        >
          {confidence.status}
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--vn-text)" }}>
          {confidence.explanation}
        </p>
      </div>

      {/* ── Gauge row ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* SVG arc gauge */}
        <div className="shrink-0" aria-hidden="true">
          <svg
            width={SVG_SIZE}
            height={SVG_SIZE}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            style={{ overflow: "visible" }}
          >
            {/* Background fill circle */}
            <circle
              cx={CX}
              cy={CY}
              r={TRACK_R - 7}
              fill={cfg.bg}
              stroke="var(--vn-border)"
              strokeWidth="1"
            />
            {/* Track (full 240° background arc) */}
            <path
              d={trackPath}
              fill="none"
              stroke="var(--vn-border)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            {/* Score arc */}
            {scoreSweep > 0 && (
              <path
                d={scorePath}
                fill="none"
                stroke={cfg.color}
                strokeWidth="12"
                strokeLinecap="round"
                style={{
                  transition: reducedMotion
                    ? "none"
                    : "stroke 0.4s ease",
                }}
              />
            )}
            {/* Score number */}
            <text
              x={CX}
              y={CY - 6}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fill: cfg.color,
                fontSize: 30,
                fontWeight: 700,
                fontFamily: "inherit",
              }}
            >
              {score}
            </text>
            {/* Status label */}
            <text
              x={CX}
              y={CY + 18}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fill: "var(--vn-text)",
                fontSize: 11,
                fontFamily: "inherit",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {confidence.status}
            </text>
          </svg>
        </div>

        {/* Collapsible formula + pillar bars */}
        <div className="flex-1 min-w-0">
          <InlineCollapsible label="How this is calculated">
            <>
              <p
                className="text-sm mb-3"
                style={{ color: "var(--vn-text)", opacity: 0.7 }}
              >
                Score = Liquidity ({confidence.liquidity}/40) + Behaviour (
                {confidence.behaviour}/30) + Momentum ({confidence.momentum}/30)
              </p>
              <div
                className="flex gap-4"
                style={{ borderTop: "1px solid var(--vn-border)", paddingTop: "0.75rem" }}
              >
                <PillarBar
                  label="Liquidity"
                  value={confidence.liquidity}
                  max={40}
                  color={cfg.color}
                  reducedMotion={reducedMotion}
                />
                <PillarBar
                  label="Behaviour"
                  value={confidence.behaviour}
                  max={30}
                  color={cfg.color}
                  reducedMotion={reducedMotion}
                />
                <PillarBar
                  label="Momentum"
                  value={confidence.momentum}
                  max={30}
                  color={cfg.color}
                  reducedMotion={reducedMotion}
                />
              </div>
            </>
          </InlineCollapsible>
        </div>
      </div>

      {/* Screen-reader summary */}
      <p className="sr-only">
        Financial confidence score {score} out of 100, rated{" "}
        {confidence.status}. Liquidity {confidence.liquidity} of 40, Behaviour{" "}
        {confidence.behaviour} of 30, Momentum {confidence.momentum} of 30.{" "}
        {confidence.explanation}
      </p>
    </div>
  );
}
