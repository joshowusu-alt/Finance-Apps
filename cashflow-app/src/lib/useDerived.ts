import { useEffect, useMemo, useState } from "react";
import { loadPlan, savePlan, advancePlanToCurrentPeriod, PLAN_UPDATED_EVENT } from "@/lib/storage";
import { deriveApp, type Derived } from "@/lib/derive";
import { computeConfidenceScore, type ConfidenceResult } from "@/lib/confidence";
import type { Plan } from "@/data/plan";

export function useDerived(periodId?: number): { state: Plan; derived: Derived; confidence: ConfidenceResult } {
  const [state, setState] = useState<Plan>(() => {
    const plan = loadPlan();
    const advanced = advancePlanToCurrentPeriod(plan);
    // Persist only if the period/date actually changed — skipAudit to avoid noise
    if (advanced !== plan) {
      savePlan(advanced, { skipAudit: true });
    }
    return advanced;
  });

  useEffect(() => {
    const refresh = () => setState(loadPlan());
    window.addEventListener("focus", refresh);
    window.addEventListener(PLAN_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(PLAN_UPDATED_EVENT, refresh);
    };
  }, []);

  const derived = useMemo(() => deriveApp(state, periodId), [state, periodId]);
  const confidence = useMemo(() => computeConfidenceScore(derived, state), [derived, state]);

  return { state, derived, confidence };
}
