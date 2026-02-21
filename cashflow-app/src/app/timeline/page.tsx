"use client";

import React, { useMemo, useState } from "react";
import { savePlan } from "@/lib/storage";
import { generateEvents, getStartingBalance } from "@/lib/cashflowEngine";
import SidebarNav from "@/components/SidebarNav";
import InfoTooltip from "@/components/InfoTooltip";
import type { CashflowCategory, CashflowType } from "@/data/plan";
import { useDerived } from "@/lib/useDerived";
import { formatMoney } from "@/lib/currency";
import { getDisplayLocale } from "@/lib/formatUtils";

function formatNice(iso: string) {
  const locale = getDisplayLocale();
  const d = new Date(iso + "T00:00:00");
  const weekday = d.toLocaleDateString(locale, { weekday: "short" });
  const day = d.toLocaleDateString(locale, { day: "2-digit" });
  const month = d.toLocaleDateString(locale, { month: "short" });
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
  const { state: plan, derived } = useDerived();
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventDraft, setEventDraft] = useState<{ date: string; amount: string } | null>(null);

  const period = derived.period;
  const periodOverride = useMemo(
    () => plan.periodOverrides.find((o) => o.periodId === plan.setup.selectedPeriodId),
    [plan]
  );
  const startingBalance = useMemo(
    () => getStartingBalance(plan, plan.setup.selectedPeriodId),
    [plan]
  );
  const rows = derived.cashflow.daily;
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

  const lowestPoint = derived.cashflow.lowest;
  const lowestBelowMin =
    plan.setup.expectedMinBalance > 0
      ? lowestPoint.balance < plan.setup.expectedMinBalance
      : lowestPoint.balance < 0;

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
    savePlan(next);
    cancelEditEvent();
  }

  function clearEventEdit(eventId: string) {
    const overrides = plan.eventOverrides.filter((o) => o.eventId !== eventId);
    const next = { ...plan, eventOverrides: overrides };
    savePlan(next);
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-28 pt-5">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />

          <section className="space-y-6">
            <header className="vn-card px-5 py-4 sm:p-6">
              <div className="text-xs uppercase tracking-wide text-[var(--vn-muted)]">Timeline</div>
              <h1 className="text-xl sm:text-2xl font-semibold text-[var(--vn-text)]">Cashflow Timeline</h1>
              <p className="mt-1 text-sm text-[var(--vn-muted)]">See your balance day by day.</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {period.label} ({formatNice(period.start)} - {formatNice(period.end)})
              </p>
            </header>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[var(--vn-surface)] border border-[var(--vn-border)] p-4 sm:p-5">
                <div className="flex items-center justify-between text-xs sm:text-sm text-[var(--vn-muted)]">
                  <span className="flex items-center">Starting balance<InfoTooltip text="Your account balance at the start of this period. When roll-forward is on, it carries over from the previous period automatically." /></span>
                  {plan.setup.rollForwardBalance && hasStartingOverride ? (
                    <button
                      onClick={clearStartingBalanceOverride}
                      className="text-xs text-[var(--vn-muted)] hover:text-[var(--vn-text)] min-h-[44px] flex items-center"
                    >
                      Use auto
                    </button>
                  ) : null}
                </div>
                <input
                  className="mt-2 w-full rounded-xl border border-[var(--vn-border)] bg-[var(--vn-surface)] px-2 py-1.5 sm:px-3 sm:py-2 text-base sm:text-lg text-[var(--vn-text)] outline-none focus:border-slate-400"
                  type="number"
                  value={startingBalance || ""}
                  onChange={(e) => updateStartingBalance(Number(e.target.value))}
                  placeholder="0"
                />
                <p className="mt-1.5 text-xs text-[var(--vn-muted)] leading-snug">
                  {plan.setup.rollForwardBalance
                    ? hasStartingOverride
                      ? "Custom for this period."
                      : "Auto from previous period."
                    : "Enter start balance."}
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--vn-surface)] border border-[var(--vn-border)] p-4 sm:p-5">
                <p className="text-xs sm:text-sm text-[var(--vn-muted)] flex items-center">Expected min.<InfoTooltip text="The safety net amount you want to keep in your account. Any day your projected balance dips below this will be flagged as a warning." /></p>
                <p className="mt-2 text-xl sm:text-2xl font-semibold text-[var(--vn-text)]">
                  {plan.setup.expectedMinBalance > 0
                    ? formatMoney(plan.setup.expectedMinBalance)
                    : <span className="text-[var(--vn-muted)]">Not set</span>}
                </p>
                <p className="mt-1.5 text-xs text-[var(--vn-muted)] leading-snug">
                  {plan.setup.expectedMinBalance > 0
                    ? "Flags days below this."
                    : "Set in Settings."}
                </p>
              </div>

              <div className="col-span-2 sm:col-span-1 rounded-2xl bg-[var(--vn-surface)] border border-[var(--vn-border)] p-3 sm:p-5 flex items-center justify-between sm:block gap-3">
                <p className="text-xs text-[var(--vn-muted)] shrink-0">Lowest point</p>
                <div className="flex items-baseline gap-2 flex-wrap justify-end sm:block">
                  <p
                    className={`text-lg sm:text-2xl font-semibold ${lowestBelowMin ? "text-rose-600" : "text-green-600"}`}
                  >
                    {lowestPoint ? formatMoney(lowestPoint.balance) : "0"}
                  </p>
                  <p className="text-xs text-[var(--vn-muted)] sm:mt-1">
                    {lowestPoint ? formatNice(lowestPoint.date) : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--vn-border)] overflow-hidden" style={{ background: "var(--vn-surface)" }}>
              {/* Header */}
              <div className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--vn-muted)]" style={{ background: "var(--vn-bg)" }}>
                <div>Date / Event</div>
                <div>Balance</div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto divide-y" style={{ borderColor: "var(--vn-border)" }}>
                {rows.map((r) => (
                  <div
                    key={r.date}
                    className="grid grid-cols-[1fr_auto] gap-x-3 items-center px-4 py-2.5"
                  >
                    {/* Left: date + label + amounts */}
                    <div className="min-w-0">
                      <div className="text-xs text-[var(--vn-muted)] whitespace-nowrap">{formatNice(r.date)}</div>
                      {r.label ? (
                        <div className="text-sm text-[var(--vn-text)] truncate leading-snug">{r.label}</div>
                      ) : null}
                      {(r.income || r.outflow) ? (
                        <div className="flex gap-2 mt-0.5">
                          {r.income ? (
                            <span className="text-xs font-medium text-emerald-600">+{formatMoney(r.income)}</span>
                          ) : null}
                          {r.outflow ? (
                            <span className="text-xs font-medium text-rose-500">−{formatMoney(r.outflow)}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {/* Right: balance */}
                    <div
                      className={`text-sm font-semibold whitespace-nowrap ${r.belowMin ? "text-rose-500" : "text-[var(--vn-muted)]"}`}
                    >
                      {formatMoney(r.balance)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <details className="vn-card p-6">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--vn-text)]">
                Edit scheduled events
              </summary>
              <div className="mt-4 space-y-3 text-sm">
                {editableEvents.length === 0 ? (
                  <div className="text-[var(--vn-muted)]">No scheduled events to edit.</div>
                ) : (
                  editableEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-[var(--vn-border)] bg-[var(--vn-surface)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-[var(--vn-text)]">{event.label}</div>
                          <div className="mt-1 text-xs text-[var(--vn-muted)]">
                            {event.type} • {event.category} • {formatNice(event.date)}
                            {event.overridden ? " • edited" : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditEvent(event)}
                            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-xs font-semibold text-[var(--vn-muted)] hover:text-[var(--vn-text)] transition-colors"
                          >
                            Edit
                          </button>
                          {event.overridden ? (
                            <button
                              onClick={() => clearEventEdit(event.id)}
                              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-xs font-semibold text-[var(--vn-muted)] hover:text-rose-600 transition-colors"
                            >
                              Reset
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {editingEventId === event.id && eventDraft ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                          <div>
                            <label className="text-xs font-semibold text-[var(--vn-muted)]">Date</label>
                            <input
                              type="date"
                              min={period.start}
                              max={period.end}
                              value={eventDraft.date}
                              onChange={(e) =>
                                setEventDraft({ ...eventDraft, date: e.target.value })
                              }
                              className="mt-1 w-full rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)]"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-[var(--vn-muted)]">
                              Amount
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={eventDraft.amount || ""}
                              onChange={(e) =>
                                setEventDraft({ ...eventDraft, amount: e.target.value })
                              }
                              className="mt-1 w-full rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)]"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="flex items-end gap-2 sm:col-span-1">
                            <button
                              onClick={saveEventEdit}
                              className="flex-1 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs min-h-[44px] font-semibold text-white shadow hover:bg-[var(--accent-deep)]"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditEvent}
                              className="flex-1 rounded-xl border border-[var(--vn-border)] px-3 py-2 text-xs min-h-[44px] font-semibold text-[var(--vn-muted)] hover:bg-[var(--vn-bg)]"
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

            <p className="text-xs text-[var(--vn-muted)]">
              Edit rules and bills in Settings. Timeline recalculates for the selected period.
            </p>
          </section>
        </div>
      </div>

    </main>
  );
}


