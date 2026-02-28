import { PLAN, PLAN_VERSION, Plan, CashflowOverride, CashflowCategory, NetWorthSnapshot } from "@/data/plan";

/**
 * Safely parse plan JSON from localStorage.
 * NOTE: do NOT import from tokenPlanBase here — that file pulls in
 * @/lib/db (Neon / server-only), which crashes the browser bundle.
 */
function parseStoredPlan(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
import { formatMoney } from "@/lib/currency";
import {
  loadScenarioState,
  saveScenarioState,
  scenarioPlanKey,
  scenarioPrevPlanKey,
} from "@/lib/scenarioStorage";
import type { AuditEntry } from "@/lib/auditLog";
import { appendAuditEntry, getAuditActor } from "@/lib/auditLog";

const SCOPE_KEY = "cashflow_scope_v1";
const MAIN_SYNC_AT_KEY = "cashflow_main_sync_at_v1";
const MAIN_SERVER_UPDATED_KEY = "cashflow_main_server_updated_at_v1";
const MAIN_SERVER_SYNCED_KEY = "cashflow_main_server_synced_at_v1";
const MAIN_PLAN_HASH_KEY = "cashflow_main_plan_hash_v1";
const DEFAULT_SCOPE = "default";

export const PLAN_UPDATED_EVENT = "cashflow:plan-updated";
export const MAIN_SYNC_EVENT = "cashflow:main-sync";
export const SCOPE_UPDATED_EVENT = "cashflow:scope-updated";

type PlanCache = {
  key: string;
  raw: string | null;
  plan: Plan;
};

let planCache: PlanCache | null = null;
let prevPlanCache: PlanCache | null = null;

type LegacyTotals = {
  fmIncome?: number;
  fixedBillsTotal?: number;
  givingTotal?: number;
  weeklyAllowance?: number;
  savings?: number;
  bufferTopUp?: number;
  expectedMinBalance?: number;
  startingBalance?: number;
  periodStartISO?: string;
};

type LegacyItem = {
  id?: string;
  label?: string;
  amount?: number;
  date?: string;
  category?: CashflowCategory | "Fixed";
  enabled?: boolean;
};

type LegacyPlan = LegacyTotals & {
  items?: LegacyItem[];
};

function normalizeCategory(category?: CashflowCategory | "Fixed") {
  if (!category) return "other";
  if (category === "Fixed") return "bill";
  return category;
}

function legacyOverrides(startISO: string, legacy: LegacyTotals): CashflowOverride[] {
  const overrides: CashflowOverride[] = [];
  if (typeof legacy.fmIncome === "number") {
    overrides.push({
      id: "legacy-fm-income",
      date: startISO,
      label: "FM income",
      amount: legacy.fmIncome,
      type: "income",
      category: "income",
    });
  }
  if (typeof legacy.fixedBillsTotal === "number") {
    overrides.push({
      id: "legacy-bills",
      date: startISO,
      label: "Bills",
      amount: legacy.fixedBillsTotal,
      type: "outflow",
      category: "bill",
    });
  }
  if (typeof legacy.givingTotal === "number") {
    overrides.push({
      id: "legacy-giving",
      date: startISO,
      label: "Giving",
      amount: legacy.givingTotal,
      type: "outflow",
      category: "giving",
    });
  }
  if (typeof legacy.weeklyAllowance === "number") {
    overrides.push({
      id: "legacy-allowance",
      date: startISO,
      label: "Allowance",
      amount: legacy.weeklyAllowance,
      type: "outflow",
      category: "allowance",
    });
  }
  if (typeof legacy.savings === "number") {
    overrides.push({
      id: "legacy-savings",
      date: startISO,
      label: "Savings",
      amount: legacy.savings,
      type: "outflow",
      category: "savings",
    });
  }
  if (typeof legacy.bufferTopUp === "number" && legacy.bufferTopUp > 0) {
    overrides.push({
      id: "legacy-buffer",
      date: startISO,
      label: "Buffer top-up",
      amount: legacy.bufferTopUp,
      type: "outflow",
      category: "buffer",
    });
  }
  return overrides;
}

function mapLegacyItems(items: LegacyItem[]): CashflowOverride[] {
  return items
    .filter((item) => item.enabled !== false && item.amount && item.date)
    .map((item, idx) => ({
      id: item.id ?? `legacy-item-${idx}`,
      date: item.date as string,
      label: item.label ?? "Legacy item",
      amount: item.amount as number,
      type: item.category === "income" ? "income" : "outflow",
      category: normalizeCategory(item.category),
    }));
}

function findPeriodIdByStart(startISO?: string) {
  if (!startISO) return PLAN.setup.selectedPeriodId;
  const period = PLAN.periods.find((p) => p.start === startISO);
  return period?.id ?? PLAN.setup.selectedPeriodId;
}

function normalizeSelectedPeriodId(plan: Plan) {
  const exists = plan.periods.some((p) => p.id === plan.setup.selectedPeriodId);
  if (!exists) {
    plan.setup.selectedPeriodId = plan.periods[0]?.id ?? 1;
  }
}

function nowIso() {
  return new Date().toISOString();
}

// C5 fix: use shared formatMoney instead of hardcoded GBP
function formatCurrency(value: number) {
  return formatMoney(value || 0);
}

function formatDelta(label: string, prev: number, next: number, changes: string[]) {
  if (Math.abs(prev - next) < 0.01) return;
  changes.push(`${label}: ${formatCurrency(prev)} -> ${formatCurrency(next)}`);
}

function summarizePlanChange(prev: Plan | null, next: Plan) {
  const changes: string[] = [];
  if (prev) {
    if (prev.setup.selectedPeriodId !== next.setup.selectedPeriodId) {
      changes.push(`Selected period: ${prev.setup.selectedPeriodId} -> ${next.setup.selectedPeriodId}`);
    }
    if (prev.setup.asOfDate !== next.setup.asOfDate) {
      changes.push(`As of date: ${prev.setup.asOfDate} -> ${next.setup.asOfDate}`);
    }
    if (prev.setup.windowDays !== next.setup.windowDays) {
      changes.push(`Forecast range (days): ${prev.setup.windowDays} -> ${next.setup.windowDays}`);
    }
    if (prev.setup.startingBalance !== next.setup.startingBalance) {
      changes.push(`Starting balance: ${formatCurrency(prev.setup.startingBalance)} -> ${formatCurrency(next.setup.startingBalance)}`);
    }
    if (prev.setup.expectedMinBalance !== next.setup.expectedMinBalance) {
      changes.push(`Expected minimum: ${formatCurrency(prev.setup.expectedMinBalance)} -> ${formatCurrency(next.setup.expectedMinBalance)}`);
    }
    if (prev.setup.variableCap !== next.setup.variableCap) {
      changes.push(`Variable cap: ${formatCurrency(prev.setup.variableCap)} -> ${formatCurrency(next.setup.variableCap)}`);
    }

    if (prev.incomeRules.length !== next.incomeRules.length) {
      changes.push(`Income rules: ${prev.incomeRules.length} -> ${next.incomeRules.length}`);
    }
    if (prev.outflowRules.length !== next.outflowRules.length) {
      changes.push(`Outflow rules: ${prev.outflowRules.length} -> ${next.outflowRules.length}`);
    }
    if (prev.bills.length !== next.bills.length) {
      changes.push(`Bills: ${prev.bills.length} -> ${next.bills.length}`);
    }
    if (prev.transactions.length !== next.transactions.length) {
      changes.push(`Transactions: ${prev.transactions.length} -> ${next.transactions.length}`);
    }
    if (prev.overrides.length !== next.overrides.length) {
      changes.push(`Overrides: ${prev.overrides.length} -> ${next.overrides.length}`);
    }

    const prevIncomeTotal = prev.incomeRules.filter((r) => r.enabled).reduce((sum, r) => sum + r.amount, 0);
    const nextIncomeTotal = next.incomeRules.filter((r) => r.enabled).reduce((sum, r) => sum + r.amount, 0);
    const prevOutflowTotal = prev.outflowRules.filter((r) => r.enabled).reduce((sum, r) => sum + r.amount, 0);
    const nextOutflowTotal = next.outflowRules.filter((r) => r.enabled).reduce((sum, r) => sum + r.amount, 0);
    const prevBillTotal = prev.bills.filter((b) => b.enabled).reduce((sum, b) => sum + b.amount, 0);
    const nextBillTotal = next.bills.filter((b) => b.enabled).reduce((sum, b) => sum + b.amount, 0);

    formatDelta("Budgeted income", prevIncomeTotal, nextIncomeTotal, changes);
    formatDelta("Rule outflows", prevOutflowTotal, nextOutflowTotal, changes);
    formatDelta("Bills total", prevBillTotal, nextBillTotal, changes);
  }

  const summary =
    changes.length === 0 ? "Saved (no detected changes)" : `Updated plan (${changes.length} change${changes.length === 1 ? "" : "s"})`;
  return { summary, changes };
}

function recordAuditEntry(prevPlan: Plan | null, nextPlan: Plan, action: AuditEntry["action"], actor?: string) {
  if (typeof window === "undefined") return;
  const { summary, changes } = summarizePlanChange(prevPlan, nextPlan);
  const entry: AuditEntry = {
    id: `audit-${Date.now()}`,
    timestamp: nowIso(),
    actor: actor?.trim() || getAuditActor(),
    action,
    summary,
    changes,
  };
  appendAuditEntry(entry);
}

function ensurePlanVersion(plan: Plan): Plan {
  if (plan.version === PLAN_VERSION) return plan;
  return { ...plan, version: PLAN_VERSION };
}

export function getStorageScope() {
  if (typeof window === "undefined") return DEFAULT_SCOPE;
  const scope = window.localStorage.getItem(SCOPE_KEY);
  return scope && scope.trim() ? scope : DEFAULT_SCOPE;
}

export function setStorageScope(scope: string) {
  if (typeof window === "undefined") return DEFAULT_SCOPE;
  const next = scope && scope.trim() ? scope.trim() : DEFAULT_SCOPE;
  window.localStorage.setItem(SCOPE_KEY, next);
  dispatchBrowserEvent(SCOPE_UPDATED_EVENT);
  return next;
}

function scopedKey(baseKey: string, scope = getStorageScope()) {
  return scope === DEFAULT_SCOPE ? baseKey : `${baseKey}::${scope}`;
}

function dispatchBrowserEvent(name: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(name));
}

