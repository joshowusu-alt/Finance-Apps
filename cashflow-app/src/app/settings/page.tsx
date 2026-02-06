"use client";

import { useEffect, useState } from "react";
import SidebarNav from "@/components/SidebarNav";
import ThemeToggle from "@/components/ThemeToggle";
import CurrencySelector from "@/components/CurrencySelector";
import { loadPlan, savePlan, PLAN_UPDATED_EVENT } from "@/lib/storage";
import type { Period } from "@/data/plan";

export default function SettingsPage() {
  const [plan, setPlan] = useState(() => loadPlan());
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [periodFormData, setPeriodFormData] = useState<Partial<Period>>({
    label: "",
    start: "",
    end: "",
  });

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

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 pb-28 pt-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav />
          <section className="space-y-6">
            <div className="rounded-3xl bg-[var(--surface)] dark:bg-slate-800 p-6 shadow-xl">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Settings</div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">App Settings</h1>
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Customize your Velanovo experience</div>
            </div>

            <div className="rounded-3xl bg-[var(--surface)] dark:bg-slate-800 p-6 shadow-xl">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Appearance</div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">Dark Mode</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Toggle between light and dark themes</div>
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
                  <div className="text-slate-500 dark:text-slate-400 text-xs">No periods yet. Add one to get started.</div>
                ) : (
                  plan.periods.map((period) => (
                    <div
                      key={period.id}
                      className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg ${
                        period.id === plan.setup.selectedPeriodId
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
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {period.start} to {period.end}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditPeriod(period)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePeriod(period.id)}
                          className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
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
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">About</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Version</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">App Name</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">Velanovo</span>
                </div>
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
