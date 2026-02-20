"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getActiveScenarioUpdatedAt, loadPlan, savePlan, PLAN_UPDATED_EVENT } from "@/lib/storage";
import { generateEvents, getPeriod, getUpcomingEvents } from "@/lib/cashflowEngine";
import SidebarNav from "@/components/SidebarNav";
import { formatMoney } from "@/lib/currency";
import { prettyDate, formatUpdatedAt, formatVariance } from "@/lib/formatUtils";
import { splitTokens, matchesTokens } from "@/lib/textUtils";
import { SimpleStatCard as StatCard } from "@/components/Card";
import type { Transaction, IncomeRule, Recurrence } from "@/data/plan";

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

export default function IncomePage() {
  const [plan, setPlan] = useState(() => loadPlan());
  const [lastUpdated, setLastUpdated] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<IncomeRule | null>(null);
  const [formData, setFormData] = useState<Partial<IncomeRule>>({
    label: "",
    amount: 0,
    cadence: "monthly" as Recurrence,
    seedDate: new Date().toISOString().slice(0, 10),
    enabled: true,
  });

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

  function handleAddRule() {
    setEditingRule(null);
    setFormData({
      label: "",
      amount: 0,
      cadence: "monthly",
      seedDate: new Date().toISOString().slice(0, 10),
      enabled: true,
    });
    setShowModal(true);
  }

  function handleEditRule(rule: IncomeRule) {
    setEditingRule(rule);
    setFormData(rule);
    setShowModal(true);
  }

  function handleDeleteRule(ruleId: string) {
    if (!confirm("Are you sure you want to delete this income rule?")) return;
    const updated = { ...plan, incomeRules: plan.incomeRules.filter((r) => r.id !== ruleId) };
    savePlan(updated);
    setPlan(updated);
  }

  function handleSaveRule() {
    if (!formData.label || !formData.amount) {
      alert("Please fill in label and amount");
      return;
    }

    const ruleData: IncomeRule = {
      id: editingRule?.id || `income_${Date.now()}`,
      label: formData.label!,
      amount: Number(formData.amount),
      cadence: formData.cadence!,
      seedDate: formData.seedDate!,
      enabled: formData.enabled ?? true,
    };

    const updated = editingRule
      ? { ...plan, incomeRules: plan.incomeRules.map((r) => (r.id === editingRule.id ? ruleData : r)) }
      : { ...plan, incomeRules: [...plan.incomeRules, ruleData] };

    savePlan(updated);
    setPlan(updated);
    setShowModal(false);
  }

  function handleToggleEnabled(ruleId: string) {
    const updated = {
      ...plan,
      incomeRules: plan.incomeRules.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      ),
    };
    savePlan(updated);
    setPlan(updated);
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-28 pt-5">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

          <section className="space-y-6">
            <header className="vn-card p-6">
              <div className="text-xs uppercase tracking-wide text-[var(--vn-muted)]">Income</div>
              <h1 className="text-2xl font-semibold text-[var(--vn-text)]">Income sources</h1>
              <p className="mt-2 text-sm text-[var(--vn-muted)]">
                Plan your pay and compare with real income.
              </p>
              {lastUpdated ? (
                <div className="mt-1 text-[11px] text-slate-400">
                  Last updated {formatUpdatedAt(lastUpdated)}
                </div>
              ) : null}
            </header>

            <div className="grid gap-6 md:grid-cols-3">
              <StatCard label="Budgeted income" value={formatMoney(budgetedIncome)} />
              <StatCard
                label="Actual income"
                value={formatMoney(actualIncome)}
                hint={`Period ${period.start} to ${period.end}`}
              />
              <StatCard
                label="Upcoming income"
                value={String(upcoming.length)}
                hint={`Next ${plan.setup.windowDays} days`}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="vn-card p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-[var(--vn-text)]">Income rules</div>
                  <button
                    onClick={handleAddRule}
                    className="vn-btn vn-btn-primary text-xs px-3 py-1.5"
                  >
                    + Add Rule
                  </button>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  {plan.incomeRules.length === 0 ? (
                    <div className="text-[var(--vn-muted)] text-xs">No income rules yet. Add one to get started.</div>
                  ) : (
                    plan.incomeRules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg ${rule.enabled ? "bg-[var(--vn-surface)] border border-[var(--vn-border)]" : "bg-[var(--vn-bg)]/60 opacity-60"
                          }`}
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-[var(--vn-text)]">{rule.label}</div>
                          <div className="text-xs text-[var(--vn-muted)]">
                            {rule.cadence} • {rule.seedDate}
                            {!rule.enabled && " • Disabled"}
                          </div>
                        </div>
                        <div className="font-semibold text-[var(--vn-text)]">{formatMoney(rule.amount)}</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleEnabled(rule.id)}
                            className="text-xs text-[var(--vn-muted)] hover:text-[var(--vn-text)] p-2 min-w-10 min-h-10 flex items-center justify-center"
                            title={rule.enabled ? "Disable" : "Enable"}
                          >
                            {rule.enabled ? "👁️" : "👁️‍🗨️"}
                          </button>
                          <button
                            onClick={() => handleEditRule(rule)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 min-h-10 flex items-center"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="text-xs text-red-600 hover:text-red-800 p-2 min-h-10 flex items-center"
                          >
                            Del
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="vn-card p-6">
                <div className="text-sm font-semibold text-[var(--vn-text)]">Upcoming income</div>
                <div className="mt-4 space-y-3 text-sm">
                  {upcoming.length === 0 ? (
                    <div className="text-[var(--vn-muted)]">No income in the current window.</div>
                  ) : (
                    upcoming.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-[var(--vn-text)]">{item.label}</div>
                          <div className="text-xs text-[var(--vn-muted)]">Due {prettyDate(item.date)}</div>
                        </div>
                        <div className="font-semibold text-green-600">{formatMoney(item.amount)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <details className="vn-card p-6">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--vn-text)]">
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
                  <div className="text-[var(--vn-muted)]">No income rules yet.</div>
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
                            <details className="rounded-2xl border border-[var(--vn-border)] bg-[var(--vn-surface)] px-4 py-3">
                              <summary className="grid cursor-pointer list-none items-center gap-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
                                <div>
                                  <div className="font-semibold text-[var(--vn-text)]">{item.label}</div>
                                  <div className="text-xs text-[var(--vn-muted)]">{countLabel}</div>
                                </div>
                                <div className="flex items-center justify-between text-[var(--vn-muted)] sm:block sm:text-right">
                                  <span className="text-[10px] uppercase tracking-wide text-slate-400 sm:hidden">
                                    Budget
                                  </span>
                                  <span>{formatMoney(item.budgeted)}</span>
                                </div>
                                <div className="flex items-center justify-between text-[var(--vn-text)] sm:block sm:text-right">
                                  <span className="text-[10px] uppercase tracking-wide text-slate-400 sm:hidden">
                                    Actual
                                  </span>
                                  <span>{formatMoney(item.actual)}</span>
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
                              <div className="mt-3 border-t border-[var(--vn-border)] pt-3 text-xs text-[var(--vn-muted)]">
                                {item.transactions.length === 0 ? (
                                  <div className="text-[var(--vn-muted)]">No income transactions recorded.</div>
                                ) : (
                                  <div className="space-y-2">
                                    {item.transactions.map((txn) => (
                                      <div key={txn.id} className="flex items-start justify-between gap-3">
                                        <div>
                                          <div className="text-[var(--vn-text)]">{txn.label}</div>
                                          <div className="text-[11px] text-[var(--vn-muted)]">
                                            {prettyDate(txn.date)}
                                            {txn.notes ? ` - ${txn.notes}` : ""}
                                          </div>
                                        </div>
                                        <div className="font-semibold text-[var(--vn-text)]">{formatMoney(txn.amount)}</div>
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

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="vn-card max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-[var(--vn-text)] mb-4">
              {editingRule ? "Edit Income Rule" : "Add Income Rule"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--vn-text)] mb-1">
                  Label *
                </label>
                <input
                  type="text"
                  value={formData.label || ""}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="vn-input text-sm"
                  placeholder="e.g., Salary, Freelance"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--vn-text)] mb-1">
                  Amount *
                </label>
                <input
                  type="number"
                  value={formData.amount || ""}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  className="vn-input text-sm"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--vn-text)] mb-1">
                  Frequency *
                </label>
                <select
                  value={formData.cadence || "monthly"}
                  onChange={(e) => setFormData({ ...formData, cadence: e.target.value as Recurrence })}
                  className="vn-input text-sm"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--vn-text)] mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={formData.seedDate || ""}
                  onChange={(e) => setFormData({ ...formData, seedDate: e.target.value })}
                  className="vn-input text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled ?? true}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
                <label htmlFor="enabled" className="text-sm text-[var(--vn-text)]">
                  Enabled
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveRule}
                className="vn-btn vn-btn-primary flex-1"
              >
                {editingRule ? "Save Changes" : "Add Rule"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="vn-btn vn-btn-ghost"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


