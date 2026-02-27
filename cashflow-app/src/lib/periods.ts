/**
 * Use the canonical Period type from @/data/plan (ISO string start/end).
 * The old Date-based Period type has been removed to prevent conversion confusion.
 */
import { type Period } from "@/data/plan";

// Internal helpers for date arithmetic used in buildPeriods2026.
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * @deprecated — use `plan.periods` directly, or call `generatePeriods()` from `@/data/plan`.
 * Hardcoded 2026 seed data with a fixed start of 2025-12-22. Do not use in new code.
 *
 * Your rule:
 * - Period 1 starts 22/12/2025 (special case because FM came early)
 * - Period 2 starts 26/01/2026
 * - After that: each period is 26th -> 25th
 */
export function buildPeriods2026(): Period[] {
  const periods: Period[] = [];

  // Period 1 (special)
  const p1Start = startOfDay(new Date("2025-12-22"));
  const p1End = startOfDay(new Date("2026-01-25"));
  periods.push({
    id: 1,
    start: toISO(p1Start),
    end: toISO(p1End),
    label: `${fmt(p1Start)} \u2013 ${fmt(p1End)}`,
  });

  // Periods 2..13 (26th -> 25th) covering 2026
  let curStart = startOfDay(new Date("2026-01-26"));
  for (let id = 2; id <= 13; id++) {
    // End is 25th of the next month relative to start
    const end = startOfDay(new Date(curStart));
    end.setMonth(end.getMonth() + 1);
    end.setDate(25);

    periods.push({
      id,
      start: toISO(curStart),
      end: toISO(end),
      label: `${fmt(curStart)} \u2013 ${fmt(end)}`,
    });

    // Next start is 26th of the same month as end
    const nextStart = startOfDay(new Date(end));
    nextStart.setDate(26);
    curStart = nextStart;
  }

  return periods;
}

/**
 * Find which period (if any) contains the given ISO date string (YYYY-MM-DD).
 * Uses lexicographic string comparison, which is correct for ISO dates.
 */
export function periodForDate(periods: Period[], isoDate: string): Period | null {
  for (const p of periods) {
    if (isoDate >= p.start && isoDate <= p.end) return p;
  }
  return null;
}
