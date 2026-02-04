"use client";

import { useEffect, useState } from "react";
import HomePage from "@/app/page";
import { Plan } from "@/data/plan";
import { createFreshPlan, hasStoredPlan, savePlan, setStorageScope } from "@/lib/storage";

export default function ReviewPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStorageScope("review");
    let isMounted = true;

    const bootstrap = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token") || undefined;
      const localHas = hasStoredPlan();
      try {
        const res = await fetch("/api/review/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as { plan?: Plan };
        if (data?.plan) {
          savePlan(data.plan);
        } else if (!localHas) {
          savePlan(createFreshPlan());
        }
      } catch {
        if (!localHas) {
          savePlan(createFreshPlan());
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
