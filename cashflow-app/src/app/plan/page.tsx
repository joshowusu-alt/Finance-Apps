"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getUpcomingEvents } from "@/lib/cashflowEngine";
import { formatMoney } from "@/lib/currency";
import SidebarNav from "@/components/SidebarNav";
import { useDerived } from "@/lib/useDerived";
import { prettyDate, prettyDateWithYear } from "@/lib/formatUtils";
import { savePlan, loadPlan, PLAN_UPDATED_EVENT } from "@/lib/storage";
import type { PeriodRuleOverride } from "@/data/plan";



function cadenceLabel(cadence: string) {
  if (cadence === "weekly") return "Weekly";
  if (cadence === "biweekly") return "Bi-weekly";
  if (cadence === "quarterly") return "Quarterly";
  if (cadence === "annual") return "Annual";
  return "Monthly";
}

function monthlyEquivalent(amount: number, cadence: string) {
  if (cadence === "weekly") return amount * 4;
  if (cadence === "biweekly") return amount * 2;
  if (cadence === "quarterly") return amount / 3;
  if (cadence === "annual") return amount / 12;
  return amount;
}

export default function PlanPage() {
  const { state: plan, derived } = useDerived();
  const [planMode, setPlanMode] = useState<"manual" | "adaptive">("manual");
  const [applyStatus, setApplyStatus] = useState<"idle" | "applied" | "error">("idle");

  const period = derived.period;
  const periodId = period.id;
  const upcomingOutflows = useMemo(() => getUpcomingEvents(plan, periodId, "outflow").slice(0, 3), [plan, periodId]);

  // Derived totals
  const totalIncome = derived.totals.incomeExpected;
  const totalBills = derived.totals.committedBills;
  const totalAllocations = derived.totals.allocationsTotal;
  const remaining = derived.totals.remaining;

  // ── Adaptive Rollover ─────────────────────────────────────────────────────
  const prevPeriod = useMemo(() => {
    const sorted = [...plan.periods].sort((a, b) => a.id - b.id);
    const idx = sorted.findIndex((p) => p.id === periodId);
    return idx > 0 ? sorted[idx - 1] : null;
  }, [plan.periods, periodId]);

  const prevActuals = useMemo(() => {
    if (!prevPeriod) return null;
    const txns = plan.transactions.filter(
      (t) => t.date >= prevPeriod.start && t.date <= prevPeriod.end
    );

    const incomeByRule: Record<string, number> = {};
    const outflowByRule: Record<string, number> = {};
    const billById: Record<string, number> = {};
    let unbudgeted = 0;

    for (const t of txns) {
      if (t.type === "income") {
        if (t.linkedRuleId) incomeByRule[t.linkedRuleId] = (incomeByRule[t.linkedRuleId] ?? 0) + t.amount;
      } else if (t.type === "outflow" && t.category !== "savings") {
        if (t.linkedBillId) billById[t.linkedBillId] = (billById[t.linkedBillId] ?? 0) + t.amount;
        else if (t.linkedRuleId) outflowByRule[t.linkedRuleId] = (outflowByRule[t.linkedRuleId] ?? 0) + t.amount;
        else unbudgeted += t.amount;
      }
    }

    return { incomeByRule, outflowByRule, billById, unbudgeted };
  }, [prevPeriod, plan.transactions]);

  // Suggestions: rules where last-period actual differs from current budget
  const adaptiveSuggestions = useMemo(() => {
    if (!prevActuals) return null;

    const income = plan.incomeRules
      .filter((r) => r.enabled)
      .map((r) => ({
        ruleId: r.id,
        label: r.label,
        type: "income" as const,
        budget: r.amount,
        actual: prevActuals.incomeByRule[r.id] ?? 0,
      }))
      .filter((s) => s.actual > 0);

    const outflow = plan.outflowRules
      .filter((r) => r.enabled)
      .map((r) => ({
        ruleId: r.id,
        label: r.label,
        type: "outflow" as const,
        budget: r.amount,
        actual: prevActuals.outflowByRule[r.id] ?? 0,
      }))
      .filter((s) => s.actual > 0);

    const bills = plan.bills
      .filter((b) => b.enabled)
      .map((b) => ({
        ruleId: b.id,
        label: b.label,
        type: "bill" as const,
        budget: b.amount,
        actual: prevActuals.billById[b.id] ?? 0,
      }))
      .filter((s) => s.actual > 0);

    return { income, outflow, bills, unbudgeted: prevActuals.unbudgeted };
  }, [prevActuals, plan.incomeRules, plan.outflowRules, plan.bills]);

  function handleApplyAdaptive() {
    if (!adaptiveSuggestions) return;
    const current = loadPlan();
    const overrides: PeriodRuleOverride[] = [
      // Remove existing overrides for current period on income/outflow
      ...current.periodRuleOverrides.filter(
        (o) => o.periodId !== periodId || o.type === "income" && !adaptiveSuggestions.income.find((s) => s.ruleId === o.ruleId) || o.type === "outflow" && !adaptiveSuggestions.outflow.find((s) => s.ruleId === o.ruleId)
      ),
      // Add income overrides
      ...adaptiveSuggestions.income.map((s): PeriodRuleOverride => ({
        periodId,
        ruleId: s.ruleId,
        type: "income",
        amount: s.actual,
      })),
      // Add outflow overrides
      ...adaptiveSuggestions.outflow.map((s): PeriodRuleOverride => ({
        periodId,
        ruleId: s.ruleId,
        type: "outflow",
        amount: s.actual,
      })),
    ];

    const updated = { ...current, periodRuleOverrides: overrides };
    savePlan(updated);
    window.dispatchEvent(new Event(PLAN_UPDATED_EVENT));
    setApplyStatus("applied");
    setTimeout(() => setApplyStatus("idle"), 3000);
  }

  // ── Allocation breakdown from outflow rules ─────────────────────────────
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
    <main className="min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-40 pt-5">
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

          <section className="space-y-5">

            {/* A) Period Header */}
            <div className="vn-masthead">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-widest font-semibold text-white/50 mb-1">Budget</div>
                  <h1 className="text-2xl font-bold text-white/90" style={{ fontFamily: "var(--font-playfair, serif)" }}>Plan</h1>
                  <div className="mt-1 text-sm text-white/55 break-words">{periodHeader}</div>
                </div>
                <Link href="/settings" className="text-xs font-semibold px-3 py-1.5 rounded-lg self-end sm:self-auto transition-colors" style={{ color: "rgba(240,237,232,0.65)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  Edit period dates
                </Link>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setPlanMode("manual")}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all border ${planMode === "manual"
                    ? "border-(--vn-primary) bg-(--vn-primary)/10 text-(--vn-primary)"
                    : "border-(--vn-border) text-(--vn-muted) hover:border-(--vn-primary)/40"
                    }`}
                >
                  Manual Planning
                </button>
                <button
                  onClick={() => setPlanMode("adaptive")}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all border ${planMode === "adaptive"
                    ? "border-(--vn-primary) bg-(--vn-primary)/10 text-(--vn-primary)"
                    : "border-(--vn-border) text-(--vn-muted) hover:border-(--vn-primary)/40"
                    }`}
                >
                  Adaptive Rollover
                </button>
              </div>
              {planMode === "adaptive" && (
                <div className="mt-3">
                  {!prevPeriod ? (
                    <div className="rounded-xl border border-(--vn-border) bg-(--vn-bg) px-4 py-4 text-sm text-(--vn-muted)">
                      No previous period found. Complete your first period to unlock Adaptive Rollover.
                    </div>
                  ) : !adaptiveSuggestions || (adaptiveSuggestions.income.length === 0 && adaptiveSuggestions.outflow.length === 0 && adaptiveSuggestions.bills.length === 0) ? (
                    <div className="rounded-xl border border-(--vn-border) bg-(--vn-bg) px-4 py-4 text-sm text-(--vn-muted)">
                      No transactions recorded in {prevPeriod.label} yet. Add transactions to see adaptive suggestions.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xs text-(--vn-muted)">
                        Showing actuals from <span className="font-semibold text-(--vn-text)">{prevPeriod.label}</span>.
                        Applying will override rule amounts for <span className="font-semibold text-(--vn-text)">{period.label}</span> only — global rules stay unchanged.
                      </div>

                      {/* Income rows */}
                      {adaptiveSuggestions.income.length > 0 && (
                        <div className="rounded-xl border border-(--vn-border) bg-(--vn-bg) overflow-hidden">
                          <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-(--vn-muted) border-b border-(--vn-border)">Income</div>
                          {adaptiveSuggestions.income.map((s) => {
                            const delta = s.actual - s.budget;
                            return (
                              <div key={s.ruleId} className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-(--vn-border) last:border-0">
                                <span className="text-sm font-medium text-(--vn-text) min-w-0 truncate">{s.label}</span>
                                <div className="flex items-center gap-3 shrink-0 text-xs">
                                  <span className="text-(--vn-muted)">Budget {formatMoney(s.budget)}</span>
                                  <span className="font-semibold text-(--vn-text)">Actual {formatMoney(s.actual)}</span>
                                  {delta !== 0 && (
                                    <span className={`font-semibold ${delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
                                      {delta > 0 ? "+" : ""}{formatMoney(delta)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Outflow rule rows */}
                      {adaptiveSuggestions.outflow.length > 0 && (
                        <div className="rounded-xl border border-(--vn-border) bg-(--vn-bg) overflow-hidden">
                          <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-(--vn-muted) border-b border-(--vn-border)">Recurring Outflows</div>
                          {adaptiveSuggestions.outflow.map((s) => {
                            const delta = s.actual - s.budget;
                            return (
                              <div key={s.ruleId} className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-(--vn-border) last:border-0">
                                <span className="text-sm font-medium text-(--vn-text) min-w-0 truncate">{s.label}</span>
                                <div className="flex items-center gap-3 shrink-0 text-xs">
                                  <span className="text-(--vn-muted)">Budget {formatMoney(s.budget)}</span>
                                  <span className="font-semibold text-(--vn-text)">Actual {formatMoney(s.actual)}</span>
                                  {delta !== 0 && (
                                    <span className={`font-semibold ${delta <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
                                      {delta > 0 ? "+" : ""}{formatMoney(delta)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Bills rows (read-only, can't override amount) */}
                      {adaptiveSuggestions.bills.length > 0 && (
                        <div className="rounded-xl border border-(--vn-border) bg-(--vn-bg) overflow-hidden">
                          <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-(--vn-muted) border-b border-(--vn-border) flex items-center justify-between">
                            <span>Committed Bills</span>
                            <span className="text-[9px] normal-case font-normal">(amounts fixed)</span>
                          </div>
                          {adaptiveSuggestions.bills.map((s) => {
                            const delta = s.actual - s.budget;
                            return (
                              <div key={s.ruleId} className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-(--vn-border) last:border-0">
                                <span className="text-sm font-medium text-(--vn-text) min-w-0 truncate">{s.label}</span>
                                <div className="flex items-center gap-3 shrink-0 text-xs">
                                  <span className="text-(--vn-muted)">Budget {formatMoney(s.budget)}</span>
                                  <span className="font-semibold text-(--vn-text)">Actual {formatMoney(s.actual)}</span>
                                  {delta !== 0 && (
                                    <span className={`font-semibold ${delta <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
                                      {delta > 0 ? "+" : ""}{formatMoney(delta)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Unbudgeted callout */}
                      {adaptiveSuggestions.unbudgeted > 0 && (
                        <div className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                          <span className="text-amber-600 dark:text-amber-400">⚠</span>
                          <div className="text-xs text-amber-700 dark:text-amber-300">
                            <span className="font-semibold">{formatMoney(adaptiveSuggestions.unbudgeted)}</span> unbudgeted in {prevPeriod.label} — consider assigning these to a rule.
                          </div>
                        </div>
                      )}

                      {/* Apply button */}
                      {(adaptiveSuggestions.income.length > 0 || adaptiveSuggestions.outflow.length > 0) && (
                        <button
                          onClick={handleApplyAdaptive}
                          className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all border ${
                            applyStatus === "applied"
                              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                              : "border-(--vn-primary) bg-(--vn-primary)/10 text-(--vn-primary) hover:bg-(--vn-primary)/20"
                          }`}
                        >
                          {applyStatus === "applied" ? "✓ Applied to this period" : `Apply ${prevPeriod.label} actuals to ${period.label}`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* B) Income Card */}
            <div className="vn-card p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-(--vn-text)">Plan Income</div>
                  <div className="text-xs text-(--vn-muted)">Expected income this period</div>
                </div>
                <Link href="/income" className="vn-btn vn-btn-ghost text-xs self-end sm:self-auto">
                  Edit income
                </Link>
              </div>
              <div className="text-2xl font-bold text-(--vn-success) mb-4">{formatMoney(totalIncome)}</div>

              {plan.incomeRules.filter((r) => r.enabled).length === 0 ? (
                <div className="text-sm text-(--vn-muted)">No income rules set up yet.</div>
              ) : (
                <div className="space-y-2">
                  {plan.incomeRules.filter((r) => r.enabled).map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-(--vn-bg)">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-(--vn-text) truncate">{rule.label}</div>
                        <div className="text-xs text-(--vn-muted)">{cadenceLabel(rule.cadence)}</div>
                      </div>
                      <div className="text-sm font-semibold text-(--vn-text) shrink-0">{formatMoney(rule.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* C) Bills Card */}
            <div className="vn-card p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-(--vn-text)">Committed Bills</div>
                  <div className="text-xs text-(--vn-muted)">Fixed obligations this period</div>
                </div>
                <Link href="/bills" className="vn-btn vn-btn-ghost text-xs self-end sm:self-auto">
                  Edit bills
                </Link>
              </div>
              <div className="text-2xl font-bold text-(--vn-text) mb-4">{formatMoney(totalBills)}</div>

              {upcomingOutflows.length === 0 ? (
                <div className="text-sm text-(--vn-muted)">No upcoming bills.</div>
              ) : (
                <div className="space-y-2">
                  {upcomingOutflows.map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-(--vn-bg)">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-(--vn-text) truncate">{bill.label}</div>
                        <div className="text-xs text-(--vn-muted)">Due {prettyDate(bill.date)}</div>
                      </div>
                      <div className="text-sm font-semibold text-(--vn-text) shrink-0">{formatMoney(bill.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* D) Allocations Card */}
            <div className="vn-card p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-(--vn-text)">Recurring Outflows</div>
                  <div className="text-xs text-(--vn-muted)">Flexible and protected spending (monthly)</div>
                </div>
                <Link href="/bills" className="vn-btn vn-btn-ghost text-xs self-end sm:self-auto">
                  Edit allocations
                </Link>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Allowance", value: allocations.allowance },
                  { label: "Savings", value: allocations.savings },
                  { label: "Giving", value: allocations.giving },
                  { label: "Buffer", value: allocations.buffer },
                  { label: "Other", value: allocations.other },
                ].filter((row) => row.value > 0).map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-(--vn-bg)">
                    <div className="text-sm font-medium text-(--vn-text) min-w-0 truncate">{row.label}</div>
                    <div className="text-sm font-semibold text-(--vn-text) shrink-0">{formatMoney(row.value)}</div>
                  </div>
                ))}
                <div className="flex items-start justify-between gap-3 rounded-xl px-4 py-3 bg-(--vn-bg) border border-(--vn-border)">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-(--vn-muted)">Expected Min Balance</div>
                    {!expectedMinIsSet && (
                      <div className="text-xs text-(--vn-muted)">Set a minimum to flag risky days</div>
                    )}
                  </div>
                  <div className={`text-sm font-semibold shrink-0 ${expectedMinIsSet ? "text-(--vn-text)" : "text-(--vn-muted)"}`}>
                    {expectedMinIsSet ? formatMoney(expectedMin) : "Not set"}
                  </div>
                </div>
              </div>
              {Object.values(allocations).every((v) => v === 0) && (
                <div className="mt-2 text-sm text-(--vn-muted)">No allocations set up yet. Add outflow rules to see them here.</div>
              )}
            </div>

            {/* E) Budgeted Outflow Total */}
            <div className="vn-card p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-(--vn-text)">Total Budgeted Outflows</div>
                  <div className="text-xs text-(--vn-muted)">Committed bills + recurring outflows this period</div>
                </div>
                <Link href="/bills" className="vn-btn vn-btn-ghost text-xs self-end sm:self-auto">
                  View details
                </Link>
              </div>
              <div className="text-2xl font-bold text-(--vn-text) mb-4">{formatMoney(totalBills + totalAllocations)}</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-(--vn-bg)">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-(--vn-text)">Committed Bills</div>
                    <div className="text-xs text-(--vn-muted)">{plan.bills.filter((b) => b.enabled).length} bill{plan.bills.filter((b) => b.enabled).length === 1 ? '' : 's'}</div>
                  </div>
                  <div className="text-sm font-semibold text-(--vn-text) shrink-0">{formatMoney(totalBills)}</div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-(--vn-bg)">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-(--vn-text)">Recurring Outflows</div>
                    <div className="text-xs text-(--vn-muted)">{plan.outflowRules.filter((r) => r.enabled).length} rule{plan.outflowRules.filter((r) => r.enabled).length === 1 ? '' : 's'}</div>
                  </div>
                  <div className="text-sm font-semibold text-(--vn-text) shrink-0">{formatMoney(totalAllocations)}</div>
                </div>
              </div>
            </div>

            {/* F) Period Outlook */}
            <div className={`vn-card p-6 border ${riskConfig.bg}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-(--vn-text)">Period Outlook</div>
                  <div className="text-xs text-(--vn-muted)">Where you&apos;ll land this period</div>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full self-end sm:self-auto ${riskConfig.color} ${riskConfig.bg}`}>
                  {riskConfig.label}
                </span>
              </div>
              <div className="text-xs text-(--vn-muted) -mt-1">{derived.health.reason}</div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-(--vn-muted)">Expected income</span>
                  <span className="font-semibold text-(--vn-success)">+{formatMoney(totalIncome)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-(--vn-muted)">Committed bills</span>
                  <span className="font-semibold text-(--vn-text)">-{formatMoney(totalBills)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-(--vn-muted)">Recurring outflows</span>
                  <span className="font-semibold text-(--vn-text)">-{formatMoney(totalAllocations)}</span>
                </div>
                <div className="h-px bg-(--vn-border)" />
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-(--vn-muted)">Total budgeted outflows</span>
                  <span className="text-(--vn-text)">-{formatMoney(totalBills + totalAllocations)}</span>
                </div>
                <div className="h-px bg-(--vn-border)" />
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-(--vn-text)">Remaining / Unallocated</span>
                  <span className={`font-bold ${remaining >= 0 ? "text-(--vn-success)" : "text-red-500"}`}>
                    {formatMoney(remaining)}
                  </span>
                </div>
                <div className="h-px bg-(--vn-border)" />
                <div className="flex justify-between text-sm">
                  <span className="text-(--vn-muted)">Projected lowest balance</span>
                  <span className={`font-semibold ${lowestBalance >= expectedMin ? "text-(--vn-text)" : "text-red-500"}`}>
                    {formatMoney(lowestBalance)}
                    <span className="text-xs text-(--vn-muted) ml-1">({prettyDate(derived.cashflow.lowest.date)})</span>
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-(--vn-muted)">Expected minimum</span>
                  <span className={`font-semibold ${expectedMinIsSet ? "text-(--vn-text)" : "text-(--vn-muted)"}`}>
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
