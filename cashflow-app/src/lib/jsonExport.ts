/**
 * JSON export — serialize a Plan to JSON and trigger a browser download.
 */

import type { Plan } from "@/data/plan";
import { getReportBranding } from "@/lib/branding";
import { downloadBlob } from "@/lib/planIoUtils";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function downloadPlanJson(plan: Plan) {
  const json = JSON.stringify(plan, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const stamp = new Date().toISOString().slice(0, 10);
  const { filenamePrefix } = getReportBranding();
  downloadBlob(blob, `${filenamePrefix}-plan-${stamp}.json`);
}
