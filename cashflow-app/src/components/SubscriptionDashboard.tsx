"use client";

import { useMemo } from "react";
import { detectSubscriptions, type DetectedSubscription } from "@/lib/subscriptionDetection";
import type { Transaction } from "@/data/plan";

type Props = {
  transactions: Transaction[];
  asOfDate?: string;
  className?: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value || 0);
}

function formatFrequency(frequency: string) {
  const labels: Record<string, string> = {
    monthly: "Monthly",
    biweekly: "Every 2 weeks",
    weekly: "Weekly",
  };
  return labels[frequency] || frequency;
}

function getRecommendationTone(recommendation: DetectedSubscription["recommendation"]) {
  if (recommendation === "keep") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (recommendation === "cancel") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export default function SubscriptionDashboard({ transactions, asOfDate, className = "" }: Props) {
  const subscriptions = useMemo(
    () => detectSubscriptions(transactions, { asOfDate }),
    [asOfDate, transactions]
  );

  const totalMonthly = subscriptions.reduce((sum, s) => sum + s.monthlyCost, 0);
  const totalAnnual = subscriptions.reduce((sum, s) => sum + s.annualCost, 0);
  const topSubscription = subscriptions[0];

  return (
    <section className={`vn-card p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Subscription Detection
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Subscriptions dashboard</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            You&apos;re paying {formatMoney(totalMonthly)}/month in subscriptions.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Annual projection</div>
          <div className="mt-1 text-xl font-semibold text-slate-900">{formatMoney(totalAnnual)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Active subscriptions</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{subscriptions.length}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Detected from recurring charges</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Monthly cost</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totalMonthly)}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {formatMoney(totalMonthly / 4.33)} per week average
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Top subscription</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {topSubscription ? topSubscription.merchantName : "None yet"}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {topSubscription ? formatMoney(topSubscription.monthlyCost) + "/month" : "Detect recurring payments"}
          </div>
        </div>
      </div>

      {subscriptions.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-500">
          No subscriptions detected yet. Add more transactions or sync your bank to surface recurring charges.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr_1fr] gap-3 text-[11px] uppercase tracking-wide text-slate-400 md:grid">
            <div>Subscription</div>
            <div className="text-right">Avg charge</div>
            <div className="text-right">Monthly</div>
            <div className="text-right">Annual</div>
            <div className="text-right">Recommendation</div>
          </div>
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="grid gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900">{sub.merchantName}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {formatFrequency(sub.frequency)} | Last charge {sub.lastChargeDate || "N/A"}
                </div>
              </div>
              <div className="text-sm text-slate-700 md:text-right">
                <span className="text-[11px] uppercase tracking-wide text-slate-400 md:hidden">Avg charge</span>
                <div>{formatMoney(sub.averageAmount)}</div>
              </div>
              <div className="text-sm font-semibold text-slate-900 md:text-right">
                <span className="text-[11px] uppercase tracking-wide text-slate-400 md:hidden">Monthly</span>
                <div>{formatMoney(sub.monthlyCost)}</div>
              </div>
              <div className="text-sm text-slate-700 md:text-right">
                <span className="text-[11px] uppercase tracking-wide text-slate-400 md:hidden">Annual</span>
                <div>{formatMoney(sub.annualCost)}</div>
              </div>
              <div className="md:text-right">
                <span className="text-[11px] uppercase tracking-wide text-slate-400 md:hidden">Recommendation</span>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold capitalize ${getRecommendationTone(
                    sub.recommendation
                  )}`}
                >
                  {sub.recommendation}
                </span>
                <div className="mt-1 text-[11px] text-slate-500">{sub.recommendationReason}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
