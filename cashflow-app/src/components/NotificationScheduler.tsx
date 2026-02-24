"use client";

/**
 * NotificationScheduler
 *
 * Invisible component mounted in the layout.
 * On initial mount and every time the user focuses the tab, it evaluates
 * the current alert state and fires local browser notifications for any
 * warning/critical alerts that haven't been shown recently.
 */

import { useEffect } from "react";
import { loadPlan, PLAN_UPDATED_EVENT } from "@/lib/storage";
import { getAlerts, loadAlertPreferences } from "@/lib/alerts";
import { detectAnomalies } from "@/lib/anomalyDetection";
import { formatMoney } from "@/lib/currency";
import { fireAlertNotification, isNotificationsEnabled } from "@/lib/pushNotifications";
import type { SavingsGoal } from "@/data/plan";

export default function NotificationScheduler() {
  useEffect(() => {
    function checkAndFire() {
      if (!isNotificationsEnabled()) return;

      const plan = loadPlan();
      const prefs = loadAlertPreferences();
      const alerts = getAlerts(plan, plan.setup.selectedPeriodId, prefs);

      for (const alert of alerts) {
        // Skip the "all-clear" placeholder — only fire real warnings
        if (alert.tone === "good") continue;

        fireAlertNotification(
          alert.id,
          alert.title,
          alert.description,
          alert.href
        );
      }

      // Fire notifications for spending anomalies (rolling-avg excess)
      const anomalies = detectAnomalies(plan);
      for (const anomaly of anomalies) {
        const pct = Math.round((anomaly.ratio - 1) * 100);
        fireAlertNotification(
          `anomaly-${anomaly.category}`,
          `Unusual ${anomaly.category} spend`,
          `You've spent ${formatMoney(anomaly.currentAmount)} on ${anomaly.category} this period — ${pct}% above your usual ${formatMoney(Math.round(anomaly.avgAmount))}.`,
          "/insights"
        );
      }

      // Fire milestone notifications for savings goals (25 / 50 / 75 / 100 %)
      const MILESTONE_COOLDOWN = 30 * 24 * 60 * 60 * 1000; // 30 days
      const MILESTONES = [25, 50, 75, 100] as const;
      for (const goal of (plan.savingsGoals ?? []) as SavingsGoal[]) {
        if (!goal.targetAmount || goal.targetAmount <= 0) continue;

        // Include any linked transaction amounts
        const linked = ((plan.transactions ?? []) as Array<{ goalId?: string; amount: number }>)
          .filter((t) => t.goalId === goal.id)
          .reduce((sum, t) => sum + t.amount, 0);

        const progressPct = ((goal.currentAmount + linked) / goal.targetAmount) * 100;

        for (const milestone of MILESTONES) {
          if (progressPct >= milestone) {
            const isComplete = milestone === 100;
            fireAlertNotification(
              `goal-milestone-${goal.id}-${milestone}`,
              isComplete
                ? `🎉 ${goal.name} goal complete!`
                : `${goal.name} is ${milestone}% funded`,
              `You've saved ${formatMoney(Math.round(goal.currentAmount + linked))} of your ${formatMoney(goal.targetAmount)} ${goal.name} target.`,
              "/goals",
              MILESTONE_COOLDOWN
            );
          }
        }
      }
    }

    // Run once on mount
    checkAndFire();

    // Re-check when the tab regains focus (user returns to app)
    window.addEventListener("focus", checkAndFire);
    // Re-check after plan data changes
    window.addEventListener(PLAN_UPDATED_EVENT, checkAndFire);

    return () => {
      window.removeEventListener("focus", checkAndFire);
      window.removeEventListener(PLAN_UPDATED_EVENT, checkAndFire);
    };
  }, []);

  return null;
}
