"use client";

import { useEffect, useMemo, useState } from "react";
import { getActiveScenarioUpdatedAt, loadPlan, savePlan, PLAN_UPDATED_EVENT } from "@/lib/storage";
import { generateEvents, getPeriod, getUpcomingEvents } from "@/lib/cashflowEngine";
import { detectRecurringBills } from "@/lib/billDetection";
import SidebarNav from "@/components/SidebarNav";
import BankingSection from "@/components/BankingSection";
import { BillSuggestions } from "@/components/BillSuggestions";
import { formatMoney } from "@/lib/currency";
import { prettyDate, formatUpdatedAt, formatVariance } from "@/lib/formatUtils";
import { splitTokens, matchesTokens } from "@/lib/textUtils";
import { SimpleStatCard as StatCard } from "@/components/Card";
import type { Transaction, BillTemplate, OutflowRule, Recurrence, CashflowCategory } from "@/data/plan";
import type { DetectedBill } from "@/lib/billDetection";

function matchBill(txn: Transaction, label: string, id: string) {
  const tokens = Array.from(
    new Set(
      [label, id]
        .map((value) => splitTokens(value))
        .flat()
        .filter((token) => token.length >= 2)
    )
  );
  return matchesTokens(`${txn.label} ${txn.notes ?? ""}`, tokens);
}

