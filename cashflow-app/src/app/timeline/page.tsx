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
            <header className="vn-card p-6">
              <div className="text-xs uppercase tracking-wide text-[var(--vn-muted)]">Timeline</div>
              <h1 className="text-2xl font-semibold text-[var(--vn-text)]">Cashflow Timeline</h1>
              <p className="mt-2 text-sm text-[var(--vn-muted)]">See your balance day by day.</p>
              <p className="mt-1 text-xs text-slate-400">
                {period.label} ({formatNice(period.start)} - {formatNice(period.end)})
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="rounded-2xl bg-[var(--vn-surface)] border border-[var(--vn-border)] p-5">
                <div className="flex items-center justify-between text-sm text-[var(--vn-muted)]">
                  <span className="flex items-center">Starting balance<InfoTooltip text="Your account balance at the start of this period. When roll-forward is on, it carries over from the previous period automatically." /></span>
                  {plan.setup.rollForwardBalance && hasStartingOverride ? (
                    <button
                      onClick={clearStartingBalanceOverride}
                      className="text-xs text-[var(--vn-muted)] hover:text-[var(--vn-text)]"
                    >
                      Use auto
                    </button>
                  ) : null}
                </div>
                <input
                  className="mt-2 w-full rounded-xl border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-lg text-[var(--vn-text)] outline-none focus:border-slate-400"
                  type="number"
                  value={startingBalance || ""}
                  onChange={(e) => updateStartingBalance(Number(e.target.value))}
                  placeholder="0"
                />
                <p className="mt-2 text-xs text-[var(--vn-muted)]">
                  {plan.setup.rollForwardBalance
                    ? hasStartingOverride
                      ? "Custom for this period."
                      : "Auto from previous period. Editing sets a custom value."
                    : "Enter what you had at the start of the period."}
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--vn-surface)] border border-[var(--vn-border)] p-5">
                <p className="text-sm text-[var(--vn-muted)] flex items-center">Expected minimum balance<InfoTooltip text="The safety net amount you want to keep in your account. Any day your projected balance dips below this will be flagged as a warning." /></p>
                <p className="mt-2 text-2xl font-semibold text-[var(--vn-text)]">
                  {plan.setup.expectedMinBalance > 0
                    ? formatMoney(plan.setup.expectedMinBalance)
                    : <span className="text-[var(--vn-muted)]">Not set</span>}
                </p>
                <p className="mt-2 text-xs text-[var(--vn-muted)]">
                  {plan.setup.expectedMinBalance > 0
                    ? "We flag any day that drops below this."
                    : "Set an expected minimum balance in Settings to flag risky days."}
                </p>
              </div>

              <div className="rounded-2xl bg-[var(--vn-surface)] border border-[var(--vn-border)] p-5">
                <p className="text-sm text-[var(--vn-muted)]">Lowest point (period)</p>
                <p
                  className={`mt-2 text-2xl font-semibold ${lowestBelowMin ? "text-rose-600" : "text-green-600"}`}
                >
                  {lowestPoint ? formatMoney(lowestPoint.balance) : "0"}
                </p>
                <p className="mt-2 text-xs text-[var(--vn-muted)]">
                  {lowestPoint ? `On ${formatNice(lowestPoint.date)}` : ""}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--vn-border)] overflow-hidden" style={{ background: "var(--vn-surface)" }}>
              <div className="overflow-x-auto">
                <div className="min-w-[480px]">
                  <div className="grid grid-cols-5 gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--vn-muted)]" style={{ background: "var(--vn-bg)" }}>
                    <div>Date</div>
                    <div className="col-span-2">Label</div>
                    <div className="text-right">Income</div>
                    <div className="text-right">Outflow</div>
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto">
                    {rows.map((r) => (
                      <div
                        key={r.date}
                        className="grid grid-cols-5 gap-2 border-t px-4 py-3 text-sm"
                        style={{ borderTopColor: "var(--vn-border)", color: "var(--vn-text)" }}
                      >
                        <div className="text-[var(--vn-muted)] whitespace-nowrap">{formatNice(r.date)}</div>
                        <div className="col-span-2 text-[var(--vn-muted)] truncate">{r.label || ""}</div>
                        <div className="text-right font-medium">{r.income ? formatMoney(r.income) : ""}</div>
                        <div className="text-right font-medium">{r.outflow ? formatMoney(r.outflow) : ""}</div>

                        <div
                          className={`col-span-5 text-right text-xs font-bold mt-0.5 ${r.belowMin ? "text-rose-500" : "text-[var(--vn-muted)]"}`}
                        >
                          Balance {formatMoney(r.balance)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEditEvent(event)}
                            className="text-xs font-semibold text-[var(--vn-muted)] hover:text-[var(--vn-text)]"
                          >
                            Edit
                          </button>
                          {event.overridden ? (
                            <button
                              onClick={() => clearEventEdit(event.id)}
                              className="text-xs font-semibold text-[var(--vn-muted)] hover:text-rose-600"
                            >
                              Reset
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {editingEventId === event.id && eventDraft ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
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
                          <div className="flex items-end gap-2">
                            <button
                              onClick={saveEventEdit}
                              className="w-full rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow hover:bg-[var(--accent-deep)]"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditEvent}
                              className="w-full rounded-xl border border-[var(--vn-border)] px-3 py-2 text-xs font-semibold text-[var(--vn-muted)] hover:bg-[var(--vn-bg)]"
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


