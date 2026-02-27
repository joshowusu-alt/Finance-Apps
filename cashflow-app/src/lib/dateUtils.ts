/**
 * Shared date utilities — DRY extraction of date helpers
 * used across aiContext, insightsSnapshot, alerts, page.tsx, etc.
 *
 * All functions are pure and side-effect-free.
 */

/** Parse "YYYY-MM-DD" to a UTC midnight timestamp (ms). */
export function toUtcDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

/** Whole-day difference between two ISO date strings. */
export function dayDiff(startISO: string, endISO: string): number {
  const ms = toUtcDay(endISO) - toUtcDay(startISO);
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Clamp a number between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Add `days` to an ISO date string, returning "YYYY-MM-DD". */
export function addDaysISO(iso: string, days: number): string {
  const date = new Date(toUtcDay(iso));
  date.setUTCDate(date.getUTCDate() + days);
  return fmtDateUTC(date);
}

/** Format a Date to "YYYY-MM-DD" in UTC. */
export function fmtDateUTC(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Today as "YYYY-MM-DD" in local time. */
export function todayISO(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Arithmetic mean of an array of numbers. Returns 0 for empty arrays. */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, v) => sum + v, 0);
  return total / values.length;
}

/** Population standard deviation. Returns 0 for ≤1 element. */
export function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = average(values);
  const variance =
    values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Default date range for Plaid transaction fetches:
 * last 90 days → today.
 */
export function defaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 90);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

/**
 * Human-readable "days until" label for a date string (local time).
 * Returns "Overdue", "Due today", "Due tomorrow", or "In N days".
 */
export function getDaysUntil(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `In ${diffDays} days`;
}
