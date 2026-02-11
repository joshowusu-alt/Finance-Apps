"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import type { Plan } from "@/data/plan";
import {
  getActiveScenarioUpdatedAt,
  getStorageScope,
  loadPlan,
  loadPreviousPlan,
  loadScenarioState,
  PLAN_UPDATED_EVENT,
  savePlanFromRemote,
  savePreviousPlan,
  setStorageScope,
} from "@/lib/storage";
import { DEFAULT_ALERT_PREFS, loadAlertPreferences, saveAlertPreferences } from "@/lib/alerts";
import {
  DEFAULT_ONBOARDING_STATE,
  DEFAULT_WIZARD_STATE,
  loadOnboardingState,
  loadWizardState,
  saveOnboardingState,
  saveWizardState,
} from "@/lib/onboarding";
import { getCurrency, setCurrency, type Currency } from "@/lib/currency";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import {
  PREFS_UPDATED_EVENT,
  getPreferencesUpdatedAt,
  touchPreferencesUpdatedAt,
} from "@/lib/preferencesSync";
import {
  getCloudPlanHash,
  getCloudPrefsHash,
  getCloudPrefsServerUpdatedAt,
  getCloudPrefsSyncedAt,
  getCloudServerSyncedAt,
  setCloudPlanHash,
  setCloudPrefsHash,
  setCloudPrefsServerUpdatedAt,
  setCloudPrefsSyncedAt,
  setCloudServerSyncedAt,
  setCloudServerUpdatedAt,
  setCloudSyncAt,
} from "@/lib/cloudSyncState";

type CloudPlanRow = {
  plan_json: Plan | string | null;
  prev_plan_json: Plan | string | null;
  updated_at: string | null;
};

type CloudPrefsRow = {
  theme: string | null;
  currency: string | null;
  alert_prefs: Record<string, unknown> | null;
  onboarding_state: Record<string, unknown> | null;
  wizard_state: Record<string, unknown> | null;
  updated_at: string | null;
};

function parsePlan(raw: CloudPlanRow["plan_json"], fallback: Plan): Plan {
  if (!raw) return fallback;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Plan;
    } catch {
      return fallback;
    }
  }
  return raw as Plan;
}

function parsePrev(raw: CloudPlanRow["prev_plan_json"]): Plan | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Plan;
    } catch {
      return null;
    }
  }
  return raw as Plan;
}

function hashValue(value: unknown) {
  try {
    return JSON.stringify(value ?? "");
  } catch {
    return "";
  }
}

function parseStamp(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildUserScope(userId: string) {
  return `user:${userId}`;
}

function scopeHasData(scope: string) {
  if (typeof window === "undefined") return false;
  const suffix = scope === "default" ? "" : `::${scope}`;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith("cashflow_")) continue;
    if (suffix) {
      if (key.endsWith(suffix)) return true;
    } else if (!key.includes("::")) {
      return true;
    }
  }
  return false;
}

function initializeFreshScope() {
  saveOnboardingState(DEFAULT_ONBOARDING_STATE);
  saveWizardState(DEFAULT_WIZARD_STATE);
  saveAlertPreferences(DEFAULT_ALERT_PREFS);
  setTheme("light");
  setCurrency("GBP");
}

function normalizePreferences(
  row: CloudPrefsRow,
  fallback: ReturnType<typeof getLocalPreferences>
): ReturnType<typeof getLocalPreferences> {
  return {
    theme: (row.theme as Theme) ?? fallback.theme,
    currency: (row.currency as Currency) ?? fallback.currency,
    alert_prefs: (row.alert_prefs as typeof fallback.alert_prefs) ?? fallback.alert_prefs,
    onboarding_state: (row.onboarding_state as typeof fallback.onboarding_state) ?? fallback.onboarding_state,
    wizard_state: (row.wizard_state as typeof fallback.wizard_state) ?? fallback.wizard_state,
  };
}

function getLocalPreferences() {
  return {
    theme: getTheme(),
    currency: getCurrency(),
    alert_prefs: loadAlertPreferences(),
    onboarding_state: loadOnboardingState(),
    wizard_state: loadWizardState(),
  };
}

function applyPreferences(prefs: ReturnType<typeof normalizePreferences>, stamp?: number) {
  if (prefs.theme) setTheme(prefs.theme);
  if (prefs.currency) setCurrency(prefs.currency);
  if (prefs.alert_prefs) {
    const nextAlerts = { ...DEFAULT_ALERT_PREFS, ...prefs.alert_prefs };
    saveAlertPreferences(nextAlerts);
  }
  if (prefs.onboarding_state) {
    const nextOnboarding = {
      ...DEFAULT_ONBOARDING_STATE,
      ...prefs.onboarding_state,
    };
    saveOnboardingState(nextOnboarding);
  }
  if (prefs.wizard_state) {
    const nextWizard = {
      ...DEFAULT_WIZARD_STATE,
      ...prefs.wizard_state,
    };
    saveWizardState(nextWizard);
  }
  if (stamp) {
    touchPreferencesUpdatedAt(stamp);
  }
}

