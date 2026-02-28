"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
// Version constant — avoids bundling package.json and resolveJsonModule edge-cases
const APP_VERSION = "2.0.0";
import SidebarNav from "@/components/SidebarNav";
import ThemeToggle from "@/components/ThemeToggle";
import CurrencySelector from "@/components/CurrencySelector";
import { loadPlan, savePlan, savePlanFromRemote, PLAN_UPDATED_EVENT } from "@/lib/storage";
import { formatMoney } from "@/lib/currency";
import { resetWizard } from "@/lib/onboarding";
import { loadBranding } from "@/lib/branding";
import { useAuth } from "@/contexts/AuthContext";
import { isLockEnabled, enableLock, disableLock, registerBiometric } from "@/components/BiometricLock";
import { CF_JOIN_TOKEN_KEY } from "@/lib/sharingConstants";
import { createClient } from "@/lib/supabase/client";
import CategoryManager from "@/components/CategoryManager";
import { showToast } from "@/components/Toast";
import type { Period, PeriodOverride, PeriodRuleOverride, Plan } from "@/data/plan";
import {
  isNotificationsSupported,
  getNotificationPermission,
  isNotificationsEnabled,
  requestNotificationPermission,
  enableNotifications,
  disableNotifications,
  resetNotificationCooldowns,
} from "@/lib/pushNotifications";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { todayISO } from "@/lib/dateUtils";


// ---------------------------------------------------------------------------
// Push notification preferences (persisted in localStorage)
// ---------------------------------------------------------------------------
const NOTIF_PREFS_KEY = "vn:notif-prefs";

interface NotifPrefs {
  billReminders: boolean;
  lowBalance: boolean;
  dailySummary: boolean;
}

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  billReminders: true,
  lowBalance: true,
  dailySummary: false,
};

function loadNotifPrefs(): NotifPrefs {
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(NOTIF_PREFS_KEY)
        : null;
    return raw ? (JSON.parse(raw) as NotifPrefs) : DEFAULT_NOTIF_PREFS;
  } catch {
    return DEFAULT_NOTIF_PREFS;
  }
}

