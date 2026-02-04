"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getActiveScenarioUpdatedAt, loadPlan, PLAN_UPDATED_EVENT } from "@/lib/storage";
import { generateEvents, getPeriod, getUpcomingEvents } from "@/lib/cashflowEngine";
import SidebarNav from "@/components/SidebarNav";
import type { Transaction } from "@/data/plan";

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

function prettyDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatUpdatedAt(value: string) {
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

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function splitTokens(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function matchesTokens(hay: string, tokens: string[]) {
  const normalized = normalizeText(hay);
  if (!normalized) return false;
  const wordSet = new Set(splitTokens(normalized));
  for (const token of tokens) {
    if (!token) continue;
    if (token.length <= 2) {
      if (wordSet.has(token)) return true;
    } else if (normalized.includes(token)) {
      return true;
    }
  }
  return false;
}

const incomeStopWords = new Set(["income", "salary", "pay", "payment", "wage"]);

function matchRule(txn: Transaction, label: string, id: string) {
  const labelBase = label.replace(/income/gi, "").trim();
  const tokens = Array.from(
    new Set(
      [labelBase, id]
        .map((value) => splitTokens(value))
        .flat()
        .filter((token) => token.length >= 2 && !incomeStopWords.has(token))
    )
  );
  return matchesTokens(`${txn.label} ${txn.notes ?? ""}`, tokens);
}

function formatVariance(value: number, isPositiveGood: boolean) {
  if (value === 0) {
    return { label: "0", tone: "text-slate-500" };
  }
  const sign = value > 0 ? "+" : "-";
  const abs = Math.abs(value);
  const tone =
    value > 0
      ? isPositiveGood
        ? "text-emerald-600"
        : "text-rose-600"
      : isPositiveGood
        ? "text-rose-600"
        : "text-emerald-600";
  return { label: `${sign}${gbp(abs)}`, tone };
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export default function IncomePage() {
  const [plan, setPlan] = useState(() => loadPlan());
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    const refresh = () => {
      setPlan(loadPlan());
      setLastUpdated(getActiveScenarioUpdatedAt());
    };
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key.startsWith("cashflow_plan_v2") || event.key.startsWith("cashflow_scenarios_v1")) {
        refresh();
      }
    };
    window.addEventListener("focus", refresh);
    window.addEventListener(PLAN_UPDATED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(PLAN_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const period = useMemo(() => getPeriod(plan, plan.setup.selectedPeriodId), [plan]);
  const events = useMemo(() => generateEvents(plan, plan.setup.selectedPeriodId), [plan]);
  const upcoming = useMemo(
    () => getUpcomingEvents(plan, plan.setup.selectedPeriodId, "income").slice(0, 6),
    [plan]
  );

  const budgetedIncome = useMemo(
    () => events.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0),
    [events]
  );
  const actualIncome = useMemo(
    () =>
      plan.transactions
        .filter((t) => t.type === "income" && t.date >= period.start && t.date <= period.end)
        .reduce((sum, t) => sum + t.amount, 0),
    [plan, period]
  );

  const budgetVsActual = useMemo(() => {
    const periodTransactions = plan.transactions.filter(
      (t) => t.type === "income" && t.date >= period.start && t.date <= period.end
    );
    const incomeEvents = events.filter((e) => e.type === "income");
    const unlinked = periodTransactions.filter((t) => !t.linkedRuleId);

    return plan.incomeRules
      .filter((rule) => rule.enabled)
      .map((rule) => {
        const budgeted = incomeEvents
          .filter((e) => e.sourceId === rule.id)
          .reduce((sum, e) => sum + e.amount, 0);
        const linkedTransactions = periodTransactions.filter((t) => t.linkedRuleId === rule.id);
        const linkedActual = linkedTransactions
          .reduce((sum, t) => sum + t.amount, 0);
        const fallbackTransactions = unlinked
          .filter((t) => matchRule(t, rule.label, rule.id));
        const fallbackActual = fallbackTransactions
          .reduce((sum, t) => sum + t.amount, 0);
        const transactions = [...linkedTransactions, ...fallbackTransactions]
          .sort((a, b) => b.date.localeCompare(a.date));
        const actual = linkedActual + fallbackActual;
        return {
          id: rule.id,
          label: rule.label,
          budgeted,
          actual,
          variance: actual - budgeted,
          transactions,
        };
      });
  }, [events, period, plan]);

  const varianceListRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const varianceVirtualizer = useVirtualizer({
    count: budgetVsActual.length,
    getScrollElement: () => varianceListRef.current,
    estimateSize: () => 140,
    overscan: 6,
  });

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 pb-28 pt-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

          <section className="space-y-6">
            <header className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
              <div className="text-xs uppercase tracking-wide text-slate-500">Income</div>
              <h1 className="text-2xl font-semibold text-slate-900">Income sources</h1>
              <p className="mt-2 text-sm text-slate-500">
                Plan your pay and compare with real income.
              </p>
              {lastUpdated ? (
                <div className="mt-1 text-[11px] text-slate-400">
                  Last updated {formatUpdatedAt(lastUpdated)}
                </div>
              ) : null}
            </header>

            <div className="grid gap-6 md:grid-cols-3">
              <StatCard label="Budgeted income" value={gbp(budgetedIncome)} />
              <StatCard
                label="Actual income"
                value={gbp(actualIncome)}
                hint={`Period ${period.start} to ${period.end}`}
              />
              <StatCard
                label="Upcoming income"
                value={String(upcoming.length)}
                hint={`Window ${plan.setup.windowDays} days`}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
                <div className="text-sm font-semibold text-slate-800">Income rules</div>
                <div className="mt-4 space-y-3 text-sm">
                  {plan.incomeRules
                    .filter((rule) => rule.enabled)
                    .map((rule) => (
                      <div key={rule.id} className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900">{rule.label}</div>
                          <div className="text-xs text-slate-500">{rule.cadence}</div>
                        </div>
                        <div className="font-semibold text-slate-900">{gbp(rule.amount)}</div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
                <div className="text-sm font-semibold text-slate-800">Upcoming income</div>
                <div className="mt-4 space-y-3 text-sm">
                  {upcoming.length === 0 ? (
                    <div className="text-slate-500">No income in the current window.</div>
                  ) : (
                    upcoming.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900">{item.label}</div>
                          <div className="text-xs text-slate-500">Due {prettyDate(item.date)}</div>
                        </div>
                        <div className="font-semibold text-emerald-600">{gbp(item.amount)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <details className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                Budget vs actual by source
              </summary>
              <div className="mt-4 text-sm">
                <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 text-[11px] uppercase tracking-wide text-slate-400 sm:grid">
                  <div>Source</div>
                  <div className="text-right">Budget</div>
                  <div className="text-right">Actual</div>
                  <div className="text-right">Variance</div>
                </div>
                {budgetVsActual.length === 0 ? (
                  <div className="text-slate-500">No income rules yet.</div>
                ) : (
                  <div ref={varianceListRef} className="mt-3 max-h-[65vh] overflow-auto pr-2">
                    <div
                      className="relative w-full"
                      style={{ height: `${varianceVirtualizer.getTotalSize()}px` }}
                    >
                      {varianceVirtualizer.getVirtualItems().map((virtualRow) => {
                        const item = budgetVsActual[virtualRow.index];
                        if (!item) return null;
                        const variance = formatVariance(item.variance, true);
                        const countLabel =
                          item.transactions.length === 1
                            ? "1 item"
                            : `${item.transactions.length} items`;
                        return (
                          <div
                            key={item.id}
                            ref={varianceVirtualizer.measureElement}
                            className="absolute left-0 top-0 w-full"
                            style={{ transform: `translateY(${virtualRow.start}px)` }}
                          >
                            <details className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                              <summary className="grid cursor-pointer list-none items-center gap-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
                                <div>
                                  <div className="font-semibold text-slate-900">{item.label}</div>
                                  <div className="text-xs text-slate-500">{countLabel}</div>
                                </div>
                                <div className="flex items-center justify-between text-slate-600 sm:block sm:text-right">
                                  <span className="text-[10px] uppercase tracking-wide text-slate-400 sm:hidden">
                                    Budget
                                  </span>
                                  <span>{gbp(item.budgeted)}</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-900 sm:block sm:text-right">
                                  <span className="text-[10px] uppercase tracking-wide text-slate-400 sm:hidden">
                                    Actual
                                  </span>
                                  <span>{gbp(item.actual)}</span>
                                </div>
                                <div
                                  className={`flex items-center justify-between font-semibold ${variance.tone} sm:block sm:text-right`}
                                >
                                  <span className="text-[10px] uppercase tracking-wide text-slate-400 sm:hidden">
                                    Variance
                                  </span>
                                  <span>{variance.label}</span>
                                </div>
                              </summary>
                              <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-600">
                                {item.transactions.length === 0 ? (
                                  <div className="text-slate-500">No income transactions recorded.</div>
                                ) : (
                                  <div className="space-y-2">
                                    {item.transactions.map((txn) => (
                                      <div key={txn.id} className="flex items-start justify-between gap-3">
                                        <div>
                                          <div className="text-slate-700">{txn.label}</div>
                                          <div className="text-[11px] text-slate-500">
                                            {prettyDate(txn.date)}
                                            {txn.notes ? ` - ${txn.notes}` : ""}
                                          </div>
                                        </div>
                                        <div className="font-semibold text-slate-900">{gbp(txn.amount)}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </details>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </details>

          </section>
        </div>
      </div>

    </main>
  );
}
