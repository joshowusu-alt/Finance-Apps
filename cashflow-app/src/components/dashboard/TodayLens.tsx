"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/currency";
import { prettyDate } from "@/lib/formatUtils";
import { TODAY_LENS_COPY } from "@/lib/copy";
import type { TodayLensData } from "@/hooks/useTodayLens";

interface Props {
  data: TodayLensData;
}

export default function TodayLens({ data }: Props) {
  // Cold state — no plan data yet
  if (!data.hasData) {
    return (
      <div className="vn-card p-5" style={{ border: "1px solid var(--vn-border)" }}>
        <div
          className="text-xs uppercase tracking-widest font-semibold mb-1"
          style={{ color: "var(--vn-gold)" }}
        >
          Today
        </div>
        <p className="text-sm mb-4" style={{ color: "var(--vn-muted)" }}>
          Here&apos;s where you stand this period.
        </p>
        <Link href="/plan" className="vn-btn vn-btn-primary text-xs px-4 py-2">
          Set up your plan to get started
        </Link>
      </div>
    );
  }

  const { tier, projectedEndBalance, tightestDay, weeklyTargetReduction } = data;
  const copy = TODAY_LENS_COPY[tier] ?? TODAY_LENS_COPY["Stable"];
  const isSafe = tier === "Secure" || tier === "Stable";

  const predictive = copy.predictive
    .replace("{amount}", formatMoney(Math.abs(Math.round(projectedEndBalance))))
    .replace("{date}", prettyDate(tightestDay.date));

  // Only show action sentence when there is a meaningful numeric target
  const showAction = weeklyTargetReduction > 10;
  const action = copy.action.replace("{amount}", formatMoney(weeklyTargetReduction));

  return (
    <div className="vn-card p-5" style={{ border: "1px solid var(--vn-border)" }}>
      {/* Label */}
      <div
        className="text-xs uppercase tracking-widest font-semibold mb-1"
        style={{ color: "var(--vn-gold)" }}
      >
        Today
      </div>

      {/* Subline */}
      <p className="text-sm mb-3" style={{ color: "var(--vn-muted)" }}>
        Here&apos;s where you stand this period.
      </p>

      {/* Predictive sentence */}
      <p
        className="text-sm font-medium leading-snug mb-2"
        style={{ color: "var(--vn-text)" }}
      >
        {predictive}
      </p>

      {/* Action sentence */}
      {showAction && (
        <p className="text-sm mb-2" style={{ color: "var(--vn-text)" }}>
          {action}
        </p>
      )}

      {/* Reassurance line — Secure / Stable tiers only */}
      {isSafe && (
        <p className="text-xs mb-3" style={{ color: "var(--vn-status-secure)" }}>
          You&apos;re on track — keep going.
        </p>
      )}

      {/* CTAs */}
      <div
        className="flex flex-wrap gap-2 mt-3 pt-3"
        style={{ borderTop: "1px solid var(--vn-border)" }}
      >
        <a href="#what-if" className="vn-btn vn-btn-primary text-xs px-4 py-2">
          See what to adjust
        </a>
        <Link href="/coach" className="vn-btn vn-btn-ghost text-xs px-4 py-2">
          Ask Coach
        </Link>
      </div>
    </div>
  );
}
