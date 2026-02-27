/**
 * scenarioStorage.ts
 *
 * Canonical home for all scenario-management state:
 * types, localStorage I/O, cache, and CRUD helpers.
 *
 * Intentionally self-contained — no imports from storage.ts — to avoid
 * circular dependencies. Shared constants (SCOPE_KEY, DEFAULT_SCOPE, etc.)
 * are mirrored here rather than re-imported.
 */

import { PLAN_VERSION } from "@/data/plan";
import type { Plan } from "@/data/plan";

// ── Storage keys (mirrored from storage.ts; must stay in sync) ───────────────
const PLAN_KEY = "cashflow_plan_v2";
const PREV_PLAN_KEY = "cashflow_prev_plan_v1";
const SCENARIO_KEY = "cashflow_scenarios_v1";
const SCOPE_KEY = "cashflow_scope_v1";
const DEFAULT_SCOPE = "default";

// ── Local utility helpers ─────────────────────────────────────────────────────

function getScope(): string {
  if (typeof window === "undefined") return DEFAULT_SCOPE;
  const scope = window.localStorage.getItem(SCOPE_KEY);
  return scope && scope.trim() ? scope : DEFAULT_SCOPE;
}

function scopedKey(baseKey: string, scope = getScope()): string {
  return scope === DEFAULT_SCOPE ? baseKey : `${baseKey}::${scope}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensurePlanVersion(plan: Plan): Plan {
  if (plan.version === PLAN_VERSION) return plan;
  return { ...plan, version: PLAN_VERSION };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScenarioMeta = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ScenarioState = {
  activeId: string;
  scenarios: ScenarioMeta[];
};

type ScenarioCache = {
  key: string;
  raw: string | null;
  state: ScenarioState;
};

// ── Module-level cache ────────────────────────────────────────────────────────

let scenarioCache: ScenarioCache | null = null;

// ── Key builders (exported so storage.ts can construct plan storage keys) ─────

export function scenarioPlanKey(id: string, scope = getScope()): string {
  const baseKey = scopedKey(PLAN_KEY, scope);
  return id === "default" ? baseKey : `${baseKey}::${id}`;
}

export function scenarioPrevPlanKey(id: string, scope = getScope()): string {
  const baseKey = scopedKey(PREV_PLAN_KEY, scope);
  return id === "default" ? baseKey : `${baseKey}::${id}`;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function defaultScenarioState(): ScenarioState {
  const stamp = nowIso();
  return {
    activeId: "default",
    scenarios: [{ id: "default", name: "Main plan", createdAt: stamp, updatedAt: stamp }],
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function loadScenarioState(): ScenarioState {
  if (typeof window === "undefined") return defaultScenarioState();
  const scope = getScope();
  const key = scopedKey(SCENARIO_KEY, scope);
  const raw = window.localStorage.getItem(key);
  if (scenarioCache && scenarioCache.key === key && scenarioCache.raw === raw) {
    return scenarioCache.state;
  }
  if (!raw) {
    const created = defaultScenarioState();
    window.localStorage.setItem(key, JSON.stringify(created));
    scenarioCache = { key, raw: JSON.stringify(created), state: created };
    return created;
  }
  try {
    const parsed = JSON.parse(raw) as ScenarioState;
    const scenarios = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];
    if (scenarios.length === 0) {
      const created = defaultScenarioState();
      window.localStorage.setItem(key, JSON.stringify(created));
      return created;
    }
    const normalized = scenarios.map((scenario) => ({
      id: scenario.id,
      name: scenario.name || "Scenario",
      createdAt: scenario.createdAt || nowIso(),
      updatedAt: scenario.updatedAt || nowIso(),
    }));
    const activeId = normalized.some((s) => s.id === parsed.activeId)
      ? parsed.activeId
      : normalized[0].id;
    const state = { activeId, scenarios: normalized };
    window.localStorage.setItem(key, JSON.stringify(state));
    scenarioCache = { key, raw: JSON.stringify(state), state };
    return state;
  } catch {
    const created = defaultScenarioState();
    window.localStorage.setItem(key, JSON.stringify(created));
    scenarioCache = { key, raw: JSON.stringify(created), state: created };
    return created;
  }
}

export function saveScenarioState(state: ScenarioState): void {
  if (typeof window === "undefined") return;
  const scope = getScope();
  const key = scopedKey(SCENARIO_KEY, scope);
  const raw = JSON.stringify(state);
  window.localStorage.setItem(key, raw);
  scenarioCache = { key, raw, state };
}

export function getActiveScenarioUpdatedAt(): string {
  if (typeof window === "undefined") return "";
  const state = loadScenarioState();
  const active = state.scenarios.find((scenario) => scenario.id === state.activeId);
  return active?.updatedAt ?? "";
}

export function setActiveScenario(id: string): ScenarioState {
  if (typeof window === "undefined") return defaultScenarioState();
  const state = loadScenarioState();
  if (!state.scenarios.some((scenario) => scenario.id === id)) {
    return state;
  }
  const next = { ...state, activeId: id };
  saveScenarioState(next);
  return next;
}

export function createScenario(name: string, plan: Plan): ScenarioState {
  if (typeof window === "undefined") return defaultScenarioState();
  const state = loadScenarioState();
  const id = `scenario-${Date.now()}`;
  const stamp = nowIso();
  const next = {
    activeId: id,
    scenarios: [
      ...state.scenarios,
      { id, name: name || "Scenario", createdAt: stamp, updatedAt: stamp },
    ],
  };
  window.localStorage.setItem(scenarioPlanKey(id), JSON.stringify(ensurePlanVersion(plan)));
  saveScenarioState(next);
  return next;
}

export function renameScenario(id: string, name: string): ScenarioState {
  if (typeof window === "undefined") return defaultScenarioState();
  const state = loadScenarioState();
  const next = {
    ...state,
    scenarios: state.scenarios.map((scenario) =>
      scenario.id === id ? { ...scenario, name: name || scenario.name } : scenario
    ),
  };
  saveScenarioState(next);
  return next;
}

export function deleteScenario(id: string): ScenarioState {
  if (typeof window === "undefined") return defaultScenarioState();
  const state = loadScenarioState();
  if (state.scenarios.length <= 1) return state;
  const remaining = state.scenarios.filter((scenario) => scenario.id !== id);
  const activeId = state.activeId === id ? remaining[0].id : state.activeId;
  const next = { activeId, scenarios: remaining };
  window.localStorage.removeItem(scenarioPlanKey(id));
  window.localStorage.removeItem(scenarioPrevPlanKey(id));
  saveScenarioState(next);
  return next;
}
