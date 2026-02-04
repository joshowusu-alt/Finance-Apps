"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BillTemplate,
  CashflowOverride,
  CashflowType,
  CashflowCategory,
  IncomeRule,
  OutflowRule,
  Plan,
  PLAN,
  Recurrence,
} from "@/data/plan";
import {
  loadPlan,
  savePlan,
  resetPlan,
  loadPreviousPlan,
  undoLastPlanChange,
  loadAuditTrail,
  clearAuditTrail,
  getAuditActor,
  setAuditActor,
  AUDIT_UPDATED_EVENT,
  loadScenarioState,
  setActiveScenario,
  createScenario,
  renameScenario,
  deleteScenario,
  ScenarioState,
  type AuditEntry,
} from "@/lib/storage";
import { loadAlertPreferences, saveAlertPreferences, type AlertPreferences } from "@/lib/alerts";
import { generateEvents } from "@/lib/cashflowEngine";
import { downloadPlanPdf, downloadPlanTemplate, downloadPlanXlsx, importPlanFromFile } from "@/lib/planIo";
import SidebarNav from "@/components/SidebarNav";

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

function num(v: string) {
  const cleaned = v.replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function int(v: string) {
  const cleaned = v.replace(/[^0-9]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function formatISO(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatShortDate(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPeriodLabel(id: number, startISO: string, endISO: string) {
  return `P${id}: ${formatShortDate(startISO)}-${formatShortDate(endISO)}`;
}

function addMonthsClamp(isoDate: string, offset: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const base = new Date(y, (m ?? 1) - 1, 1);
  base.setMonth(base.getMonth() + offset);
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const day = Math.min(d ?? 1, daysInMonth);
  const next = new Date(base.getFullYear(), base.getMonth(), day);
  return formatISO(next);
}

function getSelectedPeriod(plan: Plan) {
  return plan.periods.find((p) => p.id === plan.setup.selectedPeriodId) ?? plan.periods[0];
}

export default function SettingsPage() {
  const [plan, setPlan] = useState<Plan>(() => loadPlan());
  const [savedMsg, setSavedMsg] = useState<string>("");
  const [periodStart, setPeriodStart] = useState<string>(() => {
    const selected = getSelectedPeriod(loadPlan());
    return selected?.start ?? "";
  });
  const [periodEnd, setPeriodEnd] = useState<string>(() => {
    const selected = getSelectedPeriod(loadPlan());
    return selected?.end ?? "";
  });
  const [rollForward, setRollForward] = useState<boolean>(false);
  const [scenarioState, setScenarioState] = useState<ScenarioState>(() => loadScenarioState());
  const [newScenarioName, setNewScenarioName] = useState<string>("");
  const [renameScenarioName, setRenameScenarioName] = useState<string>(() => {
    const state = loadScenarioState();
    const active = state.scenarios.find((s) => s.id === state.activeId);
    return active?.name ?? "";
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<string>("");
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>(() => loadAuditTrail());
  const [auditActorName, setAuditActorName] = useState<string>(() => getAuditActor());
  const [alertPrefs, setAlertPrefs] = useState<AlertPreferences>(() => loadAlertPreferences());

  useEffect(() => {
    const refresh = () => {
      setAuditTrail(loadAuditTrail());
      setAuditActorName(getAuditActor());
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(AUDIT_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(AUDIT_UPDATED_EVENT, refresh);
    };
  }, []);

  const period = useMemo(() => getSelectedPeriod(plan), [plan]);

  const disabledBills = useMemo(() => {
    const override = plan.periodOverrides.find((o) => o.periodId === plan.setup.selectedPeriodId);
    return new Set(override?.disabledBills ?? []);
  }, [plan]);

  const totals = useMemo(() => {
    const events = generateEvents(plan, plan.setup.selectedPeriodId);
    const income = events.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const outflows = events.filter((e) => e.type === "outflow").reduce((s, e) => s + e.amount, 0);
    return { income, outflows, remaining: income - outflows };
  }, [plan]);
  const canUndo = Boolean(loadPreviousPlan());
  const recentAudit = useMemo(() => auditTrail.slice(0, 6), [auditTrail]);

  function updateSetup<K extends keyof Plan["setup"]>(key: K, value: Plan["setup"][K]) {
    setPlan((p) => ({ ...p, setup: { ...p.setup, [key]: value } }));
    setSavedMsg("");
  }

  function flashMessage(text: string) {
    setSavedMsg(text);
    setTimeout(() => setSavedMsg(""), 2000);
  }

  function applyPeriodDates() {
    if (!periodStart || !periodEnd) {
      flashMessage("Enter a start and end date.");
      return;
    }
    if (periodStart > periodEnd) {
      flashMessage("Start date must be before end date.");
      return;
    }

    setPlan((p) => {
      const selectedId = p.setup.selectedPeriodId;
      const updatedPeriods = p.periods.map((item) => {
        if (rollForward) {
          const offset = item.id - selectedId;
          const nextStart = addMonthsClamp(periodStart, offset);
          const nextEnd = addMonthsClamp(periodEnd, offset);
          return {
            ...item,
            start: nextStart,
            end: nextEnd,
            label: formatPeriodLabel(item.id, nextStart, nextEnd),
          };
        }

        if (item.id !== selectedId) return item;
        return {
          ...item,
          start: periodStart,
          end: periodEnd,
          label: formatPeriodLabel(item.id, periodStart, periodEnd),
        };
      });

      return { ...p, periods: updatedPeriods };
    });

    flashMessage(rollForward ? "Periods updated." : "Period updated.");
  }

  function updateIncomeRule(id: string, patch: Partial<IncomeRule>) {
    setPlan((p) => ({
      ...p,
      incomeRules: p.incomeRules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    setSavedMsg("");
  }

  function updateOutflowRule(id: string, patch: Partial<OutflowRule>) {
    setPlan((p) => ({
      ...p,
      outflowRules: p.outflowRules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
    setSavedMsg("");
  }

  function updateBill(id: string, patch: Partial<BillTemplate>) {
    setPlan((p) => ({
      ...p,
      bills: p.bills.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
    setSavedMsg("");
  }

  function setBillEnabledForPeriod(periodId: number, billId: string, enabled: boolean) {
    setPlan((p) => {
      const overrides = [...p.periodOverrides];
      const idx = overrides.findIndex((o) => o.periodId === periodId);
      const current = idx >= 0 ? overrides[idx] : { periodId, disabledBills: [] as string[] };
      const disabled = new Set(current.disabledBills ?? []);
      const hasStartingBalance = typeof current.startingBalance === "number";

      if (enabled) {
        disabled.delete(billId);
      } else {
        disabled.add(billId);
      }

      const nextDisabled = Array.from(disabled);
      if (nextDisabled.length === 0) {
        if (idx >= 0) {
          if (hasStartingBalance) {
            overrides[idx] = { ...current, disabledBills: [] };
          } else {
            overrides.splice(idx, 1);
          }
        }
      } else if (idx >= 0) {
        overrides[idx] = { ...current, disabledBills: nextDisabled };
      } else {
        overrides.push({ ...current, disabledBills: nextDisabled });
      }

      return { ...p, periodOverrides: overrides };
    });
    setSavedMsg("");
  }

  function updateOverride(id: string, patch: Partial<CashflowOverride>) {
    setPlan((p) => ({
      ...p,
      overrides: p.overrides.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
    setSavedMsg("");
  }

  function addOverride(type: CashflowType) {
    setPlan((p) => ({
      ...p,
      overrides: [
        ...p.overrides,
        {
          id: makeId("override"),
          date: p.periods[0].start,
          label: "Manual item",
          amount: 0,
          type,
          category: type === "income" ? "income" : "other",
        },
      ],
    }));
  }

  function removeOverride(id: string) {
    setPlan((p) => ({ ...p, overrides: p.overrides.filter((o) => o.id !== id) }));
  }

  function addIncomeRule() {
    setPlan((p) => ({
      ...p,
      incomeRules: [
        ...p.incomeRules,
        {
          id: makeId("income"),
          label: "New income",
          amount: 0,
          cadence: "monthly",
          seedDate: p.periods[0].start,
          enabled: true,
        },
      ],
    }));
  }

  function addOutflowRule() {
    setPlan((p) => ({
      ...p,
      outflowRules: [
        ...p.outflowRules,
        {
          id: makeId("outflow"),
          label: "New outflow",
          amount: 0,
          cadence: "monthly",
          seedDate: p.periods[0].start,
          category: "other",
          enabled: true,
        },
      ],
    }));
  }

  function addBill() {
    setPlan((p) => ({
      ...p,
      bills: [
        ...p.bills,
        {
          id: makeId("bill"),
          label: "New bill",
          amount: 0,
          dueDay: 26,
          category: "bill",
          enabled: true,
        },
      ],
    }));
  }

  function onSave() {
    savePlan(plan);
    flashMessage("Saved.");
  }

  function onReset() {
    resetPlan();
    setPlan(PLAN);
    flashMessage("Reset to defaults.");
  }

  function handleUndo() {
    const restored = undoLastPlanChange(auditActorName);
    if (restored) {
      setPlan(restored);
      flashMessage("Undid last change.");
    } else {
      flashMessage("Nothing to undo.");
    }
  }

  function handleSaveAuditActor() {
    const saved = setAuditActor(auditActorName);
    setAuditActorName(saved);
    flashMessage("Audit name saved.");
  }

  function handleClearAudit() {
    clearAuditTrail();
    flashMessage("Audit trail cleared.");
  }

  function updateAlertPrefs(patch: Partial<AlertPreferences>) {
    setAlertPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveAlertPreferences(next);
      return next;
    });
  }

  async function handleImport() {
    if (!importFile) {
      setImportStatus("Choose a file to import.");
      return;
    }
    setImportStatus("Importing...");
    setImportWarnings([]);
    try {
      const result = await importPlanFromFile(importFile, plan);
      setPlan(result.plan);
      savePlan(result.plan, { action: "import", actor: auditActorName });
      setImportWarnings(result.warnings);
      setImportStatus("Import complete.");
    } catch {
      setImportStatus("Import failed. Check the file format.");
    }
  }

  function handleScenarioChange(nextId: string) {
    savePlan(plan);
    const nextState = setActiveScenario(nextId);
    setScenarioState(nextState);
    const nextPlan = loadPlan();
    setPlan(nextPlan);
    const nextPeriod = getSelectedPeriod(nextPlan);
    setPeriodStart(nextPeriod.start);
    setPeriodEnd(nextPeriod.end);
    const active = nextState.scenarios.find((s) => s.id === nextState.activeId);
    setRenameScenarioName(active?.name ?? "");
  }

  function handleCreateScenario() {
    const name = newScenarioName.trim();
    if (!name) return;
    savePlan(plan);
    const nextState = createScenario(name, plan);
    setScenarioState(nextState);
    const nextPlan = loadPlan();
    setPlan(nextPlan);
    const nextPeriod = getSelectedPeriod(nextPlan);
    setPeriodStart(nextPeriod.start);
    setPeriodEnd(nextPeriod.end);
    const active = nextState.scenarios.find((s) => s.id === nextState.activeId);
    setRenameScenarioName(active?.name ?? "");
    setNewScenarioName("");
  }

  function handleRenameScenario() {
    const name = renameScenarioName.trim();
    if (!name) return;
    const nextState = renameScenario(scenarioState.activeId, name);
    setScenarioState(nextState);
  }

  function handleDeleteScenario() {
    if (scenarioState.scenarios.length <= 1) return;
    const nextState = deleteScenario(scenarioState.activeId);
    setScenarioState(nextState);
    const nextPlan = loadPlan();
    setPlan(nextPlan);
    const nextPeriod = getSelectedPeriod(nextPlan);
    setPeriodStart(nextPeriod.start);
    setPeriodEnd(nextPeriod.end);
    const active = nextState.scenarios.find((s) => s.id === nextState.activeId);
    setRenameScenarioName(active?.name ?? "");
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 pb-28 pt-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />
          <section className="space-y-6">
            <header className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
              <div className="text-xs uppercase tracking-wide text-slate-500">Settings</div>
              <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
              <p className="mt-2 text-sm text-slate-500">
                Set your rules, dates, and goals.
              </p>
            </header>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card title="Scenarios">
                <div className="space-y-3 text-sm">
                  <label className="block text-xs text-slate-500">Active scenario</label>
                  <select
                    value={scenarioState.activeId}
                    onChange={(e) => handleScenarioChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                  >
                    {scenarioState.scenarios.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.name}
                      </option>
                    ))}
                  </select>

                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      value={newScenarioName}
                      onChange={(e) => setNewScenarioName(e.target.value)}
                      placeholder="New scenario name"
                      className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleCreateScenario}
                      className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow hover:bg-[var(--accent-deep)]"
                    >
                      Create copy
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      value={renameScenarioName}
                      onChange={(e) => setRenameScenarioName(e.target.value)}
                      placeholder="Rename active scenario"
                      className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleRenameScenario}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Rename
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Switching saves your current changes.</span>
                    <button
                      onClick={handleDeleteScenario}
                      disabled={scenarioState.scenarios.length <= 1}
                      className="text-xs font-semibold text-slate-500 hover:text-rose-600 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      Delete scenario
                    </button>
                  </div>
                </div>
              </Card>
              <Card title="Period & Window">
                <div className="space-y-3 text-sm">
                  <label className="block text-xs text-slate-500">Selected period</label>
                  <select
                    value={plan.setup.selectedPeriodId}
                    onChange={(e) => {
                      const nextId = Number(e.target.value);
                      updateSetup("selectedPeriodId", nextId);
                      const nextPeriod = plan.periods.find((p) => p.id === nextId) ?? plan.periods[0];
                      setPeriodStart(nextPeriod.start);
                      setPeriodEnd(nextPeriod.end);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                  >
                    {plan.periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500">As of date</label>
                      <input
                        type="date"
                        value={plan.setup.asOfDate}
                        onChange={(e) => updateSetup("asOfDate", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">Window days</label>
                      <input
                        value={String(plan.setup.windowDays)}
                        onChange={(e) => updateSetup("windowDays", int(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/70 p-3 text-xs text-slate-600">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    Advanced period
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500">Start date</label>
                      <input
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500">End date</label>
                      <input
                        type="date"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={rollForward}
                      onChange={(e) => setRollForward(e.target.checked)}
                    />
                    Roll forward monthly (update all periods)
                  </label>
                  <button
                    onClick={applyPeriodDates}
                    className="mt-3 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow hover:bg-[var(--accent-deep)]"
                  >
                    Apply period dates
                  </button>
                </div>
              </Card>

              <Card title="Safety & Targets">
                <InputGBP
                  label="Expected minimum balance"
                  value={plan.setup.expectedMinBalance}
                  onChange={(v) => updateSetup("expectedMinBalance", v)}
                />
                <InputGBP
                  label="Variable cap (period)"
                  value={plan.setup.variableCap}
                  onChange={(v) => updateSetup("variableCap", v)}
                />
                <InputGBP
                  label="Starting balance (base)"
                  value={plan.setup.startingBalance}
                  onChange={(v) => updateSetup("startingBalance", v)}
                />
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={plan.setup.rollForwardBalance}
                    onChange={(e) => updateSetup("rollForwardBalance", e.target.checked)}
                  />
                  Carry ending balance into next period
                </label>
              </Card>

              <RulesEditor
                title="Income Rules"
                rules={plan.incomeRules}
                onAdd={addIncomeRule}
                onUpdate={updateIncomeRule}
              />

              <OutflowRulesEditor
                title="Outflow Rules"
                rules={plan.outflowRules}
                onAdd={addOutflowRule}
                onUpdate={updateOutflowRule}
              />

              <BillsEditor
                bills={plan.bills}
                disabledBills={disabledBills}
                onAdd={addBill}
                onTogglePeriod={(billId, enabled) =>
                  setBillEnabledForPeriod(plan.setup.selectedPeriodId, billId, enabled)
                }
                onUpdate={updateBill}
              />

              <OverridesEditor
                overrides={plan.overrides}
                onAddIncome={() => addOverride("income")}
                onAddOutflow={() => addOverride("outflow")}
                onRemove={removeOverride}
                onUpdate={updateOverride}
              />

              <Card title="Data import / export">
                <div className="space-y-4 text-sm text-slate-600">
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      onClick={() => downloadPlanXlsx(plan)}
                      className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[var(--accent-deep)]"
                    >
                      Export full plan (Excel)
                    </button>
                    <button
                      onClick={() => downloadPlanPdf(plan, plan.setup.selectedPeriodId)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                    >
                      Export PDF report
                    </button>
                  </div>
                  <button
                    onClick={downloadPlanTemplate}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Download import template
                  </button>
                  <div className="rounded-2xl bg-white/70 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Import</div>
                    <p className="mt-1 text-xs text-slate-500">
                      Import replaces sections included in the file. Export a backup first.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                        className="text-xs text-slate-600"
                      />
                      <button
                        onClick={handleImport}
                        className="rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow hover:bg-[var(--accent-deep)]"
                      >
                        Import file
                      </button>
                    </div>
                    {importStatus ? (
                      <div className="mt-2 text-xs text-slate-500">{importStatus}</div>
                    ) : null}
                    {importWarnings.length ? (
                      <div className="mt-2 text-xs text-amber-600">
                        {importWarnings.slice(0, 3).map((warning, idx) => (
                          <div key={`warn-${idx}`}>{warning}</div>
                        ))}
                        {importWarnings.length > 3 ? (
                          <div>{`+${importWarnings.length - 3} more warning(s)`}</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>

              <Card title="Alerts & notifications">
                <div className="space-y-4 text-sm text-slate-600">
                  <label className="flex items-center justify-between gap-3">
                    <span>Enable alerts</span>
                    <input
                      type="checkbox"
                      checked={alertPrefs.enabled}
                      onChange={(e) => updateAlertPrefs({ enabled: e.target.checked })}
                    />
                  </label>

                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Low balance risk days</span>
                      <input
                        type="checkbox"
                        checked={alertPrefs.lowBalance}
                        onChange={(e) => updateAlertPrefs({ lowBalance: e.target.checked })}
                      />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] uppercase tracking-wide text-slate-400">
                          Lookahead days
                        </label>
                        <input
                          value={String(alertPrefs.lowBalanceWindowDays)}
                          onChange={(e) =>
                            updateAlertPrefs({ lowBalanceWindowDays: int(e.target.value) })
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="text-xs text-slate-500">
                        Shows forecast dips below your minimum balance within the lookahead window.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Upcoming large bills</span>
                      <input
                        type="checkbox"
                        checked={alertPrefs.largeBills}
                        onChange={(e) => updateAlertPrefs({ largeBills: e.target.checked })}
                      />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] uppercase tracking-wide text-slate-400">
                          Threshold
                        </label>
                        <input
                          value={String(alertPrefs.largeBillThreshold)}
                          onChange={(e) =>
                            updateAlertPrefs({ largeBillThreshold: num(e.target.value) })
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs"
                          inputMode="decimal"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] uppercase tracking-wide text-slate-400">
                          Window days
                        </label>
                        <input
                          value={String(alertPrefs.upcomingWindowDays)}
                          onChange={(e) =>
                            updateAlertPrefs({ upcomingWindowDays: int(e.target.value) })
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Missed income checks</span>
                      <input
                        type="checkbox"
                        checked={alertPrefs.missedIncome}
                        onChange={(e) => updateAlertPrefs({ missedIncome: e.target.checked })}
                      />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] uppercase tracking-wide text-slate-400">
                          Grace days
                        </label>
                        <input
                          value={String(alertPrefs.missedIncomeGraceDays)}
                          onChange={(e) =>
                            updateAlertPrefs({ missedIncomeGraceDays: int(e.target.value) })
                          }
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="text-xs text-slate-500">
                        Wait this many days after an expected deposit before alerting.
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Audit trail & undo">
                <div className="space-y-4 text-sm text-slate-600">
                  <div>
                    <label className="block text-xs text-slate-500">Audit name (who)</label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input
                        value={auditActorName}
                        onChange={(e) => setAuditActorName(e.target.value)}
                        placeholder="e.g. Joshua"
                        className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                      />
                      <button
                        onClick={handleSaveAuditActor}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Save name
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[var(--accent-deep)] disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Undo last change
                    </button>
                    <button
                      onClick={handleClearAudit}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Clear audit trail
                    </button>
                  </div>

                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Recent changes</div>
                  {recentAudit.length === 0 ? (
                    <div className="text-xs text-slate-500">No changes logged yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {recentAudit.map((entry) => (
                        <details key={entry.id} className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
                            <span className="font-semibold text-slate-900">{entry.summary}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-500">
                              {entry.action}
                            </span>
                          </summary>
                          <div className="mt-2 text-xs text-slate-500">
                            <div>{formatDateTime(entry.timestamp)} - {entry.actor}</div>
                            {entry.changes.length ? (
                              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                                {entry.changes.slice(0, 6).map((change) => (
                                  <li key={change}>{change}</li>
                                ))}
                              </ul>
                            ) : (
                              <div className="mt-2">No detailed differences recorded.</div>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              <Card title="Quick summary">
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Rule income total</span>
                    <span className="font-semibold">{gbp(totals.income)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Rule outflows total</span>
                    <span className="font-semibold">{gbp(totals.outflows)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Remaining</span>
                    <span className="font-semibold">{gbp(totals.remaining)}</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={onSave}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[var(--accent-deep)]"
                  >
                    Save
                  </button>
                  <button
                    onClick={onReset}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    Reset
                  </button>

                  {savedMsg ? (
                    <span className="ml-2 text-sm text-slate-500">{savedMsg}</span>
                  ) : null}
                </div>
              </Card>
            </div>
          </section>
        </div>
      </div>

    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-[var(--surface)] p-6 shadow-xl">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-slate-700">{children}</div>
    </section>
  );
}

function InputGBP({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500">{label}</label>
      <input
        value={String(value ?? 0)}
        onChange={(e) => onChange(num(e.target.value))}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
        inputMode="decimal"
      />
    </div>
  );
}

function RulesEditor({
  title,
  rules,
  onAdd,
  onUpdate,
}: {
  title: string;
  rules: IncomeRule[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<IncomeRule>) => void;
}) {
  return (
    <Card title={title}>
      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="grid grid-cols-12 gap-2 items-center">
            <input
              value={rule.label}
              onChange={(e) => onUpdate(rule.id, { label: e.target.value })}
              className="col-span-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
            />
            <input
              type="date"
              value={rule.seedDate}
              onChange={(e) => onUpdate(rule.id, { seedDate: e.target.value })}
              className="col-span-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
            />
            <select
              value={rule.cadence}
              onChange={(e) => onUpdate(rule.id, { cadence: e.target.value as Recurrence })}
              className="col-span-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <input
              value={String(rule.amount)}
              onChange={(e) => onUpdate(rule.id, { amount: num(e.target.value) })}
              className="col-span-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
              inputMode="decimal"
            />
            <label className="col-span-1 flex items-center justify-center text-xs text-slate-500">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) => onUpdate(rule.id, { enabled: e.target.checked })}
              />
            </label>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Seed date anchors recurrence.</span>
        <button
          onClick={onAdd}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
        >
          Add rule
        </button>
      </div>
    </Card>
  );
}

function OutflowRulesEditor({
  title,
  rules,
  onAdd,
  onUpdate,
}: {
  title: string;
  rules: OutflowRule[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<OutflowRule>) => void;
}) {
  return (
    <Card title={title}>
      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="grid grid-cols-12 gap-2 items-center">
            <input
              value={rule.label}
              onChange={(e) => onUpdate(rule.id, { label: e.target.value })}
              className="col-span-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
            />
            <input
              type="date"
              value={rule.seedDate}
              onChange={(e) => onUpdate(rule.id, { seedDate: e.target.value })}
              className="col-span-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
            />
            <select
              value={rule.category}
              onChange={(e) => onUpdate(rule.id, { category: e.target.value as OutflowRule["category"] })}
              className="col-span-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
            >
              <option value="bill">Bill</option>
              <option value="giving">Giving</option>
              <option value="allowance">Allowance</option>
              <option value="savings">Savings</option>
              <option value="buffer">Buffer</option>
              <option value="other">Other</option>
            </select>
            <select
              value={rule.cadence}
              onChange={(e) => onUpdate(rule.id, { cadence: e.target.value as Recurrence })}
              className="col-span-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <input
              value={String(rule.amount)}
              onChange={(e) => onUpdate(rule.id, { amount: num(e.target.value) })}
              className="col-span-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
              inputMode="decimal"
            />
            <label className="col-span-1 flex items-center justify-center text-xs text-slate-500">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) => onUpdate(rule.id, { enabled: e.target.checked })}
              />
            </label>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Use outflow rules for savings, giving, allowance.</span>
        <button
          onClick={onAdd}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
        >
          Add rule
        </button>
      </div>
    </Card>
  );
}

function BillsEditor({
  bills,
  disabledBills,
  onAdd,
  onTogglePeriod,
  onUpdate,
}: {
  bills: BillTemplate[];
  disabledBills: Set<string>;
  onAdd: () => void;
  onTogglePeriod: (id: string, enabled: boolean) => void;
  onUpdate: (id: string, patch: Partial<BillTemplate>) => void;
}) {
  return (
    <Card title="Bills Schedule">
      <div className="space-y-3">
        <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-slate-400">
          <div className="col-span-3">Bill</div>
          <div className="col-span-2">Due</div>
          <div className="col-span-3">Amount</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-1 text-center">Period</div>
          <div className="col-span-1 text-center">Global</div>
        </div>
        {bills.map((bill) => (
          <div key={bill.id} className="grid grid-cols-12 gap-2 items-center">
            <input
              value={bill.label}
              onChange={(e) => onUpdate(bill.id, { label: e.target.value })}
              className="col-span-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
            />
            <input
              value={String(bill.dueDay)}
              onChange={(e) => onUpdate(bill.id, { dueDay: int(e.target.value) })}
              className="col-span-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
              inputMode="numeric"
            />
            <input
              value={String(bill.amount)}
              onChange={(e) => onUpdate(bill.id, { amount: num(e.target.value) })}
              className="col-span-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
              inputMode="decimal"
            />
            <select
              value={bill.category}
              onChange={(e) => onUpdate(bill.id, { category: e.target.value as BillTemplate["category"] })}
              className="col-span-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
            >
              <option value="bill">Bill</option>
              <option value="giving">Giving</option>
              <option value="allowance">Allowance</option>
              <option value="savings">Savings</option>
              <option value="buffer">Buffer</option>
              <option value="other">Other</option>
            </select>
            <label className="col-span-1 flex items-center justify-center text-xs text-slate-500">
              <input
                type="checkbox"
                checked={bill.enabled && !disabledBills.has(bill.id)}
                onChange={(e) => onTogglePeriod(bill.id, e.target.checked)}
                disabled={!bill.enabled}
                aria-label="Toggle for selected period"
              />
            </label>
            <label className="col-span-1 flex items-center justify-center text-xs text-slate-500">
              <input
                type="checkbox"
                checked={bill.enabled}
                onChange={(e) => onUpdate(bill.id, { enabled: e.target.checked })}
                aria-label="Toggle globally"
              />
            </label>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>
          Due day is the calendar day (e.g. 26th). Period toggle applies to selected period;
          global toggles everywhere.
        </span>
        <button
          onClick={onAdd}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
        >
          Add bill
        </button>
      </div>
    </Card>
  );
}

function OverridesEditor({
  overrides,
  onAddIncome,
  onAddOutflow,
  onRemove,
  onUpdate,
}: {
  overrides: CashflowOverride[];
  onAddIncome: () => void;
  onAddOutflow: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<CashflowOverride>) => void;
}) {
  return (
    <Card title="Manual Overrides">
      <div className="space-y-3">
        {overrides.length === 0 ? (
          <p className="text-xs text-slate-500">No manual overrides yet.</p>
        ) : (
          overrides.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
              <input
                value={item.label}
                onChange={(e) => onUpdate(item.id, { label: e.target.value })}
                className="col-span-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
              />
              <input
                type="date"
                value={item.date}
                onChange={(e) => onUpdate(item.id, { date: e.target.value })}
                className="col-span-3 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
              />
              <select
                value={item.type}
                onChange={(e) => onUpdate(item.id, { type: e.target.value as CashflowType })}
                className="col-span-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
              >
                <option value="income">Income</option>
                <option value="outflow">Outflow</option>
              </select>
              <select
                value={item.category}
                onChange={(e) => onUpdate(item.id, { category: e.target.value as CashflowCategory })}
                className="col-span-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
              >
                <option value="income">Income</option>
                <option value="bill">Bill</option>
                <option value="giving">Giving</option>
                <option value="allowance">Allowance</option>
                <option value="savings">Savings</option>
                <option value="buffer">Buffer</option>
                <option value="other">Other</option>
              </select>
              <input
                value={String(item.amount)}
                onChange={(e) => onUpdate(item.id, { amount: num(e.target.value) })}
                className="col-span-1 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs"
                inputMode="decimal"
              />
              <button
                onClick={() => onRemove(item.id)}
                className="col-span-1 rounded-lg border border-slate-200 px-2 py-2 text-xs text-slate-600 hover:bg-slate-100"
              >
                Del
              </button>
            </div>
          ))
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Use for one-offs or date changes.</span>
        <div className="flex gap-2">
          <button
            onClick={onAddIncome}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
          >
            Add income
          </button>
          <button
            onClick={onAddOutflow}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
          >
            Add outflow
          </button>
        </div>
      </div>
    </Card>
  );
}