function todayISO() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function deserializePlan(raw: string | null): Plan {
  if (!raw) return PLAN;
  try {
    const parsed = (parseStoredPlan(raw) ?? {}) as Partial<Plan> & LegacyPlan;
    const next: Plan = {
      ...PLAN,
      ...parsed,
      setup: { ...PLAN.setup, ...parsed.setup },
      version: PLAN_VERSION,
      // N8 fix: explicit defaults for array fields to prevent sample data leaking
      incomeRules: parsed.incomeRules ?? PLAN.incomeRules,
      outflowRules: parsed.outflowRules ?? PLAN.outflowRules,
      bills: parsed.bills ?? PLAN.bills,
      periods: Array.isArray(parsed.periods) && parsed.periods.length > 0
        ? parsed.periods
        : PLAN.periods,
      periodRuleOverrides: parsed.periodRuleOverrides ?? [],
      periodOverrides: parsed.periodOverrides ?? [],
      eventOverrides: parsed.eventOverrides ?? [],
      overrides: parsed.overrides ?? [],
      transactions: parsed.transactions ?? [],
      savingsGoals: parsed.savingsGoals ?? [],
      customCategories: parsed.customCategories ?? undefined,
    };

    if (!Array.isArray(parsed.incomeRules) && Array.isArray(parsed.items)) {
      const periodId = findPeriodIdByStart(parsed.periodStartISO);
      next.setup.selectedPeriodId = periodId;
      next.overrides = mapLegacyItems(parsed.items);
      if (typeof parsed.expectedMinBalance === "number") {
        next.setup.expectedMinBalance = parsed.expectedMinBalance;
      }
      if (typeof parsed.startingBalance === "number") {
        next.setup.startingBalance = parsed.startingBalance;
      }
    } else if (
      typeof parsed.fmIncome === "number" ||
      typeof parsed.fixedBillsTotal === "number" ||
      typeof parsed.givingTotal === "number"
    ) {
      const startISO = parsed.periodStartISO ?? PLAN.periods[0].start;
      next.overrides = legacyOverrides(startISO, parsed);
      if (typeof parsed.expectedMinBalance === "number") {
        next.setup.expectedMinBalance = parsed.expectedMinBalance;
      }
      if (typeof parsed.startingBalance === "number") {
        next.setup.startingBalance = parsed.startingBalance;
      }
    }

    normalizeSelectedPeriodId(next);
    return next;
  } catch {
    return PLAN;
  }
}

