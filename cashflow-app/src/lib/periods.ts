export type Period = {
  id: number;          // Period 1, 2, 3...
  start: Date;         // inclusive
  end: Date;           // inclusive
  label: string;       // "22 Dec 2025 – 25 Jan 2026"
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmt(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
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
    start: p1Start,
    end: p1End,
    label: `${fmt(p1Start)} – ${fmt(p1End)}`
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
      start: curStart,
      end,
      label: `${fmt(curStart)} – ${fmt(end)}`
    });

    // Next start is 26th of the same month as end
    const nextStart = startOfDay(new Date(end));
    nextStart.setDate(26);
    curStart = nextStart;
  }

  return periods;
}

export function periodForDate(periods: Period[], d: Date): Period | null {
  const x = startOfDay(d).getTime();
  for (const p of periods) {
    if (x >= p.start.getTime() && x <= p.end.getTime()) return p;
  }
  return null;
}
