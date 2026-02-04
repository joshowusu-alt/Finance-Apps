"use client";

import { useEffect, useState } from "react";
import HomePage from "@/app/page";
import { Plan } from "@/data/plan";
import {
  createFreshPlan,
  hasStoredPlan,
  loadPlan,
  loadPreviousPlan,
  savePlan,
  savePlanFromRemote,
  setMainPlanHash,
  setMainServerUpdatedAt,
  setMainServerSyncedAt,
  setStorageScope,
} from "@/lib/storage";

function hashPlan(plan: Plan) {
  return JSON.stringify(plan);
}

export default function MainSyncPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStorageScope("main");
    let isMounted = true;

    const bootstrap = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token") || undefined;
      const localHas = hasStoredPlan();
      const localPlan = localHas ? loadPlan() : null;
      const localPrev = localHas ? loadPreviousPlan() : null;

      try {
        const res = await fetch("/api/main/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as {
          plan?: Plan;
          prevPlan?: Plan;
          updatedAt?: number;
        };
        const serverPlan = data?.plan as Plan | undefined;

        if (!serverPlan) {
          if (localHas && localPlan) {
            const syncRes = await fetch("/api/main/plan", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ plan: localPlan, prevPlan: localPrev }),
            });
            const syncData = (await syncRes.json().catch(() => null)) as { updatedAt?: number } | null;
            if (typeof syncData?.updatedAt === "number") {
              setMainServerSyncedAt(syncData.updatedAt);
              setMainServerUpdatedAt(syncData.updatedAt);
            }
            setMainPlanHash(hashPlan(localPlan));
          } else if (!localHas) {
            savePlan(createFreshPlan());
            setMainPlanHash(hashPlan(loadPlan()));
          }
        } else if (!localHas) {
          savePlanFromRemote(serverPlan, data.prevPlan ?? null, data.updatedAt);
          if (typeof data.updatedAt === "number") {
            setMainServerSyncedAt(data.updatedAt);
            setMainServerUpdatedAt(data.updatedAt);
          }
          setMainPlanHash(hashPlan(loadPlan()));
        } else if (localPlan) {
          const localHash = hashPlan(localPlan);
          const serverHash = hashPlan(serverPlan);
          if (localHash === serverHash) {
            if (typeof data.updatedAt === "number") {
              setMainServerSyncedAt(data.updatedAt);
              setMainServerUpdatedAt(data.updatedAt);
            }
            setMainPlanHash(localHash);
          } else if (typeof data.updatedAt === "number") {
            setMainServerUpdatedAt(data.updatedAt);
          }
        }
      } catch {
        if (!localHas) {
          savePlan(createFreshPlan());
          setMainPlanHash(hashPlan(loadPlan()));
        }
      }

      if (token) {
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.toString());
      }

      if (isMounted) {
        setReady(true);
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!ready) {
    return null;
  }

  return <HomePage />;
}