/**
 * Pure transform — advances asOfDate to today and selects the period that
 * contains today. Does not read or write storage; callers that need the
 * change persisted should follow up with savePlan().
 */
export function advancePlanToCurrentPeriod(plan: Plan): Plan {
  const today = todayISO();
  const next: Plan = { ...plan, setup: { ...plan.setup } };
  const shouldAutoUpdate = next.setup.autoUpdateAsOfDate ?? true;
  if (shouldAutoUpdate && next.setup.asOfDate !== today) {
    next.setup.asOfDate = today;
  }
  const currentPeriod = next.periods.find(p => today >= p.start && today <= p.end);
  if (currentPeriod && currentPeriod.id !== next.setup.selectedPeriodId) {
    next.setup.selectedPeriodId = currentPeriod.id;
  }
  return next;
}

export function loadPlan(): Plan {
  if (typeof window === "undefined") return PLAN;
  const state = loadScenarioState();
  const key = scenarioPlanKey(state.activeId);
  const raw = window.localStorage.getItem(key);
  if (planCache && planCache.key === key && planCache.raw === raw) {
    return planCache.plan;
  }
  if (!raw) {
    // No primary key — try safety backup before falling back to a fresh plan
    try {
      const safetyRaw = window.localStorage.getItem("velanovo-safety-backup-v1");
      if (safetyRaw) {
        const safetyData = JSON.parse(safetyRaw) as { plan?: unknown; savedAt?: string };
        if (safetyData.plan) {
          console.log("[storage] Restored plan from safety backup saved at", safetyData.savedAt);
          const restored = deserializePlan(JSON.stringify(safetyData.plan));
          const restoredRaw = JSON.stringify(ensurePlanVersion(restored));
          window.localStorage.setItem(key, restoredRaw);
          planCache = { key, raw: restoredRaw, plan: restored };
          return restored;
        }
      }
    } catch {
      // ignore
    }
    if (state.activeId !== "default") {
      const normalized = ensurePlanVersion(PLAN);
      const rawPlan = JSON.stringify(normalized);
      window.localStorage.setItem(key, rawPlan);
      planCache = { key, raw: rawPlan, plan: normalized };
    }
  }
  const next = deserializePlan(window.localStorage.getItem(key));
  planCache = { key, raw: window.localStorage.getItem(key), plan: next };
  return next;
}

