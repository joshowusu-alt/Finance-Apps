"use client";

/**
 * SpendingVelocityGauge
 *
 * A semi-arc speedometer showing how fast you are spending vs budget.
 * Needle = actual daily rate.  Midpoint = budget daily rate.
 * Green zone: ≤ budget rate.  Amber: 100–130%.  Red: 130%+.
 */

import { useMemo } from "react";
import { formatMoney } from "@/lib/currency";

type Props = {
  /** Total spend so far this period */
  actualSpend: number;
  /** Total budgeted for spending this period (excl. savings) */
  budgetSpend: number;
  /** Days elapsed so far */
  daysElapsed: number;
  /** Total period length in days */
  periodDays: number;
  /** Days remaining */
  daysRemaining: number;
};

// ─── SVG helpers ─────────────────────────────────────────────────────────────

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarToXY(cx, cy, r, startDeg);
  const e = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

export default function SpendingVelocityGauge({
  actualSpend,
  budgetSpend,
  daysElapsed,
  periodDays,
  daysRemaining,
}: Props) {
  const budgetDailyRate = periodDays > 0 ? budgetSpend / periodDays : 0;
  const actualDailyRate = daysElapsed > 0 ? actualSpend / daysElapsed : 0;

  // Fraction along the gauge (0 = no spend, 1 = 2× budget rate = red zone)
  const fraction = useMemo(() => {
    if (budgetDailyRate <= 0) return 0;
    return Math.min(actualDailyRate / (2 * budgetDailyRate), 1);
  }, [actualDailyRate, budgetDailyRate]);

  // Gauge spans from 210° to 330° (= 120° of arc)
  const START_DEG = 210;
  const END_DEG = 330;
  const RANGE_DEG = END_DEG - START_DEG;

  const needleDeg = START_DEG + fraction * RANGE_DEG;
  const budgetDeg = START_DEG + 0.5 * RANGE_DEG; // midpoint = budget rate

  const cx = 60;
  const cy = 56;
  const outerR = 46;
  const innerR = 32;
  const needleR = outerR - 4;

  // Color zones
  const zoneFraction = fraction; // 0–0.5 = green, 0.5–0.65 = amber, 0.65–1 = red
  const gaugeColor =
    zoneFraction <= 0.5 ? "#22c55e" : zoneFraction <= 0.65 ? "#eab308" : "#ef4444";

  // Needle tip
  const tip = polarToXY(cx, cy, needleR, needleDeg);
  const base1 = polarToXY(cx, cy, 6, needleDeg + 90);
  const base2 = polarToXY(cx, cy, 6, needleDeg - 90);

  // Budget marker
  const budgetOuter = polarToXY(cx, cy, outerR + 4, budgetDeg);
  const budgetInner = polarToXY(cx, cy, innerR - 3, budgetDeg);

  // Status copy
  const pct = budgetDailyRate > 0 ? Math.round((actualDailyRate / budgetDailyRate) * 100) : 0;
  const statusLabel =
    zoneFraction <= 0.5 ? "Under budget" : zoneFraction <= 0.65 ? "Slightly high" : "Overspending";
  const statusColor =
    zoneFraction <= 0.5
      ? "text-emerald-600 dark:text-emerald-400"
      : zoneFraction <= 0.65
      ? "text-amber-600 dark:text-amber-400"
      : "text-rose-600 dark:text-rose-400";

  const projectedSpend =
    daysElapsed > 0 && periodDays > 0
      ? (actualSpend / daysElapsed) * periodDays
      : null;

  return (
    <div className="rounded-2xl bg-[var(--vn-surface)] p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-[var(--vn-muted)] mb-3">
        Spending velocity
      </div>

      <div className="flex items-center gap-4">
        {/* Gauge SVG */}
        <svg width={120} height={72} viewBox="0 0 120 72" aria-label={`Spending at ${pct}% of daily budget rate`}>
          {/* Background arc */}
          <path
            d={arcPath(cx, cy, (outerR + innerR) / 2, START_DEG, END_DEG)}
            fill="none"
            stroke="var(--vn-border)"
            strokeWidth={outerR - innerR}
            strokeLinecap="butt"
          />

          {/* Colored fill arc from start to needle */}
          {fraction > 0 && (
            <path
              d={arcPath(cx, cy, (outerR + innerR) / 2, START_DEG, needleDeg)}
              fill="none"
              stroke={gaugeColor}
              strokeWidth={outerR - innerR}
              strokeLinecap="butt"
              opacity={0.85}
            />
          )}

          {/* Budget marker tick */}
          <line
            x1={budgetInner.x}
            y1={budgetInner.y}
            x2={budgetOuter.x}
            y2={budgetOuter.y}
            stroke="#94a3b8"
            strokeWidth={2}
            strokeLinecap="round"
          />

          {/* Needle */}
          <polygon
            points={`${tip.x},${tip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}`}
            fill={gaugeColor}
            opacity={0.95}
          />

          {/* Center dot */}
          <circle cx={cx} cy={cy} r={5} fill={gaugeColor} />

          {/* Pct label */}
          <text
            x={cx}
            y={cy - 14}
            textAnchor="middle"
            fontSize={10}
            fontWeight="600"
            fill="currentColor"
            className="fill-[var(--vn-text)]"
          >
            {pct}%
          </text>
        </svg>

        {/* Stats */}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${statusColor}`}>{statusLabel}</div>
          <div className="mt-1 text-xs text-[var(--vn-muted)]">
            <span className="font-medium text-[var(--vn-text)]">{formatMoney(actualDailyRate)}/day</span>
            {" "}actual vs{" "}
            <span className="font-medium text-[var(--vn-text)]">{formatMoney(budgetDailyRate)}/day</span>
            {" "}budget
          </div>
          {projectedSpend !== null && daysElapsed > 1 && (
            <div className="mt-1.5 text-xs text-[var(--vn-muted)]">
              Projected:{" "}
              <span
                className={
                  projectedSpend > budgetSpend * 1.05
                    ? "font-semibold text-rose-600 dark:text-rose-400"
                    : "font-medium text-[var(--vn-text)]"
                }
              >
                {formatMoney(projectedSpend)}
              </span>
              {projectedSpend > budgetSpend * 1.05 && (
                <span className="ml-1 text-rose-500">
                  (+{formatMoney(projectedSpend - budgetSpend)} over)
                </span>
              )}
            </div>
          )}
          {daysRemaining > 0 && budgetDailyRate > 0 && (
            <div className="mt-1 text-xs text-[var(--vn-muted)]">
              {daysRemaining}d left · budget{" "}
              {formatMoney(budgetDailyRate)}/day
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
