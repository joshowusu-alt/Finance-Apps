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