export function loadPreviousPlan(): Plan | null {
  if (typeof window === "undefined") return null;
  const state = loadScenarioState();
  const key = scenarioPrevPlanKey(state.activeId);
  const raw = window.localStorage.getItem(key);
  if (prevPlanCache && prevPlanCache.key === key && prevPlanCache.raw === raw) {
    return prevPlanCache.plan;
  }
  if (!raw) return null;
  const prev = deserializePlan(raw);
  prevPlanCache = { key, raw, plan: prev };
  return prev;
}

export function hasStoredPlan() {
  if (typeof window === "undefined") return true;
  const state = loadScenarioState();
  const key = scenarioPlanKey(state.activeId);
  return Boolean(window.localStorage.getItem(key));
}

export function createFreshPlan(): Plan {
  return {
    ...PLAN,
    version: PLAN_VERSION,
    setup: { ...PLAN.setup, asOfDate: todayISO() },
    incomeRules: [],
    outflowRules: [],
    bills: [],
    periodOverrides: [],
    eventOverrides: [],
    overrides: [],
    transactions: [],
  };
}

export type SavePlanOptions = {
  action?: AuditEntry["action"];
  actor?: string;
  skipAudit?: boolean;
  skipPrev?: boolean;
};

// ---------------------------------------------------------------------------
// Net worth auto-snapshot helpers
// ---------------------------------------------------------------------------
const ASSET_ACCOUNT_TYPES = new Set(["savings", "investment", "property", "other-asset"]);

function computeCurrentNetWorth(plan: Plan): {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  accountBalances: Record<string, number>;
} {
  const accounts = plan.netWorthAccounts ?? [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  const accountBalances: Record<string, number> = {};
  for (const acc of accounts) {
    accountBalances[acc.id] = acc.balance;
    if (ASSET_ACCOUNT_TYPES.has(acc.type)) {
      totalAssets += acc.balance;
    } else {
      totalLiabilities += acc.balance;
    }
  }
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities, accountBalances };
}