export default function BillsPage() {
  const [plan, setPlan] = useState(() => loadPlan());
  const [lastUpdated, setLastUpdated] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showOutflowModal, setShowOutflowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<BillTemplate | null>(null);
  const [editingOutflow, setEditingOutflow] = useState<OutflowRule | null>(null);
  const [formData, setFormData] = useState<Partial<BillTemplate>>({
    label: "",
    amount: 0,
    dueDay: 1,
    category: "bill",
    enabled: true,
  });
  const [outflowFormData, setOutflowFormData] = useState<Partial<OutflowRule>>({
    label: "",
    amount: 0,
    cadence: "monthly" as Recurrence,
    seedDate: new Date().toISOString().slice(0, 10),
    category: "other",
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
  const disabledBills = useMemo(() => {
    const override = plan.periodOverrides.find((o) => o.periodId === plan.setup.selectedPeriodId);
    return new Set(override?.disabledBills ?? []);
  }, [plan]);
  const upcoming = useMemo(
    () => getUpcomingEvents(plan, plan.setup.selectedPeriodId, "outflow").slice(0, 6),
    [plan]
  );

  // Detect recurring bills from transaction history
  const detectedBills = useMemo(
    () => detectRecurringBills(plan.transactions, plan.bills),
    [plan.transactions, plan.bills]
  );

  const budgetedOutflows = useMemo(
    () => events.filter((e) => e.type === "outflow").reduce((sum, e) => sum + e.amount, 0),
    [events]
  );
  const actualOutflows = useMemo(
    () =>
      plan.transactions
        .filter((t) => t.type === "outflow" && t.date >= period.start && t.date <= period.end)
        .reduce((sum, t) => sum + t.amount, 0),
    [plan, period]
  );

  const budgetVsActualBills = useMemo(() => {
    const periodTransactions = plan.transactions.filter(
      (t) => t.type === "outflow" && t.date >= period.start && t.date <= period.end
    );
    const billEvents = events.filter((e) => e.type === "outflow");

    return plan.bills
      .filter((bill) => bill.enabled && !disabledBills.has(bill.id))
      .map((bill) => {
        const budgeted = billEvents
          .filter((e) => e.sourceId === bill.id)
          .reduce((sum, e) => sum + e.amount, 0);
        const transactions = periodTransactions.filter((t) => {
          if (t.linkedBillId) return t.linkedBillId === bill.id;
          if (t.category === bill.category) {
            return matchBill(t, bill.label, bill.id);
          }
          if (t.category === "other") {
            return matchBill(t, bill.label, bill.id);
          }
          return false;
        });
        const actual = transactions.reduce((sum, t) => sum + t.amount, 0);
        return {
          id: bill.id,
          label: bill.label,
          budgeted,
          actual,
          variance: actual - budgeted,
          transactions: transactions.sort((a, b) => b.date.localeCompare(a.date)),
        };
      });
  }, [disabledBills, events, period, plan]);

  const budgetVsActualOutflows = useMemo(() => {
    const periodTransactions = plan.transactions.filter(
      (t) => t.date >= period.start && t.date <= period.end
    );
    const outflowEvents = events.filter((e) => e.type === "outflow");

    return plan.outflowRules
      .filter((rule) => rule.enabled)
      .map((rule) => {
        const budgeted = outflowEvents
          .filter((e) => e.sourceId === rule.id)
          .reduce((sum, e) => sum + e.amount, 0);
        const transactions = periodTransactions.filter((t) => {
          if (rule.category === "savings") {
            if (t.type !== "transfer") return false;
            if (t.linkedRuleId) return t.linkedRuleId === rule.id;
            return t.category === "savings";
          }
          if (t.type !== "outflow") return false;
          if (t.linkedRuleId) return t.linkedRuleId === rule.id;
          return t.category === rule.category;
        });
        const actual = transactions.reduce((sum, t) => sum + t.amount, 0);
        return {
          id: rule.id,
          label: rule.label,
          budgeted,
          actual,
          variance: actual - budgeted,
          transactions: transactions.sort((a, b) => b.date.localeCompare(a.date)),
        };
      });
  }, [events, period, plan]);

  function handleAddBill() {
    setEditingBill(null);
    setFormData({
      label: "",
      amount: 0,
      dueDay: 1,
      category: "bill",
      enabled: true,
    });
    setShowModal(true);
  }

  function handleEditBill(bill: BillTemplate) {
    setEditingBill(bill);
    setFormData(bill);
    setShowModal(true);
  }

  function handleDeleteBill(billId: string) {
    if (!confirm("Are you sure you want to delete this bill?")) return;
    const updated = { ...plan, bills: plan.bills.filter((b) => b.id !== billId) };
    savePlan(updated);
    setPlan(updated);
  }

  function handleSaveBill() {
    if (!formData.label || !formData.amount) {
      alert("Please fill in label and amount");
      return;
    }

    const billData: BillTemplate = {
      id: editingBill?.id || `bill_${Date.now()}`,
      label: formData.label!,
      amount: Number(formData.amount),
      dueDay: Number(formData.dueDay) || 1,
      category: formData.category!,
      enabled: formData.enabled ?? true,
    };

    const updated = editingBill
      ? { ...plan, bills: plan.bills.map((b) => (b.id === editingBill.id ? billData : b)) }
      : { ...plan, bills: [...plan.bills, billData] };

    savePlan(updated);
    setPlan(updated);
    setShowModal(false);
  }

  function handleToggleEnabled(billId: string) {
    const updated = {
      ...plan,
      bills: plan.bills.map((b) => (b.id === billId ? { ...b, enabled: !b.enabled } : b)),
    };
    savePlan(updated);
    setPlan(updated);
  }

  function handleAddOutflow() {
    setEditingOutflow(null);
    setOutflowFormData({
      label: "",
      amount: 0,
      cadence: "monthly",
      seedDate: new Date().toISOString().slice(0, 10),
      category: "other",
      enabled: true,
    });
    setShowOutflowModal(true);
  }

  function handleEditOutflow(rule: OutflowRule) {
    setEditingOutflow(rule);
    setOutflowFormData(rule);
    setShowOutflowModal(true);
  }

  function handleDeleteOutflow(ruleId: string) {
    if (!confirm("Are you sure you want to delete this outflow rule?")) return;
    const updated = { ...plan, outflowRules: plan.outflowRules.filter((r) => r.id !== ruleId) };
    savePlan(updated);
    setPlan(updated);
  }

  function handleSaveOutflow() {
    if (!outflowFormData.label || !outflowFormData.amount) {
      alert("Please fill in label and amount");
      return;
    }

    const ruleData: OutflowRule = {
      id: editingOutflow?.id || `outflow_${Date.now()}`,
      label: outflowFormData.label!,
      amount: Number(outflowFormData.amount),
      cadence: outflowFormData.cadence!,
      seedDate: outflowFormData.seedDate!,
      category: outflowFormData.category!,
      enabled: outflowFormData.enabled ?? true,
    };

    const updated = editingOutflow
      ? { ...plan, outflowRules: plan.outflowRules.map((r) => (r.id === editingOutflow.id ? ruleData : r)) }
      : { ...plan, outflowRules: [...plan.outflowRules, ruleData] };

    savePlan(updated);
    setPlan(updated);
    setShowOutflowModal(false);
  }

  function handleToggleOutflowEnabled(ruleId: string) {
    const updated = {
      ...plan,
      outflowRules: plan.outflowRules.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      ),
    };
    savePlan(updated);
    setPlan(updated);
  }

  // Handle accepting a detected bill suggestion
  function handleAcceptBill(bill: BillTemplate) {
    const updated = { ...plan, bills: [...plan.bills, bill] };
    savePlan(updated);
    setPlan(updated);
  }

  // Handle dismissing a detected bill (store in local storage to not show again)
  function handleDismissBill(billId: string) {
    // For now, we just let the BillSuggestions component handle the UI state
    // In a production app, you'd store dismissed IDs in localStorage or the plan
    console.log("Dismissed bill suggestion:", billId);
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 pb-28 pt-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

          <section className="space-y-6">
            <header className="vn-card p-6">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Bills</div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Bills and outflows</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Plan your bills and compare with real spending.
              </p>
              {lastUpdated ? (
                <div className="mt-1 text-[11px] text-slate-400">
                  Last updated {formatUpdatedAt(lastUpdated)}
                </div>
              ) : null}
            </header>

            <div className="grid gap-6 md:grid-cols-3">
              <StatCard label="Budgeted outflows" value={formatMoney(budgetedOutflows)} />
              <StatCard
                label="Actual outflows"
                value={formatMoney(actualOutflows)}
                hint={`Period ${period.start} to ${period.end}`}
              />
              <StatCard
                label="Upcoming outflows"
                value={String(upcoming.length)}
                hint={`Next ${plan.setup.windowDays} days`}
              />
            </div>

            <BankingSection
              onSyncComplete={() => {
                setPlan(loadPlan());
                setLastUpdated(getActiveScenarioUpdatedAt());
              }}
            />

            {/* Bill Suggestions from transaction history */}
            {detectedBills.length > 0 && (
              <BillSuggestions
                detectedBills={detectedBills}
                onAccept={handleAcceptBill}
                onDismiss={handleDismissBill}
              />
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="vn-card p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Planned bills</div>
                  <button
                    onClick={handleAddBill}
                    className="vn-btn vn-btn-primary text-xs px-4 py-2.5"
                  >
                    + Add Bill
                  </button>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  {plan.bills.length === 0 ? (
                    <div className="text-slate-500 dark:text-slate-400 text-xs">No bills yet. Add one to get started.</div>
                  ) : (
                    plan.bills.map((bill) => (
                      <div
                        key={bill.id}
                        className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg ${bill.enabled && !disabledBills.has(bill.id)
                          ? "bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700"
                          : "bg-slate-100 dark:bg-slate-700/60 opacity-60"
                          }`}
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900 dark:text-white">{bill.label}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Due day {bill.dueDay} • {bill.category}
                            {!bill.enabled && " • Disabled"}
                            {disabledBills.has(bill.id) && " • Disabled for period"}
                          </div>
                        </div>
                        <div className="font-semibold text-slate-900 dark:text-white">{formatMoney(bill.amount)}</div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleEnabled(bill.id)}
                            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 p-2 min-w-10 min-h-10 flex items-center justify-center"
                            title={bill.enabled ? "Disable" : "Enable"}
                          >
                            {bill.enabled ? "👁️" : "👁️‍🗨️"}
                          </button>
                          <button
                            onClick={() => handleEditBill(bill)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 min-h-10 flex items-center"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteBill(bill.id)}
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
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Recurring outflows</div>
                  <button
                    onClick={handleAddOutflow}
                    className="vn-btn vn-btn-primary text-xs px-4 py-2.5"
                  >
                    + Add Outflow
                  </button>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  {plan.outflowRules.length === 0 ? (
                    <div className="text-slate-500 dark:text-slate-400 text-xs">No outflow rules yet. Add one to get started.</div>
                  ) : (
                    plan.outflowRules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg ${rule.enabled
                          ? "bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700"
                          : "bg-slate-100 dark:bg-slate-700/60 opacity-60"
                          }`}
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900 dark:text-white">{rule.label}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {rule.cadence} • {rule.category}
                            {!rule.enabled && " • Disabled"}
                          </div>
                        </div>
                        <div className="font-semibold text-slate-900 dark:text-white">{formatMoney(rule.amount)}</div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleOutflowEnabled(rule.id)}
                            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 p-2 min-w-10 min-h-10 flex items-center justify-center"
                            title={rule.enabled ? "Disable" : "Enable"}
                          >
                            {rule.enabled ? "👁️" : "👁️‍🗨️"}
                          </button>
                          <button
                            onClick={() => handleEditOutflow(rule)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 min-h-10 flex items-center"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteOutflow(rule.id)}
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
            </div>

            <details className="vn-card p-6">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-100">
                Budget vs actual by bill
              </summary>
              <div className="mt-4 text-sm">
                <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 text-[11px] uppercase tracking-wide text-slate-400 sm:grid">
                  <div>Bill</div>
                  <div className="text-right">Budget</div>
                  <div className="text-right">Actual</div>
                  <div className="text-right">Variance</div>
                </div>
                {budgetVsActualBills.length === 0 ? (
                  <div className="text-slate-500 dark:text-slate-400">No active bills for this period.</div>
                ) : (
                  <div className="mt-3 max-h-[65vh] space-y-3 overflow-auto pr-2">
                    {budgetVsActualBills.map((item) => {
                      const variance = formatVariance(item.variance, false);
                      const countLabel =
                        item.transactions.length === 1
                          ? "1 item"
                          : `${item.transactions.length} items`;
                      return (
                        <details key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 px-4 py-3">
                          <summary className="grid cursor-pointer list-none items-center gap-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">{item.label}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{countLabel}</div>
                            </div>
                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 sm:block sm:text-right">
                              <span className="text-[10px] uppercase tracking-wide text-slate-400 sm:hidden">
                                Budget
                              </span>
                              <span>{formatMoney(item.budgeted)}</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-900 dark:text-white sm:block sm:text-right">
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
                          <div className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3 text-xs text-slate-600 dark:text-slate-300">
                            {item.transactions.length === 0 ? (
                              <div className="text-slate-500 dark:text-slate-400">No bill transactions recorded.</div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
                                  <span>Actual breakdown</span>
                                  <span>
                                    {item.transactions.length} item{item.transactions.length === 1 ? "" : "s"} -{" "}
                                    {formatMoney(item.actual)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-[96px_1fr_auto] gap-2 text-[10px] uppercase tracking-wide text-slate-400">
                                  <div>Date</div>
                                  <div>Details</div>
                                  <div className="text-right">Amount</div>
                                </div>
                                <div className="space-y-2">
                                  {item.transactions.map((txn) => (
                                    <div
                                      key={txn.id}
                                      className="grid grid-cols-[96px_1fr_auto] items-start gap-2 rounded-xl bg-white/70 dark:bg-slate-800/70 px-3 py-2"
                                    >
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{prettyDate(txn.date)}</div>
                                      <div>
                                        <div className="text-sm text-slate-700 dark:text-slate-200">{txn.label}</div>
                                        {txn.notes ? (
                                          <div className="text-[11px] text-slate-400">{txn.notes}</div>
                                        ) : null}
                                      </div>
                                      <div className="text-right text-sm font-semibold text-slate-900 dark:text-white">
                                        {formatMoney(txn.amount)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
              </div>
            </details>

            <details className="vn-card p-6">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-100">
                Budget vs actual by outflow
              </summary>
              <div className="mt-4 text-sm">
                <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 text-[11px] uppercase tracking-wide text-slate-400 sm:grid">
                  <div>Outflow</div>
                  <div className="text-right">Budget</div>
                  <div className="text-right">Actual</div>
                  <div className="text-right">Variance</div>
                </div>
                {budgetVsActualOutflows.length === 0 ? (
                  <div className="text-slate-500 dark:text-slate-400">No outflow rules yet.</div>
                ) : (
                  <div className="mt-3 max-h-[65vh] space-y-3 overflow-auto pr-2">
                    {budgetVsActualOutflows.map((item) => {
                      const variance = formatVariance(item.variance, false);
                      const countLabel =
                        item.transactions.length === 1
                          ? "1 item"
                          : `${item.transactions.length} items`;
                      return (
                        <details key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 px-4 py-3">
                          <summary className="grid cursor-pointer list-none items-center gap-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">{item.label}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{countLabel}</div>
                            </div>
                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 sm:block sm:text-right">
                              <span className="text-[10px] uppercase tracking-wide text-slate-400 sm:hidden">
                                Budget
                              </span>
                              <span>{formatMoney(item.budgeted)}</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-900 dark:text-white sm:block sm:text-right">
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
                          <div className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3 text-xs text-slate-600 dark:text-slate-300">
                            {item.transactions.length === 0 ? (
                              <div className="text-slate-500 dark:text-slate-400">No outflow transactions recorded.</div>
                            ) : (
                              <div className="space-y-2">
                                {item.transactions.map((txn) => (
                                  <div key={txn.id} className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="text-slate-700 dark:text-slate-200">{txn.label}</div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {prettyDate(txn.date)}
                                        {txn.notes ? ` - ${txn.notes}` : ""}
                                      </div>
                                    </div>
                                    <div className="font-semibold text-slate-900 dark:text-white">{formatMoney(txn.amount)}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </details>
                      );
                    })}
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
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {editingBill ? "Edit Bill" : "Add Bill"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Label *
                </label>
                <input
                  type="text"
                  value={formData.label || ""}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="vn-input text-sm"
                  placeholder="e.g., Rent, Utilities"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Due Day (1-31) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dueDay || ""}
                  onChange={(e) => setFormData({ ...formData, dueDay: Number(e.target.value) })}
                  className="vn-input text-sm"
                  placeholder="1"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Category *
                </label>
                <select
                  value={formData.category || "bill"}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as CashflowCategory })}
                  className="vn-input text-sm"
                >
                  <option value="bill">Bill</option>
                  <option value="giving">Giving</option>
                  <option value="savings">Savings</option>
                  <option value="allowance">Allowance</option>
                  <option value="buffer">Buffer</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled ?? true}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
                <label htmlFor="enabled" className="text-sm text-slate-700 dark:text-slate-200">
                  Enabled
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveBill}
                className="vn-btn vn-btn-primary flex-1"
              >
                {editingBill ? "Save Changes" : "Add Bill"}
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

      {showOutflowModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowOutflowModal(false)}
        >
          <div
            className="vn-card max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {editingOutflow ? "Edit Outflow Rule" : "Add Outflow Rule"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Label *
                </label>
                <input
                  type="text"
                  value={outflowFormData.label || ""}
                  onChange={(e) => setOutflowFormData({ ...outflowFormData, label: e.target.value })}
                  className="vn-input text-sm"
                  placeholder="e.g., Gym membership, Subscriptions"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Amount (£) *
                </label>
                <input
                  type="number"
                  value={outflowFormData.amount || ""}
                  onChange={(e) => setOutflowFormData({ ...outflowFormData, amount: Number(e.target.value) })}
                  className="vn-input text-sm"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Cadence *
                </label>
                <select
                  value={outflowFormData.cadence || "monthly"}
                  onChange={(e) => setOutflowFormData({ ...outflowFormData, cadence: e.target.value as Recurrence })}
                  className="vn-input text-sm"
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Seed Date *
                </label>
                <input
                  type="date"
                  value={outflowFormData.seedDate || ""}
                  onChange={(e) => setOutflowFormData({ ...outflowFormData, seedDate: e.target.value })}
                  className="vn-input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Category *
                </label>
                <select
                  value={outflowFormData.category || "other"}
                  onChange={(e) => setOutflowFormData({ ...outflowFormData, category: e.target.value as CashflowCategory })}
                  className="vn-input text-sm"
                >
                  <option value="bill">Bill</option>
                  <option value="giving">Giving</option>
                  <option value="savings">Savings</option>
                  <option value="allowance">Allowance</option>
                  <option value="buffer">Buffer</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="outflow-enabled"
                  checked={outflowFormData.enabled ?? true}
                  onChange={(e) => setOutflowFormData({ ...outflowFormData, enabled: e.target.checked })}
                />
                <label htmlFor="outflow-enabled" className="text-sm text-slate-700 dark:text-slate-200">
                  Enabled
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveOutflow}
                className="vn-btn vn-btn-primary flex-1"
              >
                {editingOutflow ? "Save Changes" : "Add Outflow"}
              </button>
              <button
                onClick={() => setShowOutflowModal(false)}
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



