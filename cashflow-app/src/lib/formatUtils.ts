import { formatMoney } from "@/lib/currency";

/**
 * Shared date and number formatting utilities.
 * Used across pages for displaying dates, timestamps, and variances.
 */

/** Format an ISO date string as "DD Mon" (e.g. "14 Feb") */
export function prettyDate(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Format an ISO date string as "DD Mon YYYY" (e.g. "14 Feb 2025") */
export function prettyDateWithYear(iso: string): string {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Format an ISO timestamp as a human-readable "last updated" string */
export function formatUpdatedAt(value: string): string {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/** Format a numeric variance with sign and color tone */
export function formatVariance(
    value: number,
    isPositiveGood: boolean
): { label: string; tone: string } {
    if (value === 0) {
        return { label: "0", tone: "text-slate-500 dark:text-slate-400" };
    }
    const sign = value > 0 ? "+" : "-";
    const abs = Math.abs(value);
    const tone =
        value > 0
            ? isPositiveGood
                ? "text-green-600"
                : "text-rose-600"
            : isPositiveGood
                ? "text-rose-600"
                : "text-green-600";
    return { label: `${sign}${formatMoney(abs)}`, tone };
}

/** Format a 0-1 fraction as a percentage string (e.g. 0.75 → "75%") */
export function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}
