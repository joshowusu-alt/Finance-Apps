"use client";

import type { RefObject } from "react";

export interface IncomeInputStepProps {
  income: string;
  onIncomeChange: (value: string) => void;
  onEnterPress: () => void;
  currencySymbol: string;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function IncomeInputStep({
  income,
  onIncomeChange,
  onEnterPress,
  currencySymbol,
  inputRef,
}: IncomeInputStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-(--vn-text)">What&apos;s your monthly take-home pay?</h2>
        <p className="mt-2 text-sm text-(--vn-muted)">After tax, what lands in your account each month?</p>
      </div>
      <div className="relative">
        <span
          className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold pointer-events-none"
          style={{ zIndex: 1, color: "var(--vn-text)" }}
        >
          {currencySymbol}
        </span>
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={income}
          onChange={(e) => onIncomeChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && Number(income) > 0) onEnterPress();
          }}
          placeholder="0"
          className="vn-input text-2xl font-bold"
          style={{ paddingLeft: "3rem", height: "4rem" }}
        />
      </div>
    </div>
  );
}