function saveNotifPrefs(prefs: NotifPrefs): void {
  try {
    window.localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export default function SettingsPage() {
  const [plan, setPlan] = useState(() => loadPlan());

  useEffect(() => {
    const handler = () => setPlan(loadPlan());
    window.addEventListener(PLAN_UPDATED_EVENT, handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener(PLAN_UPDATED_EVENT, handler);
      window.removeEventListener('focus', handler);
    };
  }, []);

  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [periodFormData, setPeriodFormData] = useState<Partial<Period>>({
    label: "",
    start: "",
    end: "",
  });
  const [branding] = useState(() => loadBranding());
  const { user, loading: authLoading, signOut } = useAuth();

  // ── Balance calculator (Item 1) ────────────────────────────────────────────
  const [calcPeriodId, setCalcPeriodId] = useState<number | null>(null);
  const [calcCurrentBalance, setCalcCurrentBalance] = useState("");

  function calcImpliedStartBalance(period: Period, currentBalance: number): number {
    const today = todayISO();
    const txns = (plan.transactions ?? []).filter(
      (t) => t.date >= period.start && t.date <= today
    );
    const net = txns.reduce((sum, t) => {
      if (t.type === "income") return sum + t.amount;
      return sum - t.amount; // outflow, transfer, savings
    }, 0);
    return currentBalance - net;
  }

  function handleApplyCalcBalance(period: Period) {
    const val = parseFloat(calcCurrentBalance);
    if (isNaN(val)) return;
    const implied = calcImpliedStartBalance(period, val);
    handleSetStartingBalance(period.id, implied);
    setCalcPeriodId(null);
    setCalcCurrentBalance("");
  }

  // ── Household sharing (Item 3) ─────────────────────────────────────────────
  const [householdShareCode, setHouseholdShareCode] = useState("");
  const [householdJoinInput, setHouseholdJoinInput] = useState("");
  const [householdMsg, setHouseholdMsg] = useState("");
  const [householdLoading, setHouseholdLoading] = useState(false);
  const [joinedToken, setJoinedToken] = useState<string | null>(
    typeof window !== "undefined" ? window.localStorage.getItem(CF_JOIN_TOKEN_KEY) : null
  );

  // ── Data Recovery ─────────────────────────────────────────────────────────
  const [recoveryMsg, setRecoveryMsg] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  async function handleRestoreFromCloud() {
    setRecoveryLoading(true);
    setRecoveryMsg("");
    try {
      // Use client-side Supabase directly — PWA stores the session in
      // localStorage, not cookies, so server API routes cannot read it.
      const supabase = createClient();
      if (!supabase) {
        setRecoveryMsg("Cloud sync is not configured.");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRecoveryMsg("Not signed in — please sign in first.");
        return;
      }
      const { data: rows, error } = await supabase
        .from("user_plans")
        .select("plan_json, prev_plan_json, updated_at, scenario_id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) {
        setRecoveryMsg(`Database error: ${error.message}`);
        return;
      }
      if (!rows || rows.length === 0) {
        setRecoveryMsg("No cloud backup found.");
        return;
      }

      // Score a plan by how much real data it contains.
      // prev_plan_json may hold the user's real data if a blank plan was
      // pushed on top of it after a crash-loop data-loss event.
      function scoreP(p: unknown): number {
        if (!p || typeof p !== "object") return 0;
        const pl = p as Plan;
        return (
          (Array.isArray(pl.incomeRules) ? pl.incomeRules.length : 0) * 10 +
          (Array.isArray(pl.outflowRules) ? pl.outflowRules.length : 0) * 10 +
          (Array.isArray(pl.bills) ? pl.bills.length : 0) * 5 +
          (Array.isArray(pl.periods) ? pl.periods.length : 0) +
          (Array.isArray(pl.periodOverrides) ? pl.periodOverrides.length : 0) * 3
        );
      }

      let bestPlan: Plan | null = null;
      let bestScore = -1;

      for (const row of rows) {
        for (const col of [row.plan_json, row.prev_plan_json]) {
          const score = scoreP(col);
          if (score > bestScore) {
            bestScore = score;
            bestPlan = col as Plan | null;
          }
        }
      }

      if (!bestPlan || bestScore === 0) {
        setRecoveryMsg("Cloud backup is empty — no data to restore. Your data may not have been synced before it was lost.");
        return;
      }

      const pl = bestPlan as Plan;
      const summary = [
        pl.incomeRules?.length ? `${pl.incomeRules.length} income rules` : "",
        pl.outflowRules?.length ? `${pl.outflowRules.length} outflow rules` : "",
        pl.bills?.length ? `${pl.bills.length} bills` : "",
        pl.periods?.length ? `${pl.periods.length} periods` : "",
      ].filter(Boolean).join(", ");

      savePlanFromRemote(bestPlan, null, undefined, "cloud-recovery");
      setPlan(loadPlan());
      window.dispatchEvent(new Event(PLAN_UPDATED_EVENT));
      setRecoveryMsg(`✓ Restored: ${summary}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setRecoveryMsg(`Error: ${msg}`);
      showToast("Restore failed. Please try again.", "error");
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function handleRestoreFromBackup() {
    setRecoveryLoading(true);
    setRecoveryMsg("");
    try {
      const res = await fetch("/recovery-plan.json");
      if (!res.ok) throw new Error(`Could not load backup file (${res.status})`);
      const plan = await res.json() as Plan;
      if (!plan || !Array.isArray(plan.periods) || plan.periods.length === 0) {
        setRecoveryMsg("Backup file appears empty.");
        return;
      }
      savePlanFromRemote(plan, null, undefined, "local-backup-recovery");
      setPlan(loadPlan());
      window.dispatchEvent(new Event(PLAN_UPDATED_EVENT));
      const summary = [
        plan.incomeRules?.length ? `${plan.incomeRules.length} income rules` : "",
        plan.bills?.length ? `${plan.bills.length} bills` : "",
        plan.transactions?.length ? `${plan.transactions.length} transactions` : "",
        plan.periods?.length ? `${plan.periods.length} periods` : "",
      ].filter(Boolean).join(", ");
      setRecoveryMsg(`\u2713 Rebuilt: ${summary}`);
    } catch (e) {
      setRecoveryMsg(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setRecoveryLoading(false);
    }
  }

  function handleExportData() {
    try {
      const data = loadPlan();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "velanovo-backup.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setRecoveryMsg(`Export failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  async function handleGenerateShareCode() {
    setHouseholdLoading(true);
    setHouseholdMsg("");
    try {
      const res = await fetch("/api/shared", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const { shareCode } = (await res.json()) as { shareCode: string };
      setHouseholdShareCode(shareCode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setHouseholdMsg(`Error: ${msg}`);
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setHouseholdLoading(false);
    }
  }

  async function handleJoinPlan() {
    const code = householdJoinInput.trim().toUpperCase();
    if (!code) return;
    setHouseholdLoading(true);
    setHouseholdMsg("");
    try {
      const joinRes = await fetch("/api/shared/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!joinRes.ok) {
        const body = (await joinRes.json()) as { error?: string };
        throw new Error(body.error ?? "Invalid code");
      }
      const { joinToken } = (await joinRes.json()) as { joinToken: string };
      window.localStorage.setItem(CF_JOIN_TOKEN_KEY, joinToken);
      setJoinedToken(joinToken);

      // Pull shared plan immediately
      const planRes = await fetch("/api/main/plan", {
        method: "GET",
        credentials: "include",
        headers: { "X-Join-Token": joinToken },
      });
      if (planRes.ok) {
        const data = (await planRes.json()) as { plan?: Plan; prevPlan?: Plan | null; updatedAt?: number };
        if (data.plan) {
          savePlanFromRemote(data.plan, data.prevPlan ?? null, data.updatedAt);
          setPlan(loadPlan());
          window.dispatchEvent(new Event(PLAN_UPDATED_EVENT));
          setHouseholdMsg("Joined! Shared plan loaded. Both devices now share this plan.");
        }
      }
      setHouseholdJoinInput("");
    } catch (e) {
      setHouseholdMsg(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setHouseholdLoading(false);
    }
  }

  async function handleHouseholdSync() {
    const token = joinedToken;
    if (!token) return;
    setHouseholdLoading(true);
    setHouseholdMsg("");
    try {
      // Push local changes first
      const currentPlan = loadPlan();
      await fetch("/api/main/plan", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-Join-Token": token },
        body: JSON.stringify({ plan: currentPlan }),
      });
      // Pull latest
      const res = await fetch("/api/main/plan", {
        method: "GET",
        credentials: "include",
        headers: { "X-Join-Token": token },
      });
      if (res.ok) {
        const data = (await res.json()) as { plan?: Plan; prevPlan?: Plan | null; updatedAt?: number };
        if (data.plan) {
          savePlanFromRemote(data.plan, data.prevPlan ?? null, data.updatedAt);
          setPlan(loadPlan());
          window.dispatchEvent(new Event(PLAN_UPDATED_EVENT));
          setHouseholdMsg("Synced with shared plan ✓");
        }
      }
    } catch (e) {
      setHouseholdMsg(`Sync error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setHouseholdLoading(false);
    }
  }

  function handleLeaveSharedPlan() {
    if (!confirm("Leave the shared household plan? Your local plan will remain.")) return;
    window.localStorage.removeItem(CF_JOIN_TOKEN_KEY);
    setJoinedToken(null);
    setHouseholdShareCode("");
    setHouseholdMsg("Left shared plan.");
  }

  // ── Lock / Biometric state ────────────────────────────────────────────────
  const [lockEnabled, setLockEnabled] = useState(() =>
    typeof window !== "undefined" ? isLockEnabled() : false
  );
  const [pinSetup, setPinSetup] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState("");
  const [biometricStatus, setBiometricStatus] = useState<"idle"|"registered"|"error">("idle");

  async function handleEnableLock() {
    if (pinSetup.length < 4) { setPinError("PIN must be 4 digits"); return; }
    if (!/^\d{4}$/.test(pinSetup)) { setPinError("PIN must be 4 digits (numbers only)"); return; }
    if (pinSetup !== pinConfirm) { setPinError("PINs do not match"); return; }
    await enableLock(pinSetup);
    setLockEnabled(true);
    setPinSetup("");
    setPinConfirm("");
    setPinError("");
    setPinSuccess("Lock enabled — current session stays unlocked");
    setTimeout(() => setPinSuccess(""), 3000);
  }

  function handleDisableLock() {
    disableLock();
    setLockEnabled(false);
    setBiometricStatus("idle");
    setPinSetup("");
    setPinConfirm("");
    setPinError("");
    setPinSuccess("");
  }

  async function handleRegisterBiometric() {
    setBiometricStatus("idle");
    const ok = await registerBiometric();
    setBiometricStatus(ok ? "registered" : "error");
  }

  // ── Push subscription ─────────────────────────────────────────────────────
  const {
    isSupported: pushSupported,
    isSubscribed,
    isLoading: pushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePushSubscription();

  // ── Notification preferences (localStorage) ──────────────────────────────
  const [notifPrefs, setNotifPrefsState] = useState<NotifPrefs>(
    () => loadNotifPrefs()
  );

  function updateNotifPref<K extends keyof NotifPrefs>(
    key: K,
    value: NotifPrefs[K],
  ) {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefsState(updated);
    saveNotifPrefs(updated);
  }

  // ── Notifications state ──────────────────────────────────────────────────
  // Read browser APIs only on the client; initialize to safe defaults for SSR.
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    () => (typeof window !== "undefined" ? getNotificationPermission() : "default")
  );
  const [notifEnabled, setNotifEnabled] = useState(
    () => (typeof window !== "undefined" ? isNotificationsEnabled() : false)
  );

  const handleEnableNotifications = useCallback(async () => {
    if (notifPermission === "granted") {
      enableNotifications();
      resetNotificationCooldowns();
      setNotifEnabled(true);
    } else {
      const granted = await requestNotificationPermission();
      setNotifPermission(getNotificationPermission());
      setNotifEnabled(granted);
      if (granted) resetNotificationCooldowns();
    }
  }, [notifPermission]);

  const handleDisableNotifications = useCallback(() => {
    disableNotifications();
    setNotifEnabled(false);
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
    <main className="min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-40 pt-5">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav />
          <section className="space-y-6">
            <div className="vn-masthead">
              <div className="text-xs uppercase tracking-widest font-semibold text-white/50">Settings</div>
              <h1 className="text-2xl font-bold text-white/90" style={{ fontFamily: "var(--font-playfair, serif)" }}>App Settings</h1>
              <div className="mt-2 text-sm text-white/55">
                Customize your {branding.name} experience
              </div>
            </div>

            <div className="flex items-center gap-3 mb-3 mt-6 first:mt-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-(--vn-muted)">Account &amp; Sync</div>
              <div className="flex-1 h-px bg-(--vn-border)" />
            </div>
            {/* Account */}
            <div className="vn-card p-6">
              <div className="text-sm font-semibold text-(--vn-text) mb-4">Account</div>
              {authLoading ? (
                <div className="text-sm text-(--vn-muted)">Loading...</div>
              ) : user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-(--vn-primary)/15 text-(--vn-primary) font-semibold text-sm">
                      {(user.email?.[0] ?? "U").toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-(--vn-text)">{user.email}</div>
                      <div className="text-xs text-(--vn-muted)">Signed in · Cloud sync active</div>
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
                  <div className="text-sm text-(--vn-muted)">
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

            {/* Household & Sharing */}
            <div className="vn-card p-6">
              <div className="text-sm font-semibold text-(--vn-text) mb-1">Household &amp; Sharing</div>
              <div className="text-xs text-(--vn-muted) mb-4">Share your budget plan with a partner — both devices will sync to the same plan.</div>

              {joinedToken ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: "var(--vn-surface-raised)", border: "1px solid var(--vn-border)" }}>
                    <span className="text-emerald-500">✓</span>
                    <span className="text-(--vn-text) font-medium">Joined a shared household plan</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleHouseholdSync}
                      disabled={householdLoading}
                      className="vn-btn vn-btn-primary text-sm flex-1 disabled:opacity-50"
                    >
                      {householdLoading ? "Syncing…" : "Sync now"}
                    </button>
                    <button
                      onClick={handleLeaveSharedPlan}
                      className="vn-btn vn-btn-ghost text-sm text-red-500"
                    >
                      Leave
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Share section */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-(--vn-text)">Generate a share code</div>
                    <div className="text-xs text-(--vn-muted)">Share this code with your partner so they can join and sync your plan.</div>
                    {householdShareCode ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--vn-surface-raised)", border: "1px solid var(--vn-border)" }}>
                          <span className="text-xl font-mono font-bold tracking-widest text-(--vn-text) flex-1">{householdShareCode}</span>
                          <button
                            onClick={() => { navigator.clipboard?.writeText(householdShareCode); setHouseholdMsg("Code copied!"); setTimeout(() => setHouseholdMsg(""), 2000); }}
                            className="text-xs vn-btn vn-btn-ghost px-3 py-1.5"
                          >
                            Copy
                          </button>
                        </div>
                        <button onClick={() => setHouseholdShareCode("")} className="text-xs text-(--vn-muted) hover:text-(--vn-text)">
                          Hide code
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleGenerateShareCode}
                        disabled={householdLoading}
                        className="vn-btn vn-btn-primary text-sm disabled:opacity-50"
                      >
                        {householdLoading ? "Generating…" : "Share my plan"}
                      </button>
                    )}
                  </div>

                  <div className="border-t border-(--vn-border)" />

                  {/* Join section */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-(--vn-text)">Join a partner&apos;s plan</div>
                    <div className="text-xs text-(--vn-muted)">Enter the 6-character code your partner shared with you.</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={householdJoinInput}
                        onChange={(e) => setHouseholdJoinInput(e.target.value.toUpperCase())}
                        placeholder="ABCD12"
                        maxLength={8}
                        className="vn-input text-sm flex-1 font-mono tracking-widest"
                      />
                      <button
                        onClick={handleJoinPlan}
                        disabled={householdLoading || !householdJoinInput.trim()}
                        className="vn-btn vn-btn-primary text-sm disabled:opacity-50"
                      >
                        {householdLoading ? "Joining…" : "Join"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {householdMsg && (
                <p className="mt-3 text-xs text-(--vn-muted) rounded-lg px-3 py-2" style={{ background: "var(--vn-surface-raised)" }}>{householdMsg}</p>
              )}
            </div>

            <div className="flex items-center gap-3 mb-3 mt-6 first:mt-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-(--vn-muted)">Preferences</div>
              <div className="flex-1 h-px bg-(--vn-border)" />
            </div>
            <div className="vn-card p-6">
              <div className="text-sm font-semibold text-(--vn-text) mb-4">Appearance</div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-(--vn-text)">Dark Mode</div>
                    <div className="text-xs text-(--vn-muted)">Toggle between light and dark themes</div>
                  </div>
                  <ThemeToggle />
                </div>
              </div>
            </div>

            <div className="vn-card p-6">
              <div className="text-sm font-semibold text-(--vn-text) mb-4">Regional Settings</div>
              <CurrencySelector />
            </div>

            <div className="vn-card p-6">
              <div className="text-sm font-semibold text-(--vn-text) mb-4">As of Date</div>
              <div className="text-xs text-(--vn-muted) mb-4">
                Controls the reference date for filtering transactions and calculating time progress
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-(--vn-muted) mb-2">
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
                  <label htmlFor="auto-update-date" className="text-sm text-(--vn-muted)">
                    Auto-update to today on app load (recommended)
                  </label>
                </div>
              </div>
            </div>

            <div className="vn-card p-6">
              <div className="text-sm font-semibold text-(--vn-text) mb-2">Expected Minimum Balance</div>
              <div className="text-xs text-(--vn-muted) mb-4">
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
                <div className="mt-2 text-xs text-(--vn-muted)">
                  Currently set to {formatMoney(plan.setup.expectedMinBalance)}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mb-3 mt-6 first:mt-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-(--vn-muted)">Budget Periods</div>
              <div className="flex-1 h-px bg-(--vn-border)" />
            </div>
            <div className="vn-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-(--vn-text)">Periods</div>
                <button
                  onClick={handleAddPeriod}
                  className="vn-btn vn-btn-primary text-xs px-3 py-1.5"
                >
                  + Add Period
                </button>
              </div>
              <div className="space-y-3">
                {plan.periods.length === 0 ? (
                  <div className="text-(--vn-muted) text-xs">No periods yet. Add one to get started.</div>
                ) : (
                  plan.periods.map((period) => (
                    <div
                      key={period.id}
                      className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg ${period.id === plan.setup.selectedPeriodId
                        ? "bg-(--vn-primary)/10 border border-(--vn-primary)/30"
                        : "bg-(--vn-bg) border border-(--vn-border)"
                        }`}
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-(--vn-text)">
                          {period.label}
                          {period.id === plan.setup.selectedPeriodId && (
                            <span className="ml-2 text-xs text-(--vn-primary)">(Active)</span>
                          )}
                        </div>
                        <div className="text-xs text-(--vn-muted)">
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

            <div className="vn-card p-6">
              <div className="text-sm font-semibold text-(--vn-text) mb-4">Period Overrides</div>
              <div className="text-xs text-(--vn-muted) mb-4">
                Customize specific periods without affecting base rules
              </div>

              {plan.periods.length === 0 ? (
                <div className="text-(--vn-muted) text-xs">Add periods first to manage overrides.</div>
              ) : (
                <div className="space-y-4">
                  {plan.periods.map((period) => {
                    const override = getPeriodOverride(period.id);
                    const disabledBills = override?.disabledBills || [];
                    const hasOverrides = disabledBills.length > 0 || override?.startingBalance !== undefined ||
                      plan.periodRuleOverrides.some((o) => o.periodId === period.id);

                    return (
                      <details key={period.id} className="rounded-2xl border border-(--vn-border) bg-(--vn-surface) px-4 py-3">
                        <summary className="cursor-pointer font-semibold text-(--vn-text) flex items-center justify-between">
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
                            <label className="block text-xs font-medium text-(--vn-muted) mb-2">
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
                            {/* Balance calculator helper */}
                            {calcPeriodId === period.id ? (
                              <div className="mt-2 flex flex-col gap-2 rounded-lg p-3 text-xs" style={{ background: "var(--vn-surface-raised)", border: "1px solid var(--vn-border)" }}>
                                <div className="font-medium text-(--vn-text)">Back-calculate from today&apos;s bank balance</div>
                                <div className="text-(--vn-muted)">Enter your current bank balance and we&apos;ll work out what the period&apos;s opening balance should have been.</div>
                                <div className="flex items-center gap-2">
                                  <input
                                    autoFocus
                                    type="number"
                                    step="0.01"
                                    value={calcCurrentBalance}
                                    onChange={(e) => setCalcCurrentBalance(e.target.value)}
                                    placeholder="Current bank balance"
                                    className="vn-input text-sm flex-1"
                                  />
                                  <button
                                    onClick={() => handleApplyCalcBalance(period)}
                                    className="vn-btn vn-btn-primary text-xs px-3 py-2"
                                  >
                                    Apply
                                  </button>
                                  <button
                                    onClick={() => { setCalcPeriodId(null); setCalcCurrentBalance(""); }}
                                    className="text-xs text-(--vn-muted) hover:text-(--vn-text)"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                {calcCurrentBalance && !isNaN(parseFloat(calcCurrentBalance)) && (
                                  <div className="text-(--vn-muted)">
                                    Implied opening balance: <span className="font-semibold text-(--vn-text)">{formatMoney(calcImpliedStartBalance(period, parseFloat(calcCurrentBalance)))}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => { setCalcPeriodId(period.id); setCalcCurrentBalance(""); }}
                                className="mt-2 text-xs text-(--vn-primary) hover:underline"
                              >
                                💡 Calculate from today&apos;s bank balance
                              </button>
                            )}
                          </div>

                          {/* Disabled Bills */}
                          {plan.bills.length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-(--vn-muted) mb-2">
                                Disabled Bills for this Period
                              </div>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {plan.bills.map((bill) => {
                                  const isDisabled = disabledBills.includes(bill.id);
                                  return (
                                    <div key={bill.id} className="flex items-center gap-2 p-2 rounded bg-(--vn-bg)">
                                      <input
                                        type="checkbox"
                                        id={`bill-${period.id}-${bill.id}`}
                                        checked={isDisabled}
                                        onChange={() => handleToggleBillForPeriod(period.id, bill.id)}
                                        className="rounded"
                                      />
                                      <label
                                        htmlFor={`bill-${period.id}-${bill.id}`}
                                        className="text-xs text-(--vn-muted) flex-1 cursor-pointer"
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
                              <div className="text-xs font-medium text-(--vn-muted) mb-2">
                                Disabled Income Rules for this Period
                              </div>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {plan.incomeRules.map((rule) => {
                                  const ruleOverride = getRuleOverride(period.id, rule.id, "income");
                                  const isDisabled = ruleOverride?.enabled === false;
                                  return (
                                    <div key={rule.id} className="flex items-center gap-2 p-2 rounded bg-(--vn-bg)">
                                      <input
                                        type="checkbox"
                                        id={`income-${period.id}-${rule.id}`}
                                        checked={isDisabled}
                                        onChange={() => handleToggleRuleForPeriod(period.id, rule.id, "income")}
                                        className="rounded"
                                      />
                                      <label
                                        htmlFor={`income-${period.id}-${rule.id}`}
                                        className="text-xs text-(--vn-muted) flex-1 cursor-pointer"
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
                              <div className="text-xs font-medium text-(--vn-muted) mb-2">
                                Disabled Outflow Rules for this Period
                              </div>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {plan.outflowRules.map((rule) => {
                                  const ruleOverride = getRuleOverride(period.id, rule.id, "outflow");
                                  const isDisabled = ruleOverride?.enabled === false;
                                  return (
                                    <div key={rule.id} className="flex items-center gap-2 p-2 rounded bg-(--vn-bg)">
                                      <input
                                        type="checkbox"
                                        id={`outflow-${period.id}-${rule.id}`}
                                        checked={isDisabled}
                                        onChange={() => handleToggleRuleForPeriod(period.id, rule.id, "outflow")}
                                        className="rounded"
                                      />
                                      <label
                                        htmlFor={`outflow-${period.id}-${rule.id}`}
                                        className="text-xs text-(--vn-muted) flex-1 cursor-pointer"
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

            <div className="flex items-center gap-3 mb-3 mt-6 first:mt-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-(--vn-muted)">Privacy &amp; Security</div>
              <div className="flex-1 h-px bg-(--vn-border)" />
            </div>
            {/* ── Privacy & Security ────────────────────────────────────── */}
            <div className="vn-card p-6">
              <div className="text-sm font-semibold text-(--vn-text) mb-1">Privacy &amp; Security</div>
              <p className="text-xs text-(--vn-muted) mb-4">
                Lock the app with a 4-digit PIN. On supported devices, you can also unlock with Face ID or Touch ID.
              </p>
              {lockEnabled ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400">🔒 Lock is ON</span>
                    <button
                      type="button"
                      onClick={handleDisableLock}
                      className="ml-auto text-xs text-rose-600 hover:text-rose-800 font-medium px-3 py-1.5 rounded-lg"
                      style={{ background: "var(--vn-surface-raised, var(--vn-surface))" }}
                    >
                      Disable lock
                    </button>
                  </div>
                  <div className="pt-2 border-t border-(--vn-border)">
                    <div className="text-xs text-(--vn-muted) mb-2">Register biometrics (Face ID / Touch ID)</div>
                    <button
                      type="button"
                      onClick={handleRegisterBiometric}
                      className="vn-btn vn-btn-ghost text-xs px-4 py-2"
                    >
                      {biometricStatus === "registered" ? "✓ Registered" : biometricStatus === "error" ? "Failed — try again" : "Set up biometrics"}
                    </button>
                    {biometricStatus === "registered" && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Biometrics registered — use face/finger on the lock screen.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-(--vn-muted) mb-1">New PIN (4 digits)</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={pinSetup}
                        onChange={(e) => { setPinSetup(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(""); }}
                        placeholder="••••"
                        className="vn-input text-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-(--vn-muted) mb-1">Confirm PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={pinConfirm}
                        onChange={(e) => { setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(""); }}
                        placeholder="••••"
                        className="vn-input text-sm w-full"
                      />
                    </div>
                  </div>
                  {pinError && <p className="text-xs text-rose-500">{pinError}</p>}
                  {pinSuccess && <p className="text-xs text-emerald-600 dark:text-emerald-400">{pinSuccess}</p>}
                  <button
                    type="button"
                    onClick={handleEnableLock}
                    disabled={pinSetup.length < 4}
                    className="vn-btn vn-btn-primary text-xs px-4 py-2 disabled:opacity-50"
                  >
                    Enable lock
                  </button>
                </div>
              )}
            </div>

            {/* ── Plan & Billing — greyed out during review phase ────── */}
            <div className="flex items-center gap-3 mb-3 mt-6 first:mt-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-(--vn-muted)">Plan &amp; Billing</div>
              <div className="flex-1 h-px bg-(--vn-border)" />
            </div>
            <div className="vn-card p-4 opacity-50 pointer-events-none select-none" aria-hidden="true">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-(--vn-text)">Velanovo Pro</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--vn-gold) 15%, transparent)", color: "var(--vn-gold)" }}>REVIEW ACCESS</span>
                  </div>
                  <div className="text-xs text-(--vn-muted) mt-0.5">Billing coming soon — all features unlocked during review phase.</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-3 mt-6 first:mt-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-(--vn-muted)">Notifications</div>
              <div className="flex-1 h-px bg-(--vn-border)" />
            </div>
            {/* ── Notifications ─────────────────────────────────────────── */}
            <div className="vn-card p-6">
              <div className="text-sm font-semibold text-(--vn-text) mb-1">Notifications</div>
              <p className="text-xs text-(--vn-muted) mb-4">
                Get a browser notification when low balance risk, missed income, or large bills are detected — fires when you open or return to the app.
              </p>

              {!isNotificationsSupported() ? (
                <div className="text-xs text-(--vn-muted) rounded-xl bg-(--vn-surface) p-3">
                  Browser notifications are not supported in this context.
                </div>
              ) : notifPermission === "denied" ? (
                <div className="text-xs text-amber-600 dark:text-amber-400 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                  Notifications were blocked by your browser. Please allow them in your browser site settings then return here.
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-(--vn-text)">
                      {notifEnabled ? "Notifications are on" : "Notifications are off"}
                    </div>
                    <div className="text-xs text-(--vn-muted) mt-0.5">
                      {notifPermission === "granted"
                        ? "Permission granted — alerts fire on tab focus"
                        : "Permission not yet granted"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={notifEnabled ? handleDisableNotifications : handleEnableNotifications}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      notifEnabled
                        ? "bg-(--vn-accent) focus:ring-(--vn-accent)"
                        : "bg-(--vn-border) focus:ring-(--vn-border)"
                    }`}
                    role="switch"
                    aria-checked={notifEnabled}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                        notifEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            {/* ── Push Alerts ───────────────────────────────────────────── */}
            <div className="vn-card p-6 space-y-5">
              <div>
                <div className="text-sm font-semibold text-(--vn-text) mb-1">Push Alerts</div>
                <p className="text-xs text-(--vn-muted)">
                  Personalised daily push notifications sent to this device.
                  Subscribe once and we&apos;ll alert you about bills, low balance, or your daily budget — no app open required.
                </p>
              </div>

              {/* Subscribe / Unsubscribe */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-(--vn-text)">
                    {isSubscribed ? "Push notifications active" : "Push notifications inactive"}
                  </div>
                  <div className="text-xs text-(--vn-muted) mt-0.5">
                    {pushSupported
                      ? isSubscribed
                        ? "This device will receive daily alerts"
                        : "Subscribe to receive alerts on this device"
                      : "Push notifications are not supported in this browser"}
                  </div>
                </div>
                {pushSupported && (
                  <button
                    type="button"
                    disabled={pushLoading}
                    onClick={isSubscribed ? unsubscribePush : subscribePush}
                    className={`vn-btn text-xs shrink-0 ${
                      isSubscribed ? "vn-btn-ghost" : "vn-btn-primary"
                    }`}
                  >
                    {pushLoading
                      ? "…"
                      : isSubscribed
                      ? "Unsubscribe"
                      : "Subscribe"}
                  </button>
                )}
              </div>

              {/* Preference toggles */}
              <div className="space-y-3 pt-2" style={{ borderTop: "1px solid var(--vn-border)" }}>
                <div className="text-xs font-semibold uppercase tracking-widest text-(--vn-muted) mb-2">
                  Alert types
                </div>

                {(
                  [
                    {
                      key: "billReminders" as const,
                      label: "Bill reminders",
                      desc: "Alert when a bill is due within 2 days",
                    },
                    {
                      key: "lowBalance" as const,
                      label: "Low balance",
                      desc: "Alert when running balance drops below £100",
                    },
                    {
                      key: "dailySummary" as const,
                      label: "Daily budget summary",
                      desc: "Daily £/day remaining message",
                    },
                  ] as const
                ).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm text-(--vn-text)">{label}</div>
                      <div className="text-xs text-(--vn-muted)">{desc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateNotifPref(key, !notifPrefs[key])}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        notifPrefs[key]
                          ? "bg-(--vn-accent) focus:ring-(--vn-accent)"
                          : "bg-(--vn-border) focus:ring-(--vn-border)"
                      }`}
                      role="switch"
                      aria-checked={notifPrefs[key]}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                          notifPrefs[key] ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="vn-card p-6">
              <div className="text-sm font-semibold text-(--vn-text) mb-1">Bill Detection Sensitivity</div>
              <p className="text-xs text-(--vn-muted) mb-5">
                Only show bill suggestions above this confidence level. Lower = more suggestions; higher = only clearly recurring patterns.
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={20}
                  max={85}
                  step={5}
                  value={plan.setup.billDetectionMinConfidence ?? 50}
                  onChange={(e) => {
                    const updated = { ...plan, setup: { ...plan.setup, billDetectionMinConfidence: Number(e.target.value) } };
                    savePlan(updated);
                    setPlan(updated);
                  }}
                  className="flex-1"
                  style={{ accentColor: "var(--gold)" }}
                />
                <span className="text-sm font-bold text-(--vn-text) w-12 text-right shrink-0">
                  {plan.setup.billDetectionMinConfidence ?? 50}%
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-(--vn-muted) mt-1">
                <span>More suggestions</span>
                <span>Fewer, clearer patterns</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-3 mt-6 first:mt-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-(--vn-muted)">Categories</div>
              <div className="flex-1 h-px bg-(--vn-border)" />
            </div>
            <div className="vn-card p-4">
              <div className="text-sm font-semibold text-(--vn-text) mb-1">Custom Categories</div>
              <p className="text-xs text-(--vn-muted) mb-4">
                Customise how your spending is organised. Built-in categories cannot be removed, but you can add subcategories under them.
              </p>
              <CategoryManager
                customCategories={plan?.customCategories ?? []}
                onChange={(cats) => {
                  if (!plan) return;
                  const updated = { ...plan, customCategories: cats };
                  savePlan(updated);
                  setPlan(updated);
                }}
              />
            </div>

            <div className="flex items-center gap-3 mb-3 mt-6 first:mt-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-(--vn-muted)">Data Recovery</div>
              <div className="flex-1 h-px bg-(--vn-border)" />
            </div>
            <div className="vn-card p-6 space-y-4">
              <div>
                <div className="text-sm font-semibold text-(--vn-text) mb-1">Restore from Cloud</div>
                <p className="text-xs text-(--vn-muted) mb-3">
                  Pull the latest plan saved to your cloud account and overwrite local data. Use this if your local data was cleared or lost.
                </p>
                <button
                  onClick={handleRestoreFromCloud}
                  disabled={recoveryLoading}
                  className="vn-btn vn-btn-primary text-xs"
                >
                  {recoveryLoading ? "Restoring…" : "Restore from Cloud"}
                </button>
              </div>
              <div>
                <div className="text-sm font-semibold text-(--vn-text) mb-1">Rebuild from Backup File</div>
                <p className="text-xs text-(--vn-muted) mb-3">
                  Reconstructs your budget from a known-good local backup — 18 bills, 3 income streams, 130 transactions, 12 periods.
                </p>
                <button
                  onClick={handleRestoreFromBackup}
                  disabled={recoveryLoading}
                  className="vn-btn vn-btn-primary text-xs"
                >
                  {recoveryLoading ? "Rebuilding\u2026" : "Rebuild from Backup"}
                </button>
              </div>
              <div>
                <div className="text-sm font-semibold text-(--vn-text) mb-1">Export Data</div>
                <p className="text-xs text-(--vn-muted) mb-3">
                  Download your current plan as a JSON file for safekeeping.
                </p>
                <button
                  onClick={handleExportData}
                  className="vn-btn vn-btn-ghost text-xs"
                >
                  Export Data
                </button>
              </div>
              {recoveryMsg && (
                <p className={`text-xs font-medium ${
                  recoveryMsg.startsWith("✓") ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
                }`}>
                  {recoveryMsg}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 mb-3 mt-6 first:mt-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-(--vn-muted)">About</div>
              <div className="flex-1 h-px bg-(--vn-border)" />
            </div>
            <div className="vn-card p-6">
              <div className="text-sm font-semibold text-(--vn-text) mb-4">About</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-(--vn-muted)">Version</span>
                  <span className="font-medium text-(--vn-text)">{APP_VERSION} (Build {(process.env.NEXT_PUBLIC_BUILD_TIME ?? new Date().toISOString()).slice(0, 16).replace("T", " ")})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--vn-muted)">App Name</span>
                  <span className="font-medium text-(--vn-text)">{branding.name}</span>
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
            <h2 className="text-lg font-semibold text-(--vn-text) mb-4">
              {editingPeriod ? "Edit Period" : "Add Period"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-(--vn-muted) mb-1">
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
                <label className="block text-xs font-medium text-(--vn-muted) mb-1">
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
                <label className="block text-xs font-medium text-(--vn-muted) mb-1">
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
