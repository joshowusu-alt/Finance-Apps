"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Plan } from "@/data/plan";
import { setStorageScope } from "@/lib/storage";

type SyncStatus = "loading" | "success" | "error";

function MainPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [message, setMessage] = useState("Connecting to your data...");

  useEffect(() => {
    async function syncFromServer() {
      const token = searchParams.get("token");

      if (!token) {
        setStatus("error");
        setMessage("No sync token provided. Please use the link from your phone.");
        return;
      }

      try {
        setMessage("Clearing old data...");

        // FORCEFULLY clear ALL localStorage first
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("cashflow") || key.includes("plan") || key.includes("scenario"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // Set scope to main (and notify listeners)
        setStorageScope("main");

        setMessage("Connecting to cloud...");

        // Bootstrap with the token from URL
        const bootstrapRes = await fetch("/api/main/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          credentials: "include",
        });

        if (!bootstrapRes.ok) {
          throw new Error("Failed to connect to your data");
        }

        const data = await bootstrapRes.json() as {
          plan?: Plan;
          prevPlan?: Plan | null;
          updatedAt?: number;
        };

        if (!data.plan) {
          throw new Error("No data found for this token");
        }

        setMessage("Loading Period 2 data...");

        // Save directly to localStorage with main scope
        const scenarios = {
          activeId: "default",
          scenarios: [{ id: "default", name: "Main plan", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]
        };
        localStorage.setItem("cashflow_scenarios_v1::main", JSON.stringify(scenarios));
        localStorage.setItem("cashflow_plan_v2::main", JSON.stringify(data.plan));
        if (data.prevPlan) {
          localStorage.setItem("cashflow_prev_plan_v1::main", JSON.stringify(data.prevPlan));
        }

        // Set sync timestamps
        if (data.updatedAt) {
          localStorage.setItem("cashflow_main_server_updated_at_v1::main", String(data.updatedAt));
          localStorage.setItem("cashflow_main_server_synced_at_v1::main", String(data.updatedAt));
        }
        localStorage.setItem("cashflow_main_sync_at_v1::main", new Date().toISOString());
        localStorage.setItem("cashflow_main_plan_hash_v1::main", JSON.stringify(data.plan));

        // Show period info
        const periodId = data.plan.setup?.selectedPeriodId;
        setStatus("success");
        setMessage(`Loaded Period ${periodId} data! Redirecting...`);

        // Redirect to insights
        setTimeout(() => {
          router.push("/insights");
        }, 1500);

      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Failed to sync data");
      }
    }

    syncFromServer();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--vn-bg)" }}>
      <div className="max-w-md w-full rounded-3xl p-8 shadow-2xl text-center" style={{ background: "var(--vn-surface)", border: "1px solid var(--vn-border)" }}>
        {status === "loading" && (
          <>
            <div className="w-12 h-12 rounded-full border-2 mx-auto mb-5" style={{ borderColor: "var(--vn-border)", borderTopColor: "var(--vn-primary)" }} />
            <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--vn-text)" }}>Syncing Your Data</h1>
            <p style={{ color: "var(--vn-muted)" }}>{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-xl font-bold mb-2" style={{ color: "var(--vn-text)" }}>Connected!</h1>
            <p style={{ color: "var(--vn-gold)" }}>{message}</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-xl font-bold mb-2" style={{ color: "var(--vn-text)" }}>Sync Failed</h1>
            <p className="mb-4" style={{ color: "var(--vn-error, #ef4444)" }}>{message}</p>
            <button
              onClick={() => router.push("/insights")}
              className="px-6 py-3 font-semibold rounded-xl transition-colors"
              style={{ background: "var(--vn-surface-elevated, var(--vn-border))", color: "var(--vn-text)" }}
            >
              Go to Dashboard Anyway
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--vn-bg)" }}>
      <div className="max-w-md w-full rounded-3xl p-8 text-center" style={{ background: "var(--vn-surface)", border: "1px solid var(--vn-border)" }}>
        <div className="w-12 h-12 rounded-full border-2 mx-auto mb-5" style={{ borderColor: "var(--vn-border)", borderTopColor: "var(--vn-primary)" }} />
        <h1 className="text-lg font-semibold" style={{ color: "var(--vn-text)" }}>Loading...</h1>
      </div>
    </div>
  );
}

export default function MainPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MainPageContent />
    </Suspense>
  );
}