function autoSnapshotNetWorth(plan: Plan): Plan {
  const accounts = plan.netWorthAccounts ?? [];
  if (accounts.length === 0) return plan;

  const today = new Date();
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const alreadyHasThisMonth = (plan.netWorthSnapshots ?? []).some(
    (s) => s.date?.startsWith(monthKey)
  );
  if (alreadyHasThisMonth) return plan;

  const { totalAssets, totalLiabilities, netWorth, accountBalances } = computeCurrentNetWorth(plan);
  const newSnapshot: NetWorthSnapshot = {
    id: crypto.randomUUID(),
    date: today.toISOString().slice(0, 10),
    totalAssets,
    totalLiabilities,
    netWorth,
    accountBalances,
  };
  return {
    ...plan,
    netWorthSnapshots: [...(plan.netWorthSnapshots ?? []), newSnapshot],
  };
}

export function savePlan(plan: Plan, options?: SavePlanOptions) {
  if (typeof window === "undefined") return;
  plan = autoSnapshotNetWorth(plan); // auto-snapshot net worth on new month
  const state = loadScenarioState();
  const key = scenarioPlanKey(state.activeId);
  const normalized = ensurePlanVersion(plan);
  const raw = JSON.stringify(normalized);
  const prevRaw = window.localStorage.getItem(key);
  const prevPlan = prevRaw ? deserializePlan(prevRaw) : null;
  const hasChanged = !prevRaw || prevRaw !== raw;

  if (!options?.skipPrev && prevRaw && prevRaw !== raw) {
    const prevKey = scenarioPrevPlanKey(state.activeId);
    window.localStorage.setItem(prevKey, prevRaw);
    prevPlanCache = { key: prevKey, raw: prevRaw, plan: prevPlan ?? normalized };
  }

  window.localStorage.setItem(key, raw);
  planCache = { key, raw, plan: normalized };

  // Safety backup — always written to a fixed key, never scoped, never cleared by scenario reset
  try {
    window.localStorage.setItem(
      "velanovo-safety-backup-v1",
      JSON.stringify({ plan: normalized, savedAt: new Date().toISOString() })
    );
  } catch {
    // ignore storage errors
  }

  const updated = {
    ...state,
    scenarios: state.scenarios.map((scenario) =>
      scenario.id === state.activeId
        ? { ...scenario, updatedAt: nowIso() }
        : scenario
    ),
  };
  saveScenarioState(updated);
  if (!options?.skipAudit && hasChanged) {
    recordAuditEntry(prevPlan, normalized, options?.action ?? "edit", options?.actor);
  }
  dispatchBrowserEvent(PLAN_UPDATED_EVENT);
}

export function savePreviousPlan(plan: Plan) {
  if (typeof window === "undefined") return;
  const state = loadScenarioState();
  const key = scenarioPrevPlanKey(state.activeId);
  const normalized = ensurePlanVersion(plan);
  const raw = JSON.stringify(normalized);
  window.localStorage.setItem(key, raw);
  prevPlanCache = { key, raw, plan: normalized };
}

export function savePlanFromRemote(plan: Plan, prevPlan?: Plan | null, updatedAt?: number, actor?: string) {
  if (typeof window === "undefined") return;
  const state = loadScenarioState();
  const key = scenarioPlanKey(state.activeId);
  const normalized = deserializePlan(JSON.stringify(plan));
  const raw = JSON.stringify(normalized);
  const existingRaw = window.localStorage.getItem(key);
  const previousPlan = prevPlan ?? (existingRaw ? deserializePlan(existingRaw) : null);
  const hasChanged = !existingRaw || existingRaw !== raw;
  window.localStorage.setItem(key, raw);
  planCache = { key, raw, plan: normalized };

  if (prevPlan) {
    window.localStorage.setItem(
      scenarioPrevPlanKey(state.activeId),
      JSON.stringify(ensurePlanVersion(prevPlan))
    );
    const prevKey = scenarioPrevPlanKey(state.activeId);
    prevPlanCache = {
      key: prevKey,
      raw: window.localStorage.getItem(prevKey),
      plan: ensurePlanVersion(prevPlan),
    };
  }

  const stamp = typeof updatedAt === "number" ? new Date(updatedAt).toISOString() : nowIso();
  const updated = {
    ...state,
    scenarios: state.scenarios.map((scenario) =>
      scenario.id === state.activeId ? { ...scenario, updatedAt: stamp } : scenario
    ),
  };
  saveScenarioState(updated);
  if (hasChanged) {
    recordAuditEntry(previousPlan, normalized, "sync", actor);
  }
  dispatchBrowserEvent(PLAN_UPDATED_EVENT);
}

