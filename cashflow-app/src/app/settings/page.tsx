"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SidebarNav from "@/components/SidebarNav";
import ThemeToggle from "@/components/ThemeToggle";
import CurrencySelector from "@/components/CurrencySelector";
import { loadPlan, savePlan, PLAN_UPDATED_EVENT } from "@/lib/storage";
import { formatMoney } from "@/lib/currency";
import { resetWizard } from "@/lib/onboarding";
import { loadBranding } from "@/lib/branding";
import { useAuth } from "@/contexts/AuthContext";
import type { Period, PeriodOverride, PeriodRuleOverride } from "@/data/plan";

export default function SettingsPage() {
  const [plan, setPlan] = useState(() => loadPlan());
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [periodFormData, setPeriodFormData] = useState<Partial<Period>>({
    label: "",
    start: "",
    end: "",
  });
  const [branding] = useState(() => loadBranding());
  const { user, loading: authLoading, signOut } = useAuth();

  useEffect(() => {
    const refresh = () => setPlan(loadPlan());
    window.addEventListener("focus", refresh);
    window.addEventListener(PLAN_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(PLAN_UPDATED_EVENT, refresh);
    };
  }, []);

  function handleAddPeriod() {
    setEditingPeriod(null);
    setPeriodFormData({
      label: "",
      start: "",
      end: "",
    });
    setShowPeriodModal(true);
  }

  function handleEditPeriod(period: Period) {
    setEditingPeriod(period);
    setPeriodFormData(period);
    setShowPeriodModal(true);
  }

  function handleDeletePeriod(periodId: number) {
    if (!confirm("Are you sure you want to delete this period? This will also remove any overrides for this period.")) return;

    const updated = {
      ...plan,
      periods: plan.periods.filter((p) => p.id !== periodId),
      periodOverrides: plan.periodOverrides.filter((o) => o.periodId !== periodId),
      periodRuleOverrides: plan.periodRuleOverrides.filter((o) => o.periodId !== periodId),
    };

    // If deleting the selected period, switch to first available period
    if (plan.setup.selectedPeriodId === periodId && updated.periods.length > 0) {
      updated.setup.selectedPeriodId = updated.periods[0].id;
    }

    savePlan(updated);
    setPlan(updated);
  }

  function handleSavePeriod() {
    if (!periodFormData.label || !periodFormData.start || !periodFormData.end) {
      alert("Please fill in all fields");
      return;
    }

    const periodData: Period = {
      id: editingPeriod?.id || Math.max(0, ...plan.periods.map((p) => p.id)) + 1,
      label: periodFormData.label!,
      start: periodFormData.start!,
      end: periodFormData.end!,
    };

    const updated = editingPeriod
      ? { ...plan, periods: plan.periods.map((p) => (p.id === editingPeriod.id ? periodData : p)) }
      : { ...plan, periods: [...plan.periods, periodData].sort((a, b) => a.start.localeCompare(b.start)) };

    savePlan(updated);
    setPlan(updated);
    setShowPeriodModal(false);
  }

  function handleToggleBillForPeriod(periodId: number, billId: string) {
    const override = plan.periodOverrides.find((o) => o.periodId === periodId);
    const disabledBills = override?.disabledBills || [];

    const newDisabledBills = disabledBills.includes(billId)
      ? disabledBills.filter((id) => id !== billId)
      : [...disabledBills, billId];

    const updated = {
      ...plan,
      periodOverrides: override
        ? plan.periodOverrides.map((o) =>
          o.periodId === periodId ? { ...o, disabledBills: newDisabledBills } : o
        )
        : [...plan.periodOverrides, { periodId, disabledBills: newDisabledBills }],
    };

    savePlan(updated);
    setPlan(updated);
  }

  function handleSetStartingBalance(periodId: number, balance: number | undefined) {
    const override = plan.periodOverrides.find((o) => o.periodId === periodId);

    const updated = {
      ...plan,
      periodOverrides: override
        ? plan.periodOverrides.map((o) =>
          o.periodId === periodId ? { ...o, startingBalance: balance } : o
        )
        : [...plan.periodOverrides, { periodId, startingBalance: balance }],
    };

    savePlan(updated);
    setPlan(updated);
  }

  function handleToggleRuleForPeriod(periodId: number, ruleId: string, type: "income" | "outflow") {
    const existingOverride = plan.periodRuleOverrides.find(
      (o) => o.periodId === periodId && o.ruleId === ruleId && o.type === type
    );

    const updated = {
      ...plan,
      periodRuleOverrides: existingOverride
        ? plan.periodRuleOverrides.map((o) =>
          o.periodId === periodId && o.ruleId === ruleId && o.type === type
            ? { ...o, enabled: !(o.enabled ?? true) }
            : o
        )
        : [
          ...plan.periodRuleOverrides,
          { periodId, ruleId, type, enabled: false },
        ],
    };

    savePlan(updated);
    setPlan(updated);
  }

  function getPeriodOverride(periodId: number): PeriodOverride | undefined {
    return plan.periodOverrides.find((o) => o.periodId === periodId);
  }

  function getRuleOverride(periodId: number, ruleId: string, type: "income" | "outflow"): PeriodRuleOverride | undefined {
    return plan.periodRuleOverrides.find(
      (o) => o.periodId === periodId && o.ruleId === ruleId && o.type === type
    );
  }

  function handleSetAsOfDate(date: string) {
    const updated = { ...plan, setup: { ...plan.setup, asOfDate: date } };
    savePlan(updated);
    setPlan(updated);
  }

  function handleSetToToday() {
    const today = new Date().toISOString().slice(0, 10);
    handleSetAsOfDate(today);
  }

  function handleToggleAutoUpdate() {
    const updated = {
      ...plan,
      setup: { ...plan.setup, autoUpdateAsOfDate: !(plan.setup.autoUpdateAsOfDate ?? true) },
    };
    savePlan(updated);
    setPlan(updated);
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-28 pt-5">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav />
          <section className="space-y-6">
            <div className="rounded-3xl bg-[var(--surface)] dark:bg-slate-800 p-6 shadow-xl">
              <div className="text-xs uppercase tracking-wide text-[var(--vn-muted)]">Settings</div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">App Settings</h1>
              <div className="mt-2 text-sm text-[var(--vn-muted)]">
                Customize your {branding.name} experience
              </div>
            </div>

            {/* Account */}
            <div className="rounded-3xl bg-[var(--surface)] dark:bg-slate-800 p-6 shadow-xl">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Account</div>
              {authLoading ? (
                <div className="text-sm text-[var(--vn-muted)]">Loading...</div>
              ) : user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--vn-primary)]/15 text-[var(--vn-primary)] font-semibold text-sm">
                      {(user.email?.[0] ?? "U").toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{user.email}</div>
                      <div className="text-xs text-[var(--vn-muted)]">Signed in · Cloud sync active</div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await signOut();
                      window.location.href = "/";
                    }}
                    className="vn-btn vn-btn-ghost text-xs text-red-500"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-[var(--vn-muted)]">
                    Sign in to back up your data to the cloud and sync across devices.
                  </div>
                  <Link
                    href="/auth"
                    className="vn-btn vn-btn-primary text-sm inline-block text-center"
                  >
                    Sign In
                  </Link>
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-[var(--surface)] dark:bg-slate-800 p-6 shadow-xl">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Appearance</div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Dark Mode</div>
                    <div className="text-xs text-[var(--vn-muted)]">Toggle between light and dark themes</div>
                  </div>
                  <ThemeToggle />
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-[var(--surface)] dark:bg-slate-800 p-6 shadow-xl">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Regional Settings</div>
              <CurrencySelector />
            </div>

            <div className="rounded-3xl bg-[var(--surface)] dark:bg-slate-800 p-6 shadow-xl">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">As of Date</div>
              <div className="text-xs text-[var(--vn-muted)] mb-4">
                Controls the reference date for filtering transactions and calculating time progress
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Current As of Date
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={plan.setup.asOfDate}
                      onChange={(e) => handleSetAsOfDate(e.target.value)}
                      className="vn-input text-sm flex-1 min-w-[160px]"
                    />
                    <button
                      onClick={handleSetToToday}
                      className="vn-btn vn-btn-primary text-xs px-3 py-2 min-h-[44px] shrink-0"
                    >
                      Set to Today
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto-update-date"
                    checked={plan.setup.autoUpdateAsOfDate ?? true}
                    onChange={handleToggleAutoUpdate}
                    className="rounded"
                  />
                  <label htmlFor="auto-update-date" className="text-sm text-slate-700 dark:text-slate-300">
                    Auto-update to today on app load (recommended)
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-[var(--surface)] dark:bg-slate-800 p-6 shadow-xl">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Expected Minimum Balance</div>
              <div className="text-xs text-[var(--vn-muted)] mb-4">
                Your safety-net balance. Any day your projected balance dips below this amount will be flagged as a warning on the Timeline and Dashboard.
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={plan.setup.expectedMinBalance || ""}
                  onChange={(e) => {
                    const val = e.target.value !== "" ? Number(e.target.value) : 0;
                    const updated = { ...plan, setup: { ...plan.setup, expectedMinBalance: val } };
                    savePlan(updated);
                    setPlan(updated);
                  }}
                  className="vn-input text-sm flex-1"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
                {plan.setup.expectedMinBalance > 0 && (
                  <button
                    onClick={() => {
                      const updated = { ...plan, setup: { ...plan.setup, expectedMinBalance: 0 } };
                      savePlan(updated);
                      setPlan(updated);
                    }}
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                  >
                    Clear
                  </button>
                )}
              </div>
              {plan.setup.expectedMinBalance > 0 && (
                <div className="mt-2 text-xs text-[var(--vn-muted)]">
                  Currently set to {formatMoney(plan.setup.expectedMinBalance)}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-[var(--surface)] dark:bg-slate-800 p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Periods</div>
                <button
                  onClick={handleAddPeriod}
                  className="vn-btn vn-btn-primary text-xs px-3 py-1.5"
                >
                  + Add Period
                </button>
              </div>
              <div className="space-y-3">
                {plan.periods.length === 0 ? (
                  <div className="text-[var(--vn-muted)] text-xs">No periods yet. Add one to get started.</div>
                ) : (
                  plan.periods.map((period) => (
                    <div
                      key={period.id}
                      className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg ${period.id === plan.setup.selectedPeriodId
                        ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                        : "bg-white/70 dark:bg-slate-700/70 border border-slate-200 dark:border-slate-600"
                        }`}
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {period.label}
                          {period.id === plan.setup.selectedPeriodId && (
                            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Active)</span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--vn-muted)]">
                          {period.start} to {period.end}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditPeriod(period)}
                          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePeriod(period.id)}
                          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          disabled={plan.periods.length === 1}
                          title={plan.periods.length === 1 ? "Cannot delete the last period" : "Delete period"}
                        >
                          Del
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-[var(--surface)] dark:bg-slate-800 p-6 shadow-xl">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Period Overrides</div>
              <div className="text-xs text-[var(--vn-muted)] mb-4">
                Customize specific periods without affecting base rules
              </div>

              {plan.periods.length === 0 ? (
                <div className="text-[var(--vn-muted)] text-xs">Add periods first to manage overrides.</div>
              ) : (
                <div className="space-y-4">
                  {plan.periods.map((period) => {
                    const override = getPeriodOverride(period.id);
                    const disabledBills = override?.disabledBills || [];
                    const hasOverrides = disabledBills.length > 0 || override?.startingBalance !== undefined ||
                      plan.periodRuleOverrides.some((o) => o.periodId === period.id);

                    return (
                      <details key={period.id} className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-700/70 px-4 py-3">
                        <summary className="cursor-pointer font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                          <span>
                            {period.label}
                            {hasOverrides && (
                              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(Has overrides)</span>
                            )}
                          </span>
                        </summary>

                        <div className="mt-4 space-y-4">
                          {/* Starting Balance Override */}
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                              Starting Balance Override
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={override?.startingBalance ?? ""}
                                onChange={(e) =>
                                  handleSetStartingBalance(
                                    period.id,
                                    e.target.value !== "" ? Number(e.target.value) : undefined
                                  )
                                }
                                className="vn-input text-sm flex-1"
                                placeholder="Leave empty to use default"
                                step="0.01"
                              />
                              {override?.startingBalance !== undefined && (
                                <button
                                  onClick={() => handleSetStartingBalance(period.id, undefined)}
                                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Disabled Bills */}
                          {plan.bills.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Disabled Bills for this Period
                              </div>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {plan.bills.map((bill) => {
                                  const isDisabled = disabledBills.includes(bill.id);
                                  return (
                                    <div key={bill.id} className="flex items-center gap-2 p-2 rounded bg-white/50 dark:bg-slate-600/50">
                                      <input
                                        type="checkbox"
                                        id={`bill-${period.id}-${bill.id}`}
                                        checked={isDisabled}
                                        onChange={() => handleToggleBillForPeriod(period.id, bill.id)}
                                        className="rounded"
                                      />
                                      <label
                                        htmlFor={`bill-${period.id}-${bill.id}`}
                                        className="text-xs text-slate-700 dark:text-slate-300 flex-1 cursor-pointer"
                                      >
                                        {bill.label} ({formatMoney(bill.amount)})
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Income Rule Overrides */}
                          {plan.incomeRules.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Disabled Income Rules for this Period
                              </div>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {plan.incomeRules.map((rule) => {
                                  const ruleOverride = getRuleOverride(period.id, rule.id, "income");
                                  const isDisabled = ruleOverride?.enabled === false;
                                  return (
                                    <div key={rule.id} className="flex items-center gap-2 p-2 rounded bg-white/50 dark:bg-slate-600/50">
                                      <input
                                        type="checkbox"
                                        id={`income-${period.id}-${rule.id}`}
                                        checked={isDisabled}
                                        onChange={() => handleToggleRuleForPeriod(period.id, rule.id, "income")}
                                        className="rounded"
                                      />
                                      <label
                                        htmlFor={`income-${period.id}-${rule.id}`}
                                        className="text-xs text-slate-700 dark:text-slate-300 flex-1 cursor-pointer"
                                      >
                                        {rule.label} ({formatMoney(rule.amount)} {rule.cadence})
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Outflow Rule Overrides */}
                          {plan.outflowRules.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Disabled Outflow Rules for this Period
                              </div>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {plan.outflowRules.map((rule) => {
                                  const ruleOverride = getRuleOverride(period.id, rule.id, "outflow");
                                  const isDisabled = ruleOverride?.enabled === false;
                                  return (
                                    <div key={rule.id} className="flex items-center gap-2 p-2 rounded bg-white/50 dark:bg-slate-600/50">
                                      <input
                                        type="checkbox"
                                        id={`outflow-${period.id}-${rule.id}`}
                                        checked={isDisabled}
                                        onChange={() => handleToggleRuleForPeriod(period.id, rule.id, "outflow")}
                                        className="rounded"
                                      />
                                      <label
                                        htmlFor={`outflow-${period.id}-${rule.id}`}
                                        className="text-xs text-slate-700 dark:text-slate-300 flex-1 cursor-pointer"
                                      >
                                        {rule.label} ({formatMoney(rule.amount)} {rule.cadence})
                                      </label>
                                    </div>
                                  );
                                })}
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

            <div className="rounded-3xl bg-[var(--surface)] dark:bg-slate-800 p-6 shadow-xl">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">About</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--vn-muted)]">Version</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">1.0.1 (Build {(process.env.NEXT_PUBLIC_BUILD_TIME ?? new Date().toISOString()).slice(0, 16).replace("T", " ")})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--vn-muted)]">App Name</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{branding.name}</span>
                </div>
              </div>
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--vn-border)" }}>
                <button
                  onClick={() => {
                    resetWizard();
                    window.location.href = "/";
                  }}
                  className="vn-btn vn-btn-ghost text-xs"
                >
                  Replay onboarding guide
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {showPeriodModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowPeriodModal(false)}
        >
          <div
            className="vn-card max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              {editingPeriod ? "Edit Period" : "Add Period"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Label *
                </label>
                <input
                  type="text"
                  value={periodFormData.label || ""}
                  onChange={(e) => setPeriodFormData({ ...periodFormData, label: e.target.value })}
                  className="vn-input text-sm"
                  placeholder="e.g., P1: 22 Dec 2025-25 Jan 2026"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={periodFormData.start || ""}
                  onChange={(e) => setPeriodFormData({ ...periodFormData, start: e.target.value })}
                  className="vn-input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  value={periodFormData.end || ""}
                  onChange={(e) => setPeriodFormData({ ...periodFormData, end: e.target.value })}
                  className="vn-input text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSavePeriod}
                className="vn-btn vn-btn-primary flex-1"
              >
                {editingPeriod ? "Save Changes" : "Add Period"}
              </button>
              <button
                onClick={() => setShowPeriodModal(false)}
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
