"use client";

import { useEffect, useMemo, useState } from "react";
import { getActiveScenarioUpdatedAt, loadPlan, savePlan, PLAN_UPDATED_EVENT } from "@/lib/storage";
import { generateEvents, getPeriod, getUpcomingEvents } from "@/lib/cashflowEngine";
import { detectRecurringBills } from "@/lib/billDetection";
import SidebarNav from "@/components/SidebarNav";
import BankingSection from "@/components/BankingSection";
import { BillSuggestions } from "@/components/BillSuggestions";
import { formatMoney, getCurrencySymbol } from "@/lib/currency";
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

  const DISMISSED_BILLS_KEY = "cashflow_dismissed_bill_suggestions";
  const [dismissedBillIds, setDismissedBillIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_BILLS_KEY);
      return stored ? new Set<string>(JSON.parse(stored) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
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
    () => getUpcomingEvents(plan, plan.setup.selectedPeriodId, "outflow")
      .sort((a, b) => a.date.localeCompare(b.date)),
    [plan]
  );

  // Detect recurring bills from transaction history
  const detectedBills = useMemo(
    () => detectRecurringBills(plan.transactions, plan.bills),
    [plan.transactions, plan.bills]
  );

  // Filter out bills the user has already dismissed (persisted in localStorage)
  const filteredDetectedBills = useMemo(
    () =>
      detectedBills.filter(
        (b) =>
          !dismissedBillIds.has(b.id) &&
          b.confidence >= (plan.setup.billDetectionMinConfidence ?? 50)
      ),
    [detectedBills, dismissedBillIds, plan.setup.billDetectionMinConfidence]
  );

  const billIds = useMemo(() => new Set(plan.bills.map((b) => b.id)), [plan.bills]);
  const budgetedOutflows = useMemo(
    () => events.filter((e) => e.type === "outflow").reduce((sum, e) => sum + e.amount, 0),
    [events]
  );
  const budgetedBillsPortion = useMemo(
    () => events.filter((e) => e.type === "outflow" && billIds.has(e.sourceId ?? "")).reduce((sum, e) => sum + e.amount, 0),
    [events, billIds]
  );
  const budgetedAllocationsPortion = useMemo(
    () => events.filter((e) => e.type === "outflow" && !billIds.has(e.sourceId ?? "")).reduce((sum, e) => sum + e.amount, 0),
    [events, billIds]
  );
  const actualOutflows = useMemo(
    () =>
      plan.transactions
        .filter((t) => t.type === "outflow" && t.date >= period.start && t.date <= period.end)
        .reduce((sum, t) => sum + t.amount, 0),
    [plan, period]
  );
  const actualBillsPortion = useMemo(
    () =>
      plan.transactions
        .filter((t) => t.type === "outflow" && t.linkedBillId && t.date >= period.start && t.date <= period.end)
        .reduce((sum, t) => sum + t.amount, 0),
    [plan, period]
  );
  const actualAllocationsPortion = useMemo(
    () =>
      plan.transactions
        .filter((t) => t.type === "outflow" && !t.linkedBillId && t.date >= period.start && t.date <= period.end)
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

  // Detect period-over-period price changes for committed bills (≥5% change)
  const priceChanges = useMemo(() => {
    const sorted = [...plan.periods].sort((a, b) => a.start.localeCompare(b.start));
    const curIdx = sorted.findIndex(p => p.id === plan.setup.selectedPeriodId);
    if (curIdx < 1) return new Map<string, { prev: number; curr: number; pct: number }>();
    const curP = sorted[curIdx];
    const prevP = sorted[curIdx - 1];
    const result = new Map<string, { prev: number; curr: number; pct: number }>();
    for (const bill of plan.bills) {
      const curr = plan.transactions
        .filter(t => t.type === "outflow" && t.date >= curP.start && t.date <= curP.end &&
          (t.linkedBillId === bill.id || matchBill(t, bill.label, bill.id)))
        .reduce((s, t) => s + t.amount, 0);
      const prev = plan.transactions
        .filter(t => t.type === "outflow" && t.date >= prevP.start && t.date <= prevP.end &&
          (t.linkedBillId === bill.id || matchBill(t, bill.label, bill.id)))
        .reduce((s, t) => s + t.amount, 0);
      if (prev > 0 && curr > 0) {
        const pct = (curr - prev) / prev;
        if (Math.abs(pct) >= 0.05) result.set(bill.id, { prev, curr, pct });
      }
    }
    return result;
  }, [plan]);

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
    // Also persist the accepted suggestion as dismissed so it doesn't reappear
    handleDismissBill(bill.id);
  }

  // Handle dismissing a detected bill (store in local storage to not show again)
  function handleDismissBill(billId: string) {
    const updated = new Set(dismissedBillIds);
    updated.add(billId);
    setDismissedBillIds(updated);
    try {
      localStorage.setItem(DISMISSED_BILLS_KEY, JSON.stringify(Array.from(updated)));
    } catch {
      // localStorage unavailable (e.g. private browsing quota)
    }
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-40 pt-5">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

          <section className="space-y-6">
            <header className="vn-masthead">
              <div className="text-xs uppercase tracking-widest font-semibold text-white/50">Bills</div>
              <h1 className="text-2xl font-bold text-white/90" style={{ fontFamily: "var(--font-playfair, serif)" }}>Committed Bills &amp; Recurring Outflows</h1>
              <p className="mt-2 text-sm text-white/55">
                Plan your bills and compare with real spending.
              </p>
              {lastUpdated ? (
                <div className="mt-1 text-[11px] text-white/40">
                  Last updated {formatUpdatedAt(lastUpdated)}
                </div>
              ) : null}
            </header>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="vn-card p-5">
                <div className="text-xs font-medium text-(--vn-muted) mb-1">Total Budgeted Outflows</div>
                <div className="text-xl font-bold text-(--vn-text)">{formatMoney(budgetedOutflows)}</div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-(--vn-muted)">Bills</span>
                    <span className="font-medium text-(--vn-text)">{formatMoney(budgetedBillsPortion)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-(--vn-muted)">Recurring outflows</span>
                    <span className="font-medium text-(--vn-text)">{formatMoney(budgetedAllocationsPortion)}</span>
                  </div>
                </div>
              </div>
              <div className="vn-card p-5">
                <div className="text-xs font-medium text-(--vn-muted) mb-1">Total Actual Outflows</div>
                <div className="text-xl font-bold text-(--vn-text)">{formatMoney(actualOutflows)}</div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-(--vn-muted)">Bills</span>
                    <span className="font-medium text-(--vn-text)">{formatMoney(actualBillsPortion)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-(--vn-muted)">Recurring outflows</span>
                    <span className="font-medium text-(--vn-text)">{formatMoney(actualAllocationsPortion)}</span>
                  </div>
                </div>
                <div className="mt-1 text-[10px] text-(--vn-muted)">{prettyDate(period.start)} – {prettyDate(period.end)}</div>
              </div>
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
            {filteredDetectedBills.length > 0 && (
              <BillSuggestions
                detectedBills={filteredDetectedBills}
                onAccept={handleAcceptBill}
                onDismiss={handleDismissBill}
              />
            )}

            {/* ── Upcoming Payments Timeline ─────────────────────────── */}
            {upcoming.length > 0 && (
              <div className="vn-card p-6">
                <div className="text-sm font-semibold text-(--vn-text) mb-4">
                  Upcoming Payments
                  <span className="ml-2 text-xs font-normal text-(--vn-muted)">next {plan.setup.windowDays} days</span>
                </div>
                <div className="space-y-2">
                  {upcoming.map((ev) => {
                    const today = plan.setup.asOfDate;
                    const msPerDay = 86_400_000;
                    const todayMs = new Date(today + "T00:00:00").getTime();
                    const evMs = new Date(ev.date + "T00:00:00").getTime();
                    const daysAway = Math.round((evMs - todayMs) / msPerDay);
                    const isToday = daysAway === 0;
                    const isTomorrow = daysAway === 1;
                    const badgeColor =
                      daysAway <= 0
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                        : daysAway <= 3
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          : daysAway <= 7
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
                    const badgeLabel = isToday
                      ? "Today"
                      : isTomorrow
                        ? "Tomorrow"
                        : daysAway < 0
                          ? "Overdue"
                          : `In ${daysAway}d`;
                    const categoryColor: Record<string, string> = {
                      bill: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
                      savings: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
                      giving: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
                      allowance: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
                      buffer: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                      other: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                    };
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-(--vn-border) bg-(--vn-surface) px-4 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}
                          >
                            {badgeLabel}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-(--vn-text)">{ev.label}</div>
                            <div className="text-xs text-(--vn-muted)">{prettyDate(ev.date)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              categoryColor[ev.category] ?? categoryColor.other
                            }`}
                          >
                            {ev.category}
                          </span>
                          <span className="text-sm font-semibold text-(--vn-text)">{formatMoney(ev.amount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="vn-card p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-(--vn-text)">Committed Bills</div>
                  <button
                    onClick={handleAddBill}
                    className="vn-btn vn-btn-primary text-xs px-4 py-2.5"
                  >
                    + Add Bill
                  </button>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  {plan.bills.length === 0 ? (
                    <div className="text-(--vn-muted) text-xs">No bills yet. Add one to get started.</div>
                  ) : (
                    plan.bills.map((bill) => (
                      <div
                        key={bill.id}
                        className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg ${bill.enabled && !disabledBills.has(bill.id)
                          ? "bg-(--vn-surface) border border-(--vn-border)"
                          : "bg-(--vn-bg)/60 opacity-60"
                          }`}
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-(--vn-text)">
                            {bill.label}
                            {(() => {
                              const chg = priceChanges.get(bill.id);
                              if (!chg) return null;
                              const up = chg.pct > 0;
                              return (
                                <span
                                  title={`Was ${formatMoney(chg.prev)}, now ${formatMoney(chg.curr)}`}
                                  className={`inline-flex ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    up
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                                  }`}
                                >
                                  {up ? "↑" : "↓"}{Math.round(Math.abs(chg.pct) * 100)}%
                                </span>
                              );
                            })()}
                          </div>
                          <div className="text-xs text-(--vn-muted)">
                            Due day {bill.dueDay} • {bill.category}
                            {!bill.enabled && " • Disabled"}
                            {disabledBills.has(bill.id) && " • Disabled for period"}
                          </div>
                        </div>
                        <div className="font-semibold text-(--vn-text)">{formatMoney(bill.amount)}</div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleEnabled(bill.id)}
                            className="text-xs text-(--vn-muted) hover:text-(--vn-text) p-2 min-w-10 min-h-10 flex items-center justify-center"
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
                  <div className="text-sm font-semibold text-(--vn-text)">Recurring Outflows</div>
                  <button
                    onClick={handleAddOutflow}
                    className="vn-btn vn-btn-primary text-xs px-4 py-2.5"
                  >
                    + Add Outflow
                  </button>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  {plan.outflowRules.length === 0 ? (
                    <div className="text-(--vn-muted) text-xs">No outflow rules yet. Add one to get started.</div>
                  ) : (
                    plan.outflowRules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg ${rule.enabled
                          ? "bg-(--vn-surface) border border-(--vn-border)"
                          : "bg-(--vn-bg)/60 opacity-60"
                          }`}
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-(--vn-text)">{rule.label}</div>
                          <div className="text-xs text-(--vn-muted)">
                            {rule.cadence} • {rule.category}
                            {!rule.enabled && " • Disabled"}
                          </div>
                        </div>
                        <div className="font-semibold text-(--vn-text)">{formatMoney(rule.amount)}</div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleOutflowEnabled(rule.id)}
                            className="text-xs text-(--vn-muted) hover:text-(--vn-text) p-2 min-w-10 min-h-10 flex items-center justify-center"
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
              <summary className="cursor-pointer text-sm font-semibold text-(--vn-text)">
                Budget vs actual by bill
              </summary>
              <div className="mt-4 text-sm">
                <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 text-[11px] uppercase tracking-wide text-(--vn-muted) sm:grid">
                  <div>Bill</div>
                  <div className="text-right">Budget</div>
                  <div className="text-right">Actual</div>
                  <div className="text-right">Variance</div>
                </div>
                {budgetVsActualBills.length === 0 ? (
                  <div className="text-(--vn-muted)">No active bills for this period.</div>
                ) : (
                  <div className="mt-3 max-h-[65vh] space-y-3 overflow-auto pr-2">
                    {budgetVsActualBills.map((item) => {
                      const variance = formatVariance(item.variance, false);
                      const countLabel =
                        item.transactions.length === 1
                          ? "1 item"
                          : `${item.transactions.length} items`;
                      return (
                        <details key={item.id} className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) px-4 py-3">
                          <summary className="grid cursor-pointer list-none items-center gap-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
                            <div>
                              <div className="font-semibold text-(--vn-text)">{item.label}</div>
                              <div className="text-xs text-(--vn-muted)">{countLabel}</div>
                            </div>
                            <div className="flex items-center justify-between text-(--vn-muted) sm:block sm:text-right">
                              <span className="text-[10px] uppercase tracking-wide text-(--vn-muted) sm:hidden">
                                Budget
                              </span>
                              <span>{formatMoney(item.budgeted)}</span>
                            </div>
                            <div className="flex items-center justify-between text-(--vn-text) sm:block sm:text-right">
                              <span className="text-[10px] uppercase tracking-wide text-(--vn-muted) sm:hidden">
                                Actual
                              </span>
                              <span>{formatMoney(item.actual)}</span>
                            </div>
                            <div
                              className={`flex items-center justify-between font-semibold ${variance.tone} sm:block sm:text-right`}
                            >
                              <span className="text-[10px] uppercase tracking-wide text-(--vn-muted) sm:hidden">
                                Variance
                              </span>
                              <span>{variance.label}</span>
                            </div>
                            {item.budgeted > 0 && (
                              <div className="col-span-full mt-1 h-1.5 rounded-full overflow-hidden bg-(--vn-border)">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    item.actual > item.budgeted
                                      ? "bg-rose-500"
                                      : item.actual / item.budgeted > 0.8
                                        ? "bg-amber-400"
                                        : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${Math.min((item.actual / item.budgeted) * 100, 100)}%` }}
                                />
                              </div>
                            )}
                          </summary>
                          <div className="mt-3 border-t border-(--vn-border) pt-3 text-xs text-(--vn-muted)">
                            {item.transactions.length === 0 ? (
                              <div className="text-(--vn-muted)">No bill transactions recorded.</div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-(--vn-muted)">
                                  <span>Actual breakdown</span>
                                  <span>
                                    {item.transactions.length} item{item.transactions.length === 1 ? "" : "s"} -{" "}
                                    {formatMoney(item.actual)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-[96px_1fr_auto] gap-2 text-[10px] uppercase tracking-wide text-(--vn-muted)">
                                  <div>Date</div>
                                  <div>Details</div>
                                  <div className="text-right">Amount</div>
                                </div>
                                <div className="space-y-2">
                                  {item.transactions.map((txn) => (
                                    <div
                                      key={txn.id}
                                      className="grid grid-cols-[96px_1fr_auto] items-start gap-2 rounded-xl bg-(--vn-surface) px-3 py-2"
                                    >
                                      <div className="text-[11px] text-(--vn-muted)">{prettyDate(txn.date)}</div>
                                      <div>
                                        <div className="text-sm text-(--vn-text)">{txn.label}</div>
                                        {txn.notes ? (
                                          <div className="text-[11px] text-(--vn-muted)">{txn.notes}</div>
                                        ) : null}
                                      </div>
                                      <div className="text-right text-sm font-semibold text-(--vn-text)">
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
              <summary className="cursor-pointer text-sm font-semibold text-(--vn-text)">
                Budget vs actual by outflow
              </summary>
              <div className="mt-4 text-sm">
                <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr] gap-3 text-[11px] uppercase tracking-wide text-(--vn-muted) sm:grid">
                  <div>Outflow</div>
                  <div className="text-right">Budget</div>
                  <div className="text-right">Actual</div>
                  <div className="text-right">Variance</div>
                </div>
                {budgetVsActualOutflows.length === 0 ? (
                  <div className="text-(--vn-muted)">No outflow rules yet.</div>
                ) : (
                  <div className="mt-3 max-h-[65vh] space-y-3 overflow-auto pr-2">
                    {budgetVsActualOutflows.map((item) => {
                      const variance = formatVariance(item.variance, false);
                      const countLabel =
                        item.transactions.length === 1
                          ? "1 item"
                          : `${item.transactions.length} items`;
                      return (
                        <details key={item.id} className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) px-4 py-3">
                          <summary className="grid cursor-pointer list-none items-center gap-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
                            <div>
                              <div className="font-semibold text-(--vn-text)">{item.label}</div>
                              <div className="text-xs text-(--vn-muted)">{countLabel}</div>
                            </div>
                            <div className="flex items-center justify-between text-(--vn-muted) sm:block sm:text-right">
                              <span className="text-[10px] uppercase tracking-wide text-(--vn-muted) sm:hidden">
                                Budget
                              </span>
                              <span>{formatMoney(item.budgeted)}</span>
                            </div>
                            <div className="flex items-center justify-between text-(--vn-text) sm:block sm:text-right">
                              <span className="text-[10px] uppercase tracking-wide text-(--vn-muted) sm:hidden">
                                Actual
                              </span>
                              <span>{formatMoney(item.actual)}</span>
                            </div>
                            <div
                              className={`flex items-center justify-between font-semibold ${variance.tone} sm:block sm:text-right`}
                            >
                              <span className="text-[10px] uppercase tracking-wide text-(--vn-muted) sm:hidden">
                                Variance
                              </span>
                              <span>{variance.label}</span>
                            </div>
                            {item.budgeted > 0 && (
                              <div className="col-span-full mt-1 h-1.5 rounded-full overflow-hidden bg-(--vn-border)">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    item.actual > item.budgeted
                                      ? "bg-rose-500"
                                      : item.actual / item.budgeted > 0.8
                                        ? "bg-amber-400"
                                        : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${Math.min((item.actual / item.budgeted) * 100, 100)}%` }}
                                />
                              </div>
                            )}
                          </summary>
                          <div className="mt-3 border-t border-(--vn-border) pt-3 text-xs text-(--vn-muted)">
                            {item.transactions.length === 0 ? (
                              <div className="text-(--vn-muted)">No outflow transactions recorded.</div>
                            ) : (
                              <div className="space-y-2">
                                {item.transactions.map((txn) => (
                                  <div key={txn.id} className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="text-(--vn-text)">{txn.label}</div>
                                      <div className="text-[11px] text-(--vn-muted)">
                                        {prettyDate(txn.date)}
                                        {txn.notes ? ` - ${txn.notes}` : ""}
                                      </div>
                                    </div>
                                    <div className="font-semibold text-(--vn-text)">{formatMoney(txn.amount)}</div>
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
            <h2 className="text-lg font-semibold text-(--vn-text) mb-4">
              {editingBill ? "Edit Bill" : "Add Bill"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-(--vn-text) mb-1">
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
                <label className="block text-xs font-medium text-(--vn-text) mb-1">
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
                <label className="block text-xs font-medium text-(--vn-text) mb-1">
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
                <label className="block text-xs font-medium text-(--vn-text) mb-1">
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
                <label htmlFor="enabled" className="text-sm text-(--vn-text)">
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
            <h2 className="text-lg font-semibold text-(--vn-text) mb-4">
              {editingOutflow ? "Edit Outflow Rule" : "Add Outflow Rule"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-(--vn-text) mb-1">
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
                <label className="block text-xs font-medium text-(--vn-text) mb-1">
                  Amount ({getCurrencySymbol()}) *
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
                <label className="block text-xs font-medium text-(--vn-text) mb-1">
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
                <label className="block text-xs font-medium text-(--vn-text) mb-1">
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
                <label className="block text-xs font-medium text-(--vn-text) mb-1">
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
                <label htmlFor="outflow-enabled" className="text-sm text-(--vn-text)">
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