export function undoLastPlanChange(actor?: string) {
  if (typeof window === "undefined") return null;
  const previous = loadPreviousPlan();
  if (!previous) return null;
  savePlan(previous, { action: "undo", actor });
  return previous;
}

export function resetPlan() {
  savePlan(PLAN, { action: "reset" });
}

function normalizeSyncStamp(value?: string | number) {
  if (!value) return nowIso();
  if (typeof value === "number") return new Date(value).toISOString();
  return value;
}

export function getMainSyncAt() {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem(scopedKey(MAIN_SYNC_AT_KEY));
  return raw ?? "";
}

export function setMainSyncAt(value?: string | number) {
  if (typeof window === "undefined") return "";
  const stamp = normalizeSyncStamp(value);
  window.localStorage.setItem(scopedKey(MAIN_SYNC_AT_KEY), stamp);
  dispatchBrowserEvent(MAIN_SYNC_EVENT);
  return stamp;
}

export function getMainServerUpdatedAt() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(scopedKey(MAIN_SERVER_UPDATED_KEY));
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function setMainServerUpdatedAt(value: number | null) {
  if (typeof window === "undefined") return null;
  const key = scopedKey(MAIN_SERVER_UPDATED_KEY);
  if (!value) {
    window.localStorage.removeItem(key);
    dispatchBrowserEvent(MAIN_SYNC_EVENT);
    return null;
  }
  window.localStorage.setItem(key, String(value));
  dispatchBrowserEvent(MAIN_SYNC_EVENT);
  return value;
}

export function getMainServerSyncedAt() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(scopedKey(MAIN_SERVER_SYNCED_KEY));
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function setMainServerSyncedAt(value: number | null) {
  if (typeof window === "undefined") return null;
  const key = scopedKey(MAIN_SERVER_SYNCED_KEY);
  if (!value) {
    window.localStorage.removeItem(key);
    return null;
  }
  window.localStorage.setItem(key, String(value));
  return value;
}

// --------------- Data Transfer (clipboard export / import) ---------------

const TRANSFER_EXCLUDE = /_sync_at_|_hash_|_server_|install_prompt_dismissed/;

export function exportAllData(): string {
  if (typeof window === "undefined") return "{}";
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (!(key.startsWith("cashflow_") || key.startsWith("velanovo-"))) continue;
    if (TRANSFER_EXCLUDE.test(key)) continue;
    data[key] = localStorage.getItem(key) ?? "";
  }
  return JSON.stringify(data);
}

export function importAllData(json: string): number {
  const data: Record<string, string> = JSON.parse(json);
  let count = 0;
  for (const [key, value] of Object.entries(data)) {
    if (!(key.startsWith("cashflow_") || key.startsWith("velanovo-"))) continue;
    localStorage.setItem(key, value);
    count++;
  }
  return count;
}

export function getMainPlanHash() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(scopedKey(MAIN_PLAN_HASH_KEY)) ?? "";
}

export function setMainPlanHash(hash: string) {
  if (typeof window === "undefined") return "";
  const value = hash ?? "";
  window.localStorage.setItem(scopedKey(MAIN_PLAN_HASH_KEY), value);
  return value;
}

// ── Re-exports for backward compatibility ─────────────────────────────────────
// Canonical location for scenario management: @/lib/scenarioStorage
export type { ScenarioMeta, ScenarioState } from "@/lib/scenarioStorage";
export {
  loadScenarioState,
  getActiveScenarioUpdatedAt,
  setActiveScenario,
  createScenario,
  renameScenario,
  deleteScenario,
} from "@/lib/scenarioStorage";

// Canonical location for audit log: @/lib/auditLog
export type { AuditEntry } from "@/lib/auditLog";
export {
  AUDIT_UPDATED_EVENT,
  loadAuditTrail,
  clearAuditTrail,
  getAuditActor,
  setAuditActor,
} from "@/lib/auditLog";
