"use client";

import React, { useEffect, useMemo, useState } from "react";
import { loadPlan, savePlan } from "@/lib/storage";
import {
  buildTimeline,
  generateEvents,
  getPeriod,
  getStartingBalance,
  minPoint,
} from "@/lib/cashflowEngine";
import SidebarNav from "@/components/SidebarNav";
import type { CashflowCategory, CashflowType } from "@/data/plan";

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

function formatNice(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  return `${weekday} ${day} ${month}`;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

type EditableEvent = {
  id: string;
  label: string;
  type: CashflowType;
  category: CashflowCategory;
  baseDate: string;
  baseAmount: number;
  date: string;
  amount: number;
  overridden: boolean;
};

export default function TimelinePage() {
  const [plan, setPlan] = useState(() => loadPlan());
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventDraft, setEventDraft] = useState<{ date: string; amount: string } | null>(null);

  useEffect(() => {
    const onFocus = () => setPlan(loadPlan());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const period = useMemo(() => getPeriod(plan, plan.setup.selectedPeriodId), [plan]);
  const periodOverride = useMemo(
    () => plan.periodOverrides.find((o) => o.periodId === plan.setup.selectedPeriodId),
    [plan]
  );
  const startingBalance = useMemo(
    () => getStartingBalance(plan, plan.setup.selectedPeriodId),
    [plan]
  );
  const rows = useMemo(
    () => buildTimeline(plan, plan.setup.selectedPeriodId, startingBalance),
    [plan, startingBalance]
  );
  const baseEvents = useMemo(() => {
    const stripped = { ...plan, eventOverrides: [] };
    return generateEvents(stripped, plan.setup.selectedPeriodId);
  }, [plan]);
  const editableEvents = useMemo(() => {
    const overrideMap = new Map(plan.eventOverrides.map((o) => [o.eventId, o]));
    return baseEvents
      .filter((event) => event.sourceId)
      .map((event) => {
        const override = overrideMap.get(event.id);
        const nextDate = override?.date ?? event.date;
        const nextAmount =
          typeof override?.amount === "number" ? override.amount : event.amount;
        return {
          id: event.id,
          label: event.label,
          type: event.type,
          category: event.category,
          baseDate: event.date,
          baseAmount: event.amount,
          date: nextDate,
          amount: nextAmount,
          overridden: Boolean(override),
        };
      })
      .sort((a, b) => {
        if (a.date === b.date) return a.label.localeCompare(b.label);
        return a.date.localeCompare(b.date);
      });
  }, [baseEvents, plan.eventOverrides]);
  const hasStartingOverride = typeof periodOverride?.startingBalance === "number";

  const expectedMin = useMemo(() => {
    if (rows.length === 0) return plan.setup.expectedMinBalance;
    return Math.min(...rows.map((r) => r.balance));
  }, [rows, plan.setup.expectedMinBalance]);

  const lowestPoint = useMemo(() => minPoint(rows), [rows]);

  function updateStartingBalance(value: number) {
    let next = plan;

    if (plan.setup.rollForwardBalance) {
      const overrides = [...plan.periodOverrides];
      const idx = overrides.findIndex((o) => o.periodId === plan.setup.selectedPeriodId);
      if (idx >= 0) {
        overrides[idx] = { ...overrides[idx], startingBalance: value };
      } else {
        overrides.push({ periodId: plan.setup.selectedPeriodId, startingBalance: value });
      }
      next = { ...plan, periodOverrides: overrides };
    } else {
      next = { ...plan, setup: { ...plan.setup, startingBalance: value } };
    }

    setPlan(next);
    savePlan(next);
  }

  function clearStartingBalanceOverride() {
    const overrides = [...plan.periodOverrides];
    const idx = overrides.findIndex((o) => o.periodId === plan.setup.selectedPeriodId);
    if (idx < 0) return;

    const current = overrides[idx];
    if (current.disabledBills && current.disabledBills.length > 0) {
      overrides[idx] = { periodId: current.periodId, disabledBills: current.disabledBills };
    } else {
      overrides.splice(idx, 1);
    }

    const next = { ...plan, periodOverrides: overrides };
    setPlan(next);
    savePlan(next);
  }

  function startEditEvent(event: EditableEvent) {
    setEditingEventId(event.id);
    setEventDraft({ date: event.date, amount: String(event.amount) });
  }

  function cancelEditEvent() {
    setEditingEventId(null);
    setEventDraft(null);
  }

  function saveEventEdit() {
    if (!editingEventId || !eventDraft) return;
    const target = editableEvents.find((event) => event.id === editingEventId);
    if (!target) return;

    const amount = parseFloat(eventDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (eventDraft.date < period.start || eventDraft.date > period.end) return;

    const changed =
      eventDraft.date !== target.baseDate || amount !== target.baseAmount;

    const overrides = [...plan.eventOverrides];
    const idx = overrides.findIndex((o) => o.eventId === target.id);
    if (!changed) {
      if (idx >= 0) overrides.splice(idx, 1);
    } else if (idx >= 0) {
      overrides[idx] = { ...overrides[idx], date: eventDraft.date, amount: amount };
    } else {
      overrides.push({
        id: makeId("event"),
        eventId: target.id,
        date: eventDraft.date,
        amount: amount,
      });
    }

    const next = { ...plan, eventOverrides: overrides };
    setPlan(next);
    savePlan(next);
    cancelEditEvent();
  }

  function clearEventEdit(eventId: string) {
    const overrides = plan.eventOverrides.filter((o) => o.eventId !== eventId);
    const next = { ...plan, eventOverrides: overrides };
    setPlan(next);
    savePlan(next);
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 pb-28 pt-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

          <section className="space-y-6">
            <header className="vn-card p-6">
              <div className="text-xs uppercase tracking-wide text-slate-500">Timeline</div>
              <h1 className="text-2xl font-semibold text-slate-900">Cashflow Timeline</h1>
              <p className="mt-2 text-sm text-slate-500">See your balance day by day.</p>
              <p className="mt-1 text-xs text-slate-400">
                {period.label} ({formatNice(period.start)} - {formatNice(period.end)})
              </p>
            </header>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-[var(--surface)] p-5 shadow-xl">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Starting balance</span>
                  {plan.setup.rollForwardBalance && hasStartingOverride ? (
                    <button
                      onClick={clearStartingBalanceOverride}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Use auto
                    </button>
                  ) : null}
                </div>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-lg text-slate-900 outline-none focus:border-slate-400"
                  type="number"
                  value={startingBalance}
                  onChange={(e) => updateStartingBalance(Number(e.target.value || 0))}
                  placeholder="0"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {plan.setup.rollForwardBalance
                    ? hasStartingOverride
                      ? "Custom for this period."
                      : "Auto from previous period. Editing sets a custom value."
                    : "Enter what you had at the start of the period."}
                </p>
              </div>

              <div className="rounded-3xl bg-[var(--surface)] p-5 shadow-xl">
                <p className="text-sm text-slate-500">Expected minimum balance</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {gbp(plan.setup.expectedMinBalance)}
                </p>
                <p className="mt-2 text-xs text-slate-500">We flag any day that drops below this.</p>
              </div>

              <div className="rounded-3xl bg-[var(--surface)] p-5 shadow-xl">
                <p className="text-sm text-slate-500">Lowest point (period)</p>
                <p
                  className={`mt-2 text-2xl font-semibold ${
                    expectedMin < plan.setup.expectedMinBalance ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {lowestPoint ? gbp(lowestPoint.balance) : "0"}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {lowestPoint ? `On ${formatNice(lowestPoint.date)}` : ""}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl bg-[var(--surface)] shadow-xl">
              <div className="grid grid-cols-5 gap-2 bg-slate-100 px-4 py-3 text-xs text-slate-500">
                <div>Date</div>
                <div className="col-span-2">Label</div>
                <div className="text-right">Income</div>
                <div className="text-right">Outflow</div>
              </div>

              <div className="max-h-[60vh] overflow-auto">
                {rows.map((r) => (
                  <div
                    key={r.date}
                    className="grid grid-cols-5 gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-600"
                  >
                    <div className="text-slate-700">{formatNice(r.date)}</div>
                    <div className="col-span-2 text-slate-500">{r.label || ""}</div>
                    <div className="text-right">{r.income ? gbp(r.income) : "0"}</div>
                    <div className="text-right">{r.outflow ? gbp(r.outflow) : "0"}</div>

                    <div
                      className={`col-span-5 mt-1 text-right text-sm font-semibold ${
                        r.warning ? "text-rose-600" : "text-slate-800"
                      }`}
                    >
                      Balance: {gbp(r.balance)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <details className="vn-card p-6">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                Edit scheduled events
              </summary>
              <div className="mt-4 space-y-3 text-sm">
                {editableEvents.length === 0 ? (
                  <div className="text-slate-500">No scheduled events to edit.</div>
                ) : (
                  editableEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-200 bg-white/70 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{event.label}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {event.type} • {event.category} • {formatNice(event.date)}
                            {event.overridden ? " • edited" : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEditEvent(event)}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                          >
                            Edit
                          </button>
                          {event.overridden ? (
                            <button
                              onClick={() => clearEventEdit(event.id)}
                              className="text-xs font-semibold text-slate-500 hover:text-rose-600"
                            >
                              Reset
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {editingEventId === event.id && eventDraft ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Date</label>
                            <input
                              type="date"
                              min={period.start}
                              max={period.end}
                              value={eventDraft.date}
                              onChange={(e) =>
                                setEventDraft({ ...eventDraft, date: e.target.value })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-600">
                              Amount (GBP)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={eventDraft.amount}
                              onChange={(e) =>
                                setEventDraft({ ...eventDraft, amount: e.target.value })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900"
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <button
                              onClick={saveEventEdit}
                              className="w-full rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow hover:bg-[var(--accent-deep)]"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditEvent}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </details>

            <p className="text-xs text-slate-500">
              Edit rules and bills in Settings. Timeline recalculates for the selected period.
            </p>
          </section>
        </div>
      </div>

    </main>
  );
}
