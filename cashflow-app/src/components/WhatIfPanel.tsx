"use client";

/**
 * WhatIfPanel
 *
 * Interactive "what-if" scenario card. Shows sliders for each adjustable
 * spending category; updates the projected end-of-period balance in real time.
 *
 * The end balance impact is simple: reducing spend by £X adds £X to the
 * projected end balance, and vice versa.
 */

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/currency";

type CategoryItem = {
  category: string;
  budgeted: number;
  actual: number;
};

type Props = {
  /** Non-savings outflow category variance items */
  categories: CategoryItem[];
  /** Current projected end balance */
  projectedEndBalance: number;
};

const ADJUSTABLE_CATEGORIES = ["giving", "allowance", "other", "buffer", "bill"];

const LABEL: Record<string, string> = {
  giving: "Giving",
  allowance: "Allowance",
  other: "Other",
  buffer: "Buffer",
  bill: "Bills",
};

export default function WhatIfPanel({
  categories,
  projectedEndBalance,
}: Props) {
  const [open, setOpen] = useState(false);

  // adjustments: delta from current projected spend per category (negative = saving money)
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});

  const adjustableCategories = useMemo(
    () => categories.filter((c) => ADJUSTABLE_CATEGORIES.includes(c.category)),
    [categories]
  );

  const totalAdjustment = useMemo(
    () => Object.values(adjustments).reduce((s, v) => s + v, 0),
    [adjustments]
  );

  const newEndBalance = projectedEndBalance - totalAdjustment;

  function handleSlider(category: string, delta: number) {
    setAdjustments((prev) => ({ ...prev, [category]: delta }));
  }

  function reset() {
    setAdjustments({});
  }

  const hasAdjustments = Object.values(adjustments).some((v) => v !== 0);

  return (
    <div className="vn-card p-6">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <div>
          <div className="text-sm font-semibold text-[var(--vn-text)]">
            What-if scenario
          </div>
          <div className="text-xs text-[var(--vn-muted)] mt-0.5">
            Adjust spending to see impact on end balance
          </div>
        </div>
        <span className="text-xs text-[var(--vn-muted)] shrink-0">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-5">
          {/* Summary impact */}
          <div className={`mb-4 rounded-2xl p-4 border ${
            hasAdjustments
              ? totalAdjustment > 0
                ? "bg-rose-50 dark:bg-rose-900/15 border-rose-200 dark:border-rose-800"
                : "bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800"
              : "bg-[var(--vn-surface)] border-[var(--vn-border)]"
          }`}>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-[var(--vn-muted)]">Current projected end balance</div>
                <div className="font-semibold text-[var(--vn-text)] mt-0.5">{formatMoney(projectedEndBalance)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--vn-muted)]">What-if end balance</div>
                <div className={`font-semibold mt-0.5 ${
                  hasAdjustments
                    ? newEndBalance > projectedEndBalance
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                    : "text-[var(--vn-text)]"
                }`}>
                  {formatMoney(newEndBalance)}
                </div>
              </div>
            </div>

            {hasAdjustments && (
              <div className={`mt-2 text-xs font-semibold ${
                totalAdjustment < 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}>
                {totalAdjustment < 0
                  ? `Saving ${formatMoney(Math.abs(totalAdjustment))} → end balance improves by ${formatMoney(Math.abs(totalAdjustment))}`
                  : `Spending ${formatMoney(totalAdjustment)} more → end balance reduces by ${formatMoney(totalAdjustment)}`
                }
              </div>
            )}
          </div>

          {/* Category sliders */}
          <div className="space-y-5">
            {adjustableCategories.length === 0 && (
              <div className="text-xs text-[var(--vn-muted)]">
                No adjustable categories found for this period.
              </div>
            )}

            {adjustableCategories.map((cat) => {
              const adj = adjustments[cat.category] ?? 0;
              // Slider range: cut half the projected spend at most, or add 50%
              const maxCut = Math.round(cat.actual * 0.8);
              const maxAdd = Math.round(cat.budgeted * 0.5) || 50;
              const min = -maxCut;
              const max = maxAdd;

              return (
                <div key={cat.category}>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs mb-1.5">
                    <span className="font-medium text-[var(--vn-text)] shrink-0">
                      {LABEL[cat.category] ?? cat.category}
                    </span>
                    <span className={`font-semibold tabular-nums text-right min-w-0 ${
                      adj < 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : adj > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-[var(--vn-muted)]"
                    }`}>
                      {adj === 0
                        ? `actual ${formatMoney(cat.actual)}`
                        : adj < 0
                        ? `save ${formatMoney(Math.abs(adj))} → ${formatMoney(cat.actual + adj)}`
                        : `+${formatMoney(adj)} → ${formatMoney(cat.actual + adj)}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={5}
                    value={adj}
                    onChange={(e) =>
                      handleSlider(cat.category, Number(e.target.value))
                    }
                    className="w-full accent-[var(--vn-primary)] h-2 rounded-full"
                    aria-label={`Adjust ${LABEL[cat.category] ?? cat.category} spend`}
                  />
                  <div className="flex justify-between text-[10px] text-[var(--vn-muted)] mt-0.5">
                    <span>−{formatMoney(maxCut)}</span>
                    <span>current</span>
                    <span>+{formatMoney(maxAdd)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {hasAdjustments && (
            <button
              type="button"
              onClick={reset}
              className="mt-4 text-xs text-[var(--vn-muted)] hover:text-[var(--vn-text)] transition-colors"
            >
              Reset all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
