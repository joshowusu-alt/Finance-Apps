"use client";

import { generatePeriods, fmtLabel } from "@/data/plan";
import type { PeriodCadence } from "@/data/plan";

export interface PayCycleStepProps {
  periodCadence: PeriodCadence;
  onCadenceChange: (c: PeriodCadence) => void;
  periodStartDay: number;
  onStartDayChange: (day: number) => void;
}

export function PayCycleStep({
  periodCadence,
  onCadenceChange,
  periodStartDay,
  onStartDayChange,
}: PayCycleStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-(--vn-text)">When does your pay cycle start?</h2>
        <p className="mt-2 text-sm text-(--vn-muted)">We&apos;ll build budget periods around your pay dates.</p>
      </div>

      {/* Cadence picker */}
      <div>
        <label className="block text-xs font-semibold text-(--vn-muted) mb-2 uppercase tracking-wider">
          How often are you paid?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(["monthly", "biweekly", "weekly"] as PeriodCadence[]).map((c) => (
            <button
              key={c}
              onClick={() => onCadenceChange(c)}
              className={`rounded-xl px-3 py-3 text-sm font-medium transition-all border-2 ${
                periodCadence === c
                  ? "border-(--vn-primary) bg-(--vn-primary)/10"
                  : "border-(--vn-border) hover:border-(--vn-primary)/50"
              }`}
            >
              {c === "monthly" ? "Monthly" : c === "biweekly" ? "Every 2 weeks" : "Weekly"}
            </button>
          ))}
        </div>
      </div>

      {/* Start day picker */}
      <div>
        <label className="block text-xs font-semibold text-(--vn-muted) mb-2 uppercase tracking-wider">
          {periodCadence === "monthly"
            ? "What day of the month do you get paid?"
            : "What date did your last pay land?"}
        </label>
        {periodCadence === "monthly" ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
              <button
                key={day}
                onClick={() => onStartDayChange(day)}
                className={`rounded-lg py-2 text-sm font-medium transition-all ${
                  periodStartDay === day
                    ? "bg-(--vn-primary) text-white shadow-sm"
                    : "hover:bg-(--vn-primary)/10 text-(--vn-text)"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="date"
            value={(() => {
              const now = new Date();
              const d = new Date(now.getFullYear(), now.getMonth(), periodStartDay);
              return d.toISOString().split("T")[0];
            })()}
            onChange={(e) => {
              const d = new Date(e.target.value + "T00:00:00");
              if (!isNaN(d.getTime())) onStartDayChange(d.getDate());
            }}
            className="vn-input text-sm"
          />
        )}
      </div>

      {/* Preview */}
      <div className="rounded-lg bg-(--vn-primary)/5 px-4 py-3">
        <div className="text-xs font-semibold text-(--vn-muted) mb-1">Your first period will be</div>
        <div className="text-sm font-bold text-(--vn-text)">
          {(() => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), periodStartDay);
            const startStr = start.toISOString().split("T")[0];
            const preview = generatePeriods(startStr, periodCadence, 1)[0];
            if (!preview) return "\u2014";
            const s = new Date(preview.start + "T00:00:00");
            const e = new Date(preview.end + "T00:00:00");
            return `${fmtLabel(s)} \u2192 ${fmtLabel(e)}`;
          })()}
        </div>
      </div>
    </div>
  );
}
