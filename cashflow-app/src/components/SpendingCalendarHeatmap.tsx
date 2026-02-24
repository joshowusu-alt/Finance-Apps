"use client";

/**
 * SpendingCalendarHeatmap
 *
 * Renders a calendar grid for the given period with days coloured by
 * spending intensity. Darker = more spent relative to the period peak day.
 */

import { useMemo, useState } from "react";
import type { Transaction } from "@/data/plan";
import { formatMoney } from "@/lib/currency";
import { getDisplayLocale } from "@/lib/formatUtils";

type Props = {
  transactions: Transaction[];
  periodStart: string;
  periodEnd: string;
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return iso(d);
}

const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** 0 = Monday … 6 = Sunday */
function isoWeekday(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return (d.getDay() + 6) % 7;
}

function formatDayNumber(dateStr: string) {
  return new Date(dateStr + "T00:00:00").getDate();
}

function formatMonthYear(dateStr: string) {
  const locale = getDisplayLocale();
  return new Date(dateStr + "T00:00:00").toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

export default function SpendingCalendarHeatmap({
  transactions,
  periodStart,
  periodEnd,
}: Props) {
  // Aggregate outflow amounts by date (excluding savings)
  const spendByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type !== "outflow" || t.category === "savings") continue;
      if (t.date < periodStart || t.date > periodEnd) continue;
      map[t.date] = (map[t.date] ?? 0) + t.amount;
    }
    return map;
  }, [transactions, periodStart, periodEnd]);

  const maxDay = useMemo(
    () => Math.max(0, ...Object.values(spendByDay)),
    [spendByDay]
  );

  // Build the flat list of days in the period range
  const days: string[] = useMemo(() => {
    const result: string[] = [];
    let cur = periodStart;
    while (cur <= periodEnd) {
      result.push(cur);
      cur = addDays(cur, 1);
    }
    return result;
  }, [periodStart, periodEnd]);

  // We render weeks in rows starting Monday. Pad the start.
  const firstDow = isoWeekday(days[0]);
  const totalCells = Math.ceil((days.length + firstDow) / 7) * 7;
  const cells: (string | null)[] = [
    ...Array(firstDow).fill(null),
    ...days,
    ...Array(totalCells - days.length - firstDow).fill(null),
  ];

  const [hovered, setHovered] = useState<string | null>(null);

  const today = iso(new Date());

  return (
    <div>
      <div className="text-xs font-medium text-(--vn-muted) mb-3">
        {formatMonthYear(periodStart)}
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[10px] text-(--vn-muted)">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date)
            return <div key={`empty-${i}`} className="aspect-square rounded-lg" />;

          const spend = spendByDay[date] ?? 0;
          const fraction = maxDay > 0 ? spend / maxDay : 0;
          const isToday = date === today;
          const isFuture = date > today;

          // Column-aware tooltip position so edge cells don't overflow off-screen
          const col = i % 7;
          const tooltipPos =
            col === 0
              ? "left-0"
              : col >= 5
              ? "right-0 left-auto"
              : "left-1/2 -translate-x-1/2";

          return (
            <div
              key={date}
              className={`relative aspect-square rounded-lg flex flex-col items-center justify-center cursor-default transition-all ${
                isToday ? "ring-1 ring-(--vn-primary)" : ""
              } ${isFuture ? "opacity-30" : ""}`}
              style={{
                background:
                  spend > 0
                    ? `rgba(220,38,38,${(0.08 + fraction * 0.72).toFixed(2)})`
                    : "var(--vn-border)",
              }}
              onMouseEnter={() => setHovered(date)}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={() => setHovered(date)}
              onTouchEnd={() => setTimeout(() => setHovered(null), 2000)}
              title={spend > 0 ? `${date}: ${formatMoney(spend)}` : date}
            >
              <span className="text-[9px] font-medium text-(--vn-text) leading-none">
                {formatDayNumber(date)}
              </span>

              {/* Hover / tap tooltip */}
              {hovered === date && spend > 0 && (
                <div
                  className={`absolute z-10 bottom-full mb-1 whitespace-nowrap rounded-xl bg-(--vn-surface) border border-(--vn-border) shadow-lg px-2 py-1 text-[10px] text-(--vn-text) pointer-events-none ${tooltipPos}`}
                >
                  {date}: {formatMoney(spend)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="text-[10px] text-(--vn-muted)">Low</span>
        {[0.1, 0.3, 0.55, 0.75, 0.95].map((f) => (
          <div
            key={f}
            className="w-3 h-3 rounded-sm"
            style={{ background: `rgba(220,38,38,${(0.08 + f * 0.72).toFixed(2)})` }}
          />
        ))}
        <span className="text-[10px] text-(--vn-muted)">High</span>
      </div>
    </div>
  );
}
