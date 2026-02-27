import { useEffect } from "react";
import type { Plan, Period } from "@/data/plan";
import { formatMoney } from "@/lib/currency";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface PeriodCloseModalProps {
  plan: Plan;
  period: Period;
  endingBalance: number;
  actualIncome: number;
  actualSpending: number;
  actualSavings: number;
  actualLeftover: number;
  carryForward: boolean;
  onCarryForwardChange: (v: boolean) => void;
  onClose: () => void;
  /** Called when the user confirms — runs `doClose()` from usePeriodClose. */
  onConfirm: () => void;
}

/**
 * Modal dialog that summarises the current period and lets the user advance to
 * the next one, optionally carrying the ending balance forward.
 */
export function PeriodCloseModal({
  plan,
  period,
  endingBalance,
  actualIncome,
  actualSpending,
  actualSavings,
  actualLeftover,
  carryForward,
  onCarryForwardChange,
  onClose,
  onConfirm,
}: PeriodCloseModalProps) {
  const nextPeriod = plan.periods.find((p) => p.id === period.id + 1);

  const trapRef = useFocusTrap(true);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Close Period"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        className="vn-card p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-bold text-(--vn-text) mb-1">Close Period</div>
        <div className="text-xs text-(--vn-muted) mb-4">{period.label}</div>

        <div className="space-y-2 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-(--vn-muted)">Income</span>
            <span className="font-medium text-(--vn-text)">{formatMoney(actualIncome)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-(--vn-muted)">Spending</span>
            <span className="font-medium text-(--vn-text)">{formatMoney(actualSpending)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-(--vn-muted)">Savings</span>
            <span className="font-medium text-(--vn-text)">{formatMoney(actualSavings)}</span>
          </div>
          <div className="flex justify-between border-t border-(--vn-border) pt-2">
            <span className="font-semibold text-(--vn-text)">Leftover</span>
            <span
              className={`font-bold ${
                actualLeftover >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-500 dark:text-rose-400"
              }`}
            >
              {formatMoney(actualLeftover)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-(--vn-muted)">Forecast end balance</span>
            <span className="font-medium text-(--vn-text)">{formatMoney(endingBalance)}</span>
          </div>
        </div>

        {nextPeriod ? (
          <>
            <label className="flex items-center gap-2 text-sm text-(--vn-text) cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={carryForward}
                onChange={(e) => onCarryForwardChange(e.target.checked)}
                className="accent-(--vn-primary) w-4 h-4"
              />
              Carry balance ({formatMoney(endingBalance)}) to{" "}
              <strong className="ml-0.5">{nextPeriod.label}</strong>
            </label>
            {!carryForward && (
              <div className="text-xs text-(--vn-muted) mb-4">
                Next period will use your default starting balance (
                {formatMoney(plan.setup.startingBalance)}).
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={onConfirm} className="vn-btn vn-btn-primary flex-1 text-sm">
                Close &amp; Advance →
              </button>
              <button onClick={onClose} className="vn-btn vn-btn-ghost text-sm">
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-xs text-amber-600 dark:text-amber-400 mb-4">
              ⚠ No next period found. Generate more periods in Settings.
            </div>
            <button onClick={onClose} className="vn-btn vn-btn-ghost w-full text-sm">
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