export default function CloudSync() {
  const { user, loading } = useAuth();
  const supabase = createClient();
  const syncInFlight = useRef(false);
  const syncQueued = useRef(false);

  useEffect(() => {
    if (loading) return;
    const currentScope = getStorageScope();

    if (!user) {
      if (currentScope.startsWith("user:")) {
        setStorageScope("default");
      }
      return;
    }

    if (currentScope === "main" || currentScope === "review") return;
    const targetScope = buildUserScope(user.id);
    if (currentScope !== targetScope) {
      const hasData = scopeHasData(targetScope);
      setStorageScope(targetScope);
      if (!hasData) {
        initializeFreshScope();
      }
    }
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user) return;

    const queueSync = () => {
      if (syncInFlight.current) {
        syncQueued.current = true;
        return;
      }
      void runSync();
    };

    const handleFocus = () => queueSync();
    const handlePlanUpdate = () => queueSync();
    const handlePrefsUpdate = () => queueSync();

    window.addEventListener("focus", handleFocus);
    window.addEventListener(PLAN_UPDATED_EVENT, handlePlanUpdate);
    window.addEventListener(PREFS_UPDATED_EVENT, handlePrefsUpdate);
    const intervalId = window.setInterval(queueSync, 30000);

    queueSync();

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(PLAN_UPDATED_EVENT, handlePlanUpdate);
      window.removeEventListener(PREFS_UPDATED_EVENT, handlePrefsUpdate);
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  async function runSync() {
    if (loading || !user) return;
    if (syncInFlight.current) {
      syncQueued.current = true;
      return;
    }

    const scope = getStorageScope();
    if (scope === "main" || scope === "review") return;

    syncInFlight.current = true;
    try {
      await syncScenarios();
      await syncPlan();
      await syncPreferences();
      setCloudSyncAt();
    } catch (error) {
      console.warn("Cloud sync failed:", error);
    } finally {
      syncInFlight.current = false;
      if (syncQueued.current) {
        syncQueued.current = false;
        void runSync();
      }
    }
  }

  async function syncScenarios() {
    if (!user) return;
    const scenarioState = loadScenarioState();
    if (!scenarioState.scenarios.length) return;

    const rows = scenarioState.scenarios.map((scenario) => ({
      user_id: user.id,
      scenario_id: scenario.id,
      name: scenario.name,
      active: scenario.id === scenarioState.activeId,
      created_at: scenario.createdAt,
      updated_at: scenario.updatedAt,
    }));

    await supabase.from("user_scenarios").upsert(rows, {
      onConflict: "user_id,scenario_id",
    });
  }

  async function syncPlan() {
    if (!user) return;
    const scenarioState = loadScenarioState();
    const scenarioId = scenarioState.activeId || "default";
    const localPlan = loadPlan();
    const localPrev = loadPreviousPlan();
    const localHash = hashValue(localPlan);
    const localUpdatedMs = parseStamp(getActiveScenarioUpdatedAt());

    const { data: serverRow } = await supabase
      .from("user_plans")
      .select("plan_json, prev_plan_json, updated_at")
      .eq("user_id", user.id)
      .eq("scenario_id", scenarioId)
      .maybeSingle();

    const serverPlan = parsePlan(serverRow?.plan_json ?? null, localPlan);
    const serverPrev = parsePrev(serverRow?.prev_plan_json ?? null);
    const serverUpdatedMs = parseStamp(serverRow?.updated_at ?? null);
    const serverHash = serverRow?.plan_json ? hashValue(serverPlan) : "";

    const lastSyncedServerUpdatedAt = getCloudServerSyncedAt(scenarioId) ?? 0;
    const lastSyncedHash = getCloudPlanHash(scenarioId);
    const hasBaseline = Boolean(lastSyncedHash) || Boolean(lastSyncedServerUpdatedAt);
    const localDirty = hasBaseline ? localHash !== lastSyncedHash : true;
    const serverChanged =
      serverUpdatedMs > 0 &&
      (!lastSyncedServerUpdatedAt || serverUpdatedMs !== lastSyncedServerUpdatedAt);

    if (!serverRow?.plan_json) {
      await pushPlan(localPlan, localPrev, scenarioId);
      return;
    }

    if (serverHash && serverHash === localHash) {
      if (serverUpdatedMs) {
        setCloudServerSyncedAt(scenarioId, serverUpdatedMs);
        setCloudServerUpdatedAt(scenarioId, serverUpdatedMs);
      }
      setCloudPlanHash(scenarioId, localHash);
      return;
    }

    if (serverChanged && localDirty) {
      if (localUpdatedMs >= serverUpdatedMs) {
        await pushPlan(localPlan, localPrev, scenarioId);
      } else {
        await pullPlan(serverPlan, serverPrev, serverUpdatedMs, scenarioId);
      }
      return;
    }

    if (serverChanged) {
      await pullPlan(serverPlan, serverPrev, serverUpdatedMs, scenarioId);
      return;
    }

    if (localDirty) {
      await pushPlan(localPlan, localPrev, scenarioId);
    }
  }

  async function pushPlan(plan: Plan, prev: Plan | null, scenarioId: string) {
    if (!user) return;
    const nowIso = new Date().toISOString();
    await supabase.from("user_plans").upsert(
      {
        user_id: user.id,
        scenario_id: scenarioId,
        plan_json: plan,
        prev_plan_json: prev,
        updated_at: nowIso,
      },
      { onConflict: "user_id,scenario_id" }
    );

    const updatedMs = parseStamp(nowIso);
    setCloudPlanHash(scenarioId, hashValue(plan));
    setCloudServerSyncedAt(scenarioId, updatedMs);
    setCloudServerUpdatedAt(scenarioId, updatedMs);
  }

  async function pullPlan(plan: Plan, prev: Plan | null, updatedMs: number, scenarioId: string) {
    savePlanFromRemote(plan, prev ?? null, updatedMs, "Cloud sync");
    if (prev) {
      savePreviousPlan(prev);
    }
    setCloudPlanHash(scenarioId, hashValue(plan));
    if (updatedMs) {
      setCloudServerSyncedAt(scenarioId, updatedMs);
      setCloudServerUpdatedAt(scenarioId, updatedMs);
    }
  }

  async function syncPreferences() {
    if (!user) return;
    const localPrefs = getLocalPreferences();
    const localHash = hashValue(localPrefs);
    const localUpdatedMs = parseStamp(getPreferencesUpdatedAt());

    const { data: serverRow } = await supabase
      .from("user_preferences")
      .select("theme, currency, alert_prefs, onboarding_state, wizard_state, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const normalizedServer = serverRow ? normalizePreferences(serverRow as CloudPrefsRow, localPrefs) : null;
    const serverHash = normalizedServer ? hashValue(normalizedServer) : "";
    const serverUpdatedMs = parseStamp(serverRow?.updated_at ?? null);

    const lastServerUpdatedAt = getCloudPrefsServerUpdatedAt() ?? 0;
    const lastSyncedHash = getCloudPrefsHash();
    const lastSyncedAt = getCloudPrefsSyncedAt() ?? 0;
    const hasBaseline = Boolean(lastSyncedHash) || Boolean(lastSyncedAt);
    const localDirty = hasBaseline ? localHash !== lastSyncedHash : true;
    const serverChanged =
      serverUpdatedMs > 0 && (!lastServerUpdatedAt || serverUpdatedMs !== lastServerUpdatedAt);

    if (!serverRow) {
      await pushPreferences(localPrefs);
      return;
    }

    if (serverHash && serverHash === localHash) {
      setCloudPrefsHash(localHash);
      if (serverUpdatedMs) {
        setCloudPrefsServerUpdatedAt(serverUpdatedMs);
        setCloudPrefsSyncedAt(serverUpdatedMs);
      }
      return;
    }

    if (serverChanged && localDirty) {
      if (localUpdatedMs >= serverUpdatedMs) {
        await pushPreferences(localPrefs);
      } else if (normalizedServer) {
        await pullPreferences(normalizedServer, serverUpdatedMs);
      }
      return;
    }

    if (serverChanged && normalizedServer) {
      await pullPreferences(normalizedServer, serverUpdatedMs);
      return;
    }

    if (localDirty) {
      await pushPreferences(localPrefs);
    }
  }

  async function pushPreferences(prefs: ReturnType<typeof getLocalPreferences>) {
    if (!user) return;
    const nowIso = new Date().toISOString();
    await supabase.from("user_preferences").upsert(
      {
        user_id: user.id,
        theme: prefs.theme,
        currency: prefs.currency,
        alert_prefs: prefs.alert_prefs,
        onboarding_state: prefs.onboarding_state,
        wizard_state: prefs.wizard_state,
        updated_at: nowIso,
      },
      { onConflict: "user_id" }
    );

    const updatedMs = parseStamp(nowIso);
    touchPreferencesUpdatedAt(updatedMs);
    setCloudPrefsHash(hashValue(prefs));
    setCloudPrefsServerUpdatedAt(updatedMs);
    setCloudPrefsSyncedAt(updatedMs);
  }

  async function pullPreferences(
    prefs: ReturnType<typeof normalizePreferences>,
    updatedMs: number
  ) {
    applyPreferences(prefs, updatedMs);
    setCloudPrefsHash(hashValue(prefs));
    if (updatedMs) {
      setCloudPrefsServerUpdatedAt(updatedMs);
      setCloudPrefsSyncedAt(updatedMs);
    }
  }

  return null;
}
