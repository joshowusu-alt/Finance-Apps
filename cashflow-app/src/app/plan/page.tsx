"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getUpcomingEvents } from "@/lib/cashflowEngine";
import { formatMoney } from "@/lib/currency";
import SidebarNav from "@/components/SidebarNav";
import { useDerived } from "@/lib/useDerived";
import { prettyDate, prettyDateWithYear } from "@/lib/formatUtils";



function cadenceLabel(cadence: string) {
  if (cadence === "weekly") return "Weekly";
  if (cadence === "biweekly") return "Bi-weekly";
  return "Monthly";
}

function monthlyEquivalent(amount: number, cadence: string) {
  if (cadence === "weekly") return amount * 4;
  if (cadence === "biweekly") return amount * 2;
  return amount;
}

export default function PlanPage() {
  const { state: plan, derived } = useDerived();
  const [planMode, setPlanMode] = useState<"manual" | "adaptive">("manual");

  const period = derived.period;
  const periodId = period.id;
  const upcomingOutflows = useMemo(() => getUpcomingEvents(plan, periodId, "outflow").slice(0, 3), [plan, periodId]);

  // Derived totals
  const totalIncome = derived.totals.incomeExpected;
  const totalBills = derived.totals.committedBills;
  const totalAllocations = derived.totals.allocationsTotal;
  const remaining = derived.totals.remaining;

  // Allocation breakdown from outflow rules
  const allocations = useMemo(() => {
    const groups: Record<string, number> = { allowance: 0, savings: 0, giving: 0, buffer: 0, other: 0 };
    plan.outflowRules.filter((r) => r.enabled).forEach((r) => {
      const key = r.category in groups ? r.category : "other";
      groups[key] += monthlyEquivalent(r.amount, r.cadence);
    });
    return groups;
  }, [plan.outflowRules]);

  // Risk assessment
  const lowestBalance = derived.cashflow.lowest.balance;
  const expectedMin = plan.setup.expectedMinBalance;
  const expectedMinIsSet = expectedMin > 0;
  const periodStartYear = period.start.slice(0, 4);
  const periodEndYear = period.end.slice(0, 4);
  const periodRange = `${periodStartYear === periodEndYear ? prettyDate(period.start) : prettyDateWithYear(period.start)} - ${prettyDateWithYear(period.end)}`;
  const periodHeader = `P${period.id}: ${periodRange}`;
  const risk = derived.health.label;
  const riskConfig = {
    Healthy: { label: "Healthy", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" },
    Watch: { label: "Watch", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" },
    "At Risk": { label: "At Risk", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800" },
  }[risk];

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-6">
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

          <section className="space-y-5">

            {/* A) Period Header */}
            <div className="vn-card p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-[var(--vn-text)]">Plan</h1>
                  <div className="mt-1 text-sm text-[var(--vn-muted)] break-words">{periodHeader}</div>
                </div>
                <Link href="/settings" className="vn-btn vn-btn-ghost text-xs self-end sm:self-auto">
                  Edit period dates
                </Link>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setPlanMode("manual")}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all border ${planMode === "manual"
                    ? "border-[var(--vn-primary)] bg-[var(--vn-primary)]/10 text-[var(--vn-primary)]"
                    : "border-[var(--vn-border)] text-[var(--vn-muted)] hover:border-[var(--vn-primary)]/40"
                    }`}
                >
                  Manual Planning
                </button>
                <button
                  onClick={() => setPlanMode("adaptive")}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all border ${planMode === "adaptive"
                    ? "border-[var(--vn-primary)] bg-[var(--vn-primary)]/10 text-[var(--vn-primary)]"
                    : "border-[var(--vn-border)] text-[var(--vn-muted)] hover:border-[var(--vn-primary)]/40"
                    }`}
                >
                  Adaptive Rollover
                </button>
              </div>
              {planMode === "adaptive" && (
                <div className="mt-2 text-xs text-[var(--vn-muted)]">
                  Adaptive mode will use last period&apos;s actuals to prefill the next period. Coming soon.
                </div>
              )}
            </div>

            {/* B) Income Card */}
            <div className="vn-card p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-[var(--vn-text)]">Plan Income</div>
                  <div className="text-xs text-[var(--vn-muted)]">Expected income this period</div>
                </div>
                <Link href="/income" className="vn-btn vn-btn-ghost text-xs self-end sm:self-auto">
                  Edit income
                </Link>
              </div>
              <div className="text-2xl font-bold text-[var(--vn-success)] mb-4">{formatMoney(totalIncome)}</div>

              {plan.incomeRules.filter((r) => r.enabled).length === 0 ? (
                <div className="text-sm text-[var(--vn-muted)]">No income rules set up yet.</div>
              ) : (
                <div className="space-y-2">
                  {plan.incomeRules.filter((r) => r.enabled).map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-[var(--vn-bg)]">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--vn-text)] truncate">{rule.label}</div>
                        <div className="text-xs text-[var(--vn-muted)]">{cadenceLabel(rule.cadence)}</div>
                      </div>
                      <div className="text-sm font-semibold text-[var(--vn-text)] shrink-0">{formatMoney(rule.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* C) Bills Card */}
            <div className="vn-card p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-[var(--vn-text)]">Committed Bills</div>
                  <div className="text-xs text-[var(--vn-muted)]">Fixed obligations this period</div>
                </div>
                <Link href="/bills" className="vn-btn vn-btn-ghost text-xs self-end sm:self-auto">
                  Edit bills
                </Link>
              </div>
              <div className="text-2xl font-bold text-[var(--vn-text)] mb-4">{formatMoney(totalBills)}</div>

              {upcomingOutflows.length === 0 ? (
                <div className="text-sm text-[var(--vn-muted)]">No upcoming bills.</div>
              ) : (
                <div className="space-y-2">
                  {upcomingOutflows.map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-[var(--vn-bg)]">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--vn-text)] truncate">{bill.label}</div>
                        <div className="text-xs text-[var(--vn-muted)]">Due {prettyDate(bill.date)}</div>
                      </div>
                      <div className="text-sm font-semibold text-[var(--vn-text)] shrink-0">{formatMoney(bill.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* D) Allocations Card */}
            <div className="vn-card p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-[var(--vn-text)]">Allocations</div>
                  <div className="text-xs text-[var(--vn-muted)]">Flexible and protected spending (monthly)</div>
                </div>
                <Link href="/bills" className="vn-btn vn-btn-ghost text-xs self-end sm:self-auto">
                  Edit allocations
                </Link>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Weekly Allowance", value: allocations.allowance },
                  { label: "Savings", value: allocations.savings },
                  { label: "Giving", value: allocations.giving },
                  { label: "Buffer Top-up", value: allocations.buffer },
                  { label: "Other Outflows", value: allocations.other },
                ].filter((row) => row.value > 0).map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-[var(--vn-bg)]">
                    <div className="text-sm font-medium text-[var(--vn-text)] min-w-0 truncate">{row.label}</div>
                    <div className="text-sm font-semibold text-[var(--vn-text)] shrink-0">{formatMoney(row.value)}</div>
                  </div>
                ))}
                <div className="flex items-start justify-between gap-3 rounded-xl px-4 py-3 bg-[var(--vn-bg)] border border-[var(--vn-border)]">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--vn-muted)]">Expected Min Balance</div>
                    {!expectedMinIsSet && (
                      <div className="text-xs text-[var(--vn-muted)]">Set a minimum to flag risky days</div>
                    )}
                  </div>
                  <div className={`text-sm font-semibold shrink-0 ${expectedMinIsSet ? "text-[var(--vn-text)]" : "text-[var(--vn-muted)]"}`}>
                    {expectedMinIsSet ? formatMoney(expectedMin) : "Not set"}
                  </div>
                </div>
              </div>
              {Object.values(allocations).every((v) => v === 0) && (
                <div className="mt-2 text-sm text-[var(--vn-muted)]">No allocations set up yet. Add outflow rules to see them here.</div>
              )}
            </div>

            {/* E) Budgeted Outflow Total */}
            <div className="vn-card p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-[var(--vn-text)]">Total Budgeted Outflow</div>
                  <div className="text-xs text-[var(--vn-muted)]">Bills + allocations this period</div>
                </div>
                <Link href="/bills" className="vn-btn vn-btn-ghost text-xs self-end sm:self-auto">
                  View details
                </Link>
              </div>
              <div className="text-2xl font-bold text-[var(--vn-text)] mb-4">{formatMoney(totalBills + totalAllocations)}</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-[var(--vn-bg)]">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--vn-text)]">Committed Bills</div>
                    <div className="text-xs text-[var(--vn-muted)]">{plan.bills.filter((b) => b.enabled).length} bill{plan.bills.filter((b) => b.enabled).length === 1 ? '' : 's'}</div>
                  </div>
                  <div className="text-sm font-semibold text-[var(--vn-text)] shrink-0">{formatMoney(totalBills)}</div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-[var(--vn-bg)]">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--vn-text)]">Other Allocations</div>
                    <div className="text-xs text-[var(--vn-muted)]">{plan.outflowRules.filter((r) => r.enabled).length} rule{plan.outflowRules.filter((r) => r.enabled).length === 1 ? '' : 's'}</div>
                  </div>
                  <div className="text-sm font-semibold text-[var(--vn-text)] shrink-0">{formatMoney(totalAllocations)}</div>
                </div>
              </div>
            </div>

            {/* F) Period Outlook */}
            <div className={`vn-card p-6 border ${riskConfig.bg}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-[var(--vn-text)]">Period Outlook</div>
                  <div className="text-xs text-[var(--vn-muted)]">Where you&apos;ll land this period</div>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full self-end sm:self-auto ${riskConfig.color} ${riskConfig.bg}`}>
                  {riskConfig.label}
                </span>
              </div>
              <div className="text-xs text-[var(--vn-muted)] -mt-1">{derived.health.reason}</div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--vn-muted)]">Expected income</span>
                  <span className="font-semibold text-[var(--vn-success)]">+{formatMoney(totalIncome)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--vn-muted)]">Committed bills</span>
                  <span className="font-semibold text-[var(--vn-text)]">-{formatMoney(totalBills)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--vn-muted)]">Allocations</span>
                  <span className="font-semibold text-[var(--vn-text)]">-{formatMoney(totalAllocations)}</span>
                </div>
                <div className="h-px bg-[var(--vn-border)]" />
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-[var(--vn-muted)]">Total budgeted outflow</span>
                  <span className="text-[var(--vn-text)]">-{formatMoney(totalBills + totalAllocations)}</span>
                </div>
                <div className="h-px bg-[var(--vn-border)]" />
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-[var(--vn-text)]">Remaining / Unallocated</span>
                  <span className={`font-bold ${remaining >= 0 ? "text-[var(--vn-success)]" : "text-red-500"}`}>
                    {formatMoney(remaining)}
                  </span>
                </div>
                <div className="h-px bg-[var(--vn-border)]" />
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--vn-muted)]">Projected lowest balance</span>
                  <span className={`font-semibold ${lowestBalance >= expectedMin ? "text-[var(--vn-text)]" : "text-red-500"}`}>
                    {formatMoney(lowestBalance)}
                    <span className="text-xs text-[var(--vn-muted)] ml-1">({prettyDate(derived.cashflow.lowest.date)})</span>
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--vn-muted)]">Expected minimum</span>
                  <span className={`font-semibold ${expectedMinIsSet ? "text-[var(--vn-text)]" : "text-[var(--vn-muted)]"}`}>
                    {expectedMinIsSet ? formatMoney(expectedMin) : "Not set"}
                  </span>
                </div>
              </div>
            </div>

          </section>
        </div>
      </div>
    </main>
  );
}
