"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getActiveScenarioUpdatedAt,
  getMainSyncAt,
  getMainPlanHash,
  getMainServerUpdatedAt,
  getMainServerSyncedAt,
  getStorageScope,
  loadPlan,
  loadPreviousPlan,
  MAIN_SYNC_EVENT,
  PLAN_UPDATED_EVENT,
  savePlan,
  savePlanFromRemote,
  savePreviousPlan,
  setMainPlanHash,
  setMainSyncAt,
  setMainServerUpdatedAt,
  setMainServerSyncedAt,
  setStorageScope,
} from "@/lib/storage";
import type { Plan } from "@/data/plan";

type LinkState = "idle" | "loading" | "copied" | "error";
type SyncState = "idle" | "syncing" | "error";

type ConflictState = {
  serverPlan: Plan;
  prevPlan: Plan | null;
  serverUpdatedAt: number | null;
};

function buildLink(token: string, baseUrl: string) {
  const origin = baseUrl.replace(/\/+$/, "");
  return `${origin}/main?token=${encodeURIComponent(token)}`;
}

function formatStamp(value?: string | number | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hashPlan(plan: Plan) {
  return JSON.stringify(plan);
}

export default function MainSyncLink() {
  const [scope, setScope] = useState<string>("default");
  const [status, setStatus] = useState<LinkState>("idle");
  const [syncStatus, setSyncStatus] = useState<SyncState>("idle");
  const [lastSyncAt, setLastSyncAt] = useState("");
  const [lastLocalUpdatedAt, setLastLocalUpdatedAt] = useState("");
  const [lastServerUpdatedAt, setLastServerUpdatedAt] = useState<number | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const syncInFlight = useRef(false);
  const conflictRef = useRef(false);

  const lastSyncLabel = useMemo(() => {
    if (!lastSyncAt) return "";
    const d = new Date(lastSyncAt);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [lastSyncAt]);

  const lastLocalLabel = useMemo(() => formatStamp(lastLocalUpdatedAt), [lastLocalUpdatedAt]);
  const lastServerLabel = useMemo(
    () => formatStamp(lastServerUpdatedAt ?? undefined),
    [lastServerUpdatedAt]
  );

  const syncHint = useMemo(() => {
    if (conflict) {
      return {
        label: "Conflict detected.",
        action: "Resolve below",
        tone: "text-rose-300",
      };
    }
    if (scope !== "main") {
      return {
        label: "Enable main sync to compare changes.",
        action: "",
        tone: "text-slate-300",
      };
    }

    const localUpdatedMs = lastLocalUpdatedAt ? new Date(lastLocalUpdatedAt).getTime() : 0;
    const serverUpdatedMs = lastServerUpdatedAt ?? 0;
    if (!localUpdatedMs && !serverUpdatedMs) {
      return {
        label: "No sync data yet.",
        action: "Tap Sync now",
        tone: "text-slate-300",
      };
    }
    if (!serverUpdatedMs) {
      return {
        label: "Server has no data yet.",
        action: "Sync now to push",
        tone: "text-amber-300",
      };
    }
    if (!localUpdatedMs) {
      return {
        label: "This device has no changes yet.",
        action: "Sync now to pull",
        tone: "text-amber-300",
      };
    }
    if (localUpdatedMs > serverUpdatedMs) {
      return {
        label: "This device is newer.",
        action: "Sync now to push",
        tone: "text-amber-300",
      };
    }
    if (serverUpdatedMs > localUpdatedMs) {
      return {
        label: "Server is newer.",
        action: "Sync now to pull",
        tone: "text-amber-300",
      };
    }
    return {
      label: "Up to date.",
      action: "No action needed",
      tone: "text-amber-400",
    };
  }, [conflict, lastLocalUpdatedAt, lastServerUpdatedAt, scope]);

  useEffect(() => {
    const refresh = () => setScope(getStorageScope());
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => {
    conflictRef.current = Boolean(conflict);
  }, [conflict]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const syncWithServer = async () => {
      if (getStorageScope() !== "main") return;
      if (conflictRef.current) return;
      if (syncInFlight.current) return;
      if (document.visibilityState === "hidden") return;
      syncInFlight.current = true;
      try {
        const localPlan = loadPlan();
        const localPrev = loadPreviousPlan();
        const localUpdatedAt = getActiveScenarioUpdatedAt();
        setLastLocalUpdatedAt(localUpdatedAt);

        const res = await fetch("/api/main/plan", { method: "GET", credentials: "include" });
        const data = (await res.json()) as {
          plan?: unknown;
          prevPlan?: unknown;
          updatedAt?: number;
        };
        const serverUpdatedMs =
          typeof data?.updatedAt === "number" ? data.updatedAt : 0;
        setLastServerUpdatedAt(serverUpdatedMs || null);
        setMainServerUpdatedAt(serverUpdatedMs || null);
        const serverPlan = data?.plan as Plan | undefined;
        const serverPlanHash = serverPlan ? hashPlan(serverPlan) : "";
        const lastSyncedServerUpdatedAt = getMainServerSyncedAt();
        const lastSyncedHash = getMainPlanHash();
        const localHash = hashPlan(localPlan);
        const hasBaseline = Boolean(lastSyncedHash) || Boolean(lastSyncedServerUpdatedAt);
        const localDirty = hasBaseline ? localHash !== lastSyncedHash : true;
        const serverChanged =
          serverUpdatedMs > 0 &&
          (!lastSyncedServerUpdatedAt || serverUpdatedMs !== lastSyncedServerUpdatedAt);
        const serverHasPrev = Boolean(data?.prevPlan);
        const serverPrevSame =
          serverHasPrev && JSON.stringify(data.prevPlan) === JSON.stringify(data.plan);

        if (!serverPlan) {
          const pushRes = await fetch("/api/main/plan", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: localPlan, prevPlan: localPrev }),
            credentials: "include",
          });
          const pushData = (await pushRes.json().catch(() => null)) as { updatedAt?: number } | null;
          const syncedAt = typeof pushData?.updatedAt === "number" ? pushData.updatedAt : null;
          if (syncedAt) {
            setMainServerSyncedAt(syncedAt);
            setMainServerUpdatedAt(syncedAt);
            setLastServerUpdatedAt(syncedAt);
          }
          setMainPlanHash(localHash);
          setLastSyncAt(setMainSyncAt());
          return;
        }

        if (serverPlanHash && serverPlanHash === localHash) {
          if (serverUpdatedMs) {
            setMainServerSyncedAt(serverUpdatedMs);
          }
          setMainPlanHash(localHash);
          if (localPrev && (!serverHasPrev || serverPrevSame)) {
            await fetch("/api/main/plan", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ plan: serverPlan, prevPlan: localPrev }),
              credentials: "include",
            });
          } else if (!localPrev && data.prevPlan && typeof data.prevPlan === "object") {
            savePreviousPlan(data.prevPlan as typeof localPlan);
          }
          setLastSyncAt(setMainSyncAt());
          return;
        }

        if (serverChanged && localDirty) {
          setConflict({
            serverPlan,
            prevPlan: (data.prevPlan as Plan) ?? null,
            serverUpdatedAt: serverUpdatedMs || null,
          });
          setSyncStatus("error");
          return;
        }

        if (serverChanged) {
          savePlanFromRemote(serverPlan, (data.prevPlan as Plan) ?? null, data.updatedAt);
          if (localPrev && (!serverHasPrev || serverPrevSame)) {
            await fetch("/api/main/plan", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ plan: serverPlan, prevPlan: localPrev }),
              credentials: "include",
            });
          }
          if (serverUpdatedMs) {
            setMainServerSyncedAt(serverUpdatedMs);
          }
          setMainPlanHash(hashPlan(loadPlan()));
          setLastSyncAt(setMainSyncAt());
          return;
        }

        if (localDirty) {
          const pushRes = await fetch("/api/main/plan", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: localPlan, prevPlan: localPrev }),
            credentials: "include",
          });
          const pushData = (await pushRes.json().catch(() => null)) as { updatedAt?: number } | null;
          const syncedAt =
            typeof pushData?.updatedAt === "number"
              ? pushData.updatedAt
              : serverUpdatedMs || null;
          if (syncedAt) {
            setMainServerSyncedAt(syncedAt);
            setMainServerUpdatedAt(syncedAt);
            setLastServerUpdatedAt(syncedAt);
          }
          setMainPlanHash(localHash);
          setLastSyncAt(setMainSyncAt());
          return;
        }

        if (localPrev && (!serverHasPrev || serverPrevSame)) {
          await fetch("/api/main/plan", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: serverPlan, prevPlan: localPrev }),
            credentials: "include",
          });
        } else if (!localPrev && data.prevPlan && typeof data.prevPlan === "object") {
          savePreviousPlan(data.prevPlan as typeof localPlan);
        }
        setLastSyncAt(setMainSyncAt());
      } catch {
        // Best-effort pull on focus.
      } finally {
        syncInFlight.current = false;
      }
    };

    window.addEventListener("focus", syncWithServer);
    const intervalId = window.setInterval(syncWithServer, 30000);
    return () => {
      window.removeEventListener("focus", syncWithServer);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    setLastSyncAt(getMainSyncAt());
    setLastLocalUpdatedAt(getActiveScenarioUpdatedAt());
    setLastServerUpdatedAt(getMainServerUpdatedAt());
    const refreshSync = () => {
      setLastSyncAt(getMainSyncAt());
      setLastLocalUpdatedAt(getActiveScenarioUpdatedAt());
      setLastServerUpdatedAt(getMainServerUpdatedAt());
    };
    window.addEventListener(MAIN_SYNC_EVENT, refreshSync);
    window.addEventListener(PLAN_UPDATED_EVENT, refreshSync);
    return () => {
      window.removeEventListener(MAIN_SYNC_EVENT, refreshSync);
      window.removeEventListener(PLAN_UPDATED_EVENT, refreshSync);
    };
  }, []);

  if (scope === "review") return null;

  const isMain = scope === "main";
  const label =
    status === "loading"
      ? "Preparing link..."
      : status === "copied"
        ? "Link copied"
        : status === "error"
          ? "Copy failed"
          : isMain
            ? "Copy main sync link"
            : "Enable sync + copy link";
  const syncLabel =
    syncStatus === "syncing"
      ? "Syncing..."
      : syncStatus === "error"
        ? "Sync failed"
        : "Sync now";

  const wrapperClass = isMobile
    ? "fixed right-2 top-1/2 z-50 -translate-y-1/2"
    : "fixed bottom-20 left-4 z-50 md:bottom-6";

  async function handleCopy() {
    setStatus("loading");
    try {
      const currentPlan = loadPlan();
      const res = await fetch("/api/main/link", { method: "POST", credentials: "include" });
      const data = (await res.json()) as {
        token?: string;
        publicUrl?: string | null;
        localUrl?: string | null;
      };
      if (!data?.token) throw new Error("Missing token");

      // Push current plan to the main store before sharing.
      const prevPlan = loadPreviousPlan();
      const syncRes = await fetch("/api/main/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: currentPlan, prevPlan }),
        credentials: "include",
      });
      const syncData = (await syncRes.json().catch(() => null)) as { updatedAt?: number } | null;
      if (!isMain) {
        setStorageScope("main");
        savePlan(currentPlan);
        setScope("main");
      }
      if (typeof syncData?.updatedAt === "number") {
        setMainServerSyncedAt(syncData.updatedAt);
        setMainServerUpdatedAt(syncData.updatedAt);
        setLastServerUpdatedAt(syncData.updatedAt);
      }
      setMainPlanHash(hashPlan(currentPlan));
      setLastSyncAt(setMainSyncAt());

      const baseUrl = data.publicUrl || data.localUrl || window.location.origin;
      const link = buildLink(data.token, baseUrl);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const input = document.createElement("input");
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  async function handleSyncNow() {
    if (getStorageScope() !== "main") return;
    if (conflict) return;
    setSyncStatus("syncing");
    try {
      const localPlan = loadPlan();
      const localPrev = loadPreviousPlan();
      const localUpdatedAt = getActiveScenarioUpdatedAt();
      setLastLocalUpdatedAt(localUpdatedAt);

      const res = await fetch("/api/main/plan", { method: "GET", credentials: "include" });
      const data = (await res.json()) as {
        plan?: unknown;
        prevPlan?: unknown;
        updatedAt?: number;
      };
      const serverUpdatedMs =
        typeof data?.updatedAt === "number" ? data.updatedAt : 0;
      setLastServerUpdatedAt(serverUpdatedMs || null);
      setMainServerUpdatedAt(serverUpdatedMs || null);
      const serverPlan = data?.plan as Plan | undefined;
      const serverPlanHash = serverPlan ? hashPlan(serverPlan) : "";
      const lastSyncedServerUpdatedAt = getMainServerSyncedAt();
      const lastSyncedHash = getMainPlanHash();
      const localHash = hashPlan(localPlan);
      const hasBaseline = Boolean(lastSyncedHash) || Boolean(lastSyncedServerUpdatedAt);
      const localDirty = hasBaseline ? localHash !== lastSyncedHash : true;
      const serverChanged =
        serverUpdatedMs > 0 &&
        (!lastSyncedServerUpdatedAt || serverUpdatedMs !== lastSyncedServerUpdatedAt);
      const serverHasPrev = Boolean(data?.prevPlan);
      const serverPrevSame =
        serverHasPrev && JSON.stringify(data.prevPlan) === JSON.stringify(data.plan);

      if (!serverPlan) {
        const pushRes = await fetch("/api/main/plan", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: localPlan, prevPlan: localPrev }),
          credentials: "include",
        });
        const pushData = (await pushRes.json().catch(() => null)) as { updatedAt?: number } | null;
        const syncedAt = typeof pushData?.updatedAt === "number" ? pushData.updatedAt : null;
        if (syncedAt) {
          setMainServerSyncedAt(syncedAt);
          setMainServerUpdatedAt(syncedAt);
          setLastServerUpdatedAt(syncedAt);
        }
        setMainPlanHash(localHash);
        setLastSyncAt(setMainSyncAt());
        setSyncStatus("idle");
        return;
      }

      if (serverPlanHash && serverPlanHash === localHash) {
        if (serverUpdatedMs) {
          setMainServerSyncedAt(serverUpdatedMs);
        }
        setMainPlanHash(localHash);
        if (localPrev && (!serverHasPrev || serverPrevSame)) {
          await fetch("/api/main/plan", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: serverPlan, prevPlan: localPrev }),
            credentials: "include",
          });
        } else if (!localPrev && data.prevPlan && typeof data.prevPlan === "object") {
          savePreviousPlan(data.prevPlan as typeof localPlan);
        }
        setLastSyncAt(setMainSyncAt());
        setSyncStatus("idle");
        return;
      }

      if (serverChanged && localDirty) {
        setConflict({
          serverPlan,
          prevPlan: (data.prevPlan as Plan) ?? null,
          serverUpdatedAt: serverUpdatedMs || null,
        });
        setSyncStatus("error");
        return;
      }

      if (serverChanged) {
        savePlanFromRemote(serverPlan, (data.prevPlan as Plan) ?? null, data.updatedAt);
        if (localPrev && (!serverHasPrev || serverPrevSame)) {
          await fetch("/api/main/plan", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: serverPlan, prevPlan: localPrev }),
            credentials: "include",
          });
        }
        if (serverUpdatedMs) {
          setMainServerSyncedAt(serverUpdatedMs);
        }
        setMainPlanHash(hashPlan(loadPlan()));
        setLastSyncAt(setMainSyncAt());
        setSyncStatus("idle");
        return;
      }

      if (localDirty) {
        const pushRes = await fetch("/api/main/plan", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: localPlan, prevPlan: localPrev }),
          credentials: "include",
        });
        const pushData = (await pushRes.json().catch(() => null)) as { updatedAt?: number } | null;
        const syncedAt =
          typeof pushData?.updatedAt === "number"
            ? pushData.updatedAt
            : serverUpdatedMs || null;
        if (syncedAt) {
          setMainServerSyncedAt(syncedAt);
          setMainServerUpdatedAt(syncedAt);
          setLastServerUpdatedAt(syncedAt);
        }
        setMainPlanHash(localHash);
        setLastSyncAt(setMainSyncAt());
        setSyncStatus("idle");
        return;
      }

      if (localPrev && (!serverHasPrev || serverPrevSame)) {
        await fetch("/api/main/plan", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: serverPlan, prevPlan: localPrev }),
          credentials: "include",
        });
      } else if (!localPrev && data.prevPlan && typeof data.prevPlan === "object") {
        savePreviousPlan(data.prevPlan as typeof localPlan);
      }
      setLastSyncAt(setMainSyncAt());
      setSyncStatus("idle");
    } catch {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 2000);
    }
  }

  async function handleResolveKeepLocal() {
    if (!conflict) return;
    setSyncStatus("syncing");
    try {
      const localPlan = loadPlan();
      const localPrev = loadPreviousPlan();
      const pushRes = await fetch("/api/main/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: localPlan, prevPlan: localPrev }),
        credentials: "include",
      });
      const pushData = (await pushRes.json().catch(() => null)) as { updatedAt?: number } | null;
      const syncedAt =
        typeof pushData?.updatedAt === "number"
          ? pushData.updatedAt
          : conflict.serverUpdatedAt ?? null;
      if (syncedAt) {
        setMainServerSyncedAt(syncedAt);
        setMainServerUpdatedAt(syncedAt);
        setLastServerUpdatedAt(syncedAt);
      }
      setMainPlanHash(hashPlan(localPlan));
      setConflict(null);
      setLastSyncAt(setMainSyncAt());
      setSyncStatus("idle");
    } catch {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 2000);
    }
  }

  function handleResolveUseServer() {
    if (!conflict) return;
    setSyncStatus("syncing");
    try {
      savePlanFromRemote(conflict.serverPlan, conflict.prevPlan ?? null, conflict.serverUpdatedAt ?? undefined);
      if (conflict.serverUpdatedAt) {
        setMainServerSyncedAt(conflict.serverUpdatedAt);
        setMainServerUpdatedAt(conflict.serverUpdatedAt);
        setLastServerUpdatedAt(conflict.serverUpdatedAt);
      }
      setMainPlanHash(hashPlan(loadPlan()));
      setConflict(null);
      setLastSyncAt(setMainSyncAt());
      setSyncStatus("idle");
    } catch {
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 2000);
    }
  }

  return (
    <div className={wrapperClass}>
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="rounded-l-full border border-white/10 bg-slate-900/90 px-3 py-2 text-[11px] font-semibold text-white shadow-xl backdrop-blur"
        >
          Sync
        </button>
      ) : (
        <div className="max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-xs text-white shadow-xl backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">
              {isMain ? "Main sync mode" : "Main sync"}
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-semibold text-white/80 hover:bg-white/10"
            >
              Hide
            </button>
          </div>
          <button
            onClick={handleCopy}
            className="mt-2 w-full rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow hover:bg-[var(--accent-deep)]"
          >
            {label}
          </button>
          {isMain ? (
            <button
              onClick={handleSyncNow}
              disabled={Boolean(conflict)}
              className={[
                "mt-2 w-full rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white/90",
                conflict ? "cursor-not-allowed opacity-60" : "hover:bg-white/10",
              ].join(" ")}
            >
              {syncLabel}
            </button>
          ) : null}
          {isMain ? (
            <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-200">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-semibold ${syncHint.tone}`}>{syncHint.label}</span>
                {syncHint.action ? (
                  <span className="text-slate-400">{syncHint.action}</span>
                ) : null}
              </div>
              {lastLocalLabel ? (
                <div className="mt-1 text-slate-400">Last change {lastLocalLabel}</div>
              ) : (
                <div className="mt-1 text-slate-500">No local changes yet.</div>
              )}
              {lastServerLabel ? (
                <div className="text-slate-500">Server change {lastServerLabel}</div>
              ) : null}
            </div>
          ) : null}
          {isMain && conflict ? (
            <div className="mt-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
              <div className="font-semibold">Conflict detected</div>
              <div className="mt-1 text-rose-200">
                Both this device and the server changed. Choose which version to keep.
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={handleResolveKeepLocal}
                  className="rounded-lg bg-rose-500/80 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-500"
                >
                  Keep local
                </button>
                <button
                  onClick={handleResolveUseServer}
                  className="rounded-lg border border-white/30 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/10"
                >
                  Use server
                </button>
              </div>
            </div>
          ) : null}
          <div className="mt-2 text-[11px] text-slate-400">
            {lastSyncLabel
              ? `Last synced ${lastSyncLabel}`
              : "Open on your phone to sync daily updates."}
          </div>
        </div>
      )}
    </div>
  );
}
