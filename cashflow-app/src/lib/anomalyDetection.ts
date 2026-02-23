/**
 * Anomaly & Pattern Alerts
 *
 * Computes a rolling 3-period average per spending category and flags when
 * the current period is ≥ 1.5× that average. Returns zero or more alert
 * objects ready to render in the dashboard.
 */

import type { Plan, CashflowCategory, Transaction } from "@/data/plan";

export type SpendAnomaly = {
  category: CashflowCategory;
  currentAmount: number;
  avgAmount: number;
  /** e.g. 2.3 means current is 2.3× the rolling average */
  ratio: number;
  /** The number of prior periods used to compute the average */
  periodsUsed: number;
};

const ANOMALY_THRESHOLD = 1.5; // flag when current ≥ 1.5× rolling avg
const ROLLING_WINDOW = 3;      // look back this many prior periods
const MIN_AVG_AMOUNT = 5;      // ignore trivially small baselines (£5)

/** Categories excluded from anomaly detection (income is never "over-spend") */
const EXCLUDED: CashflowCategory[] = ["income", "buffer"];

function sumByCategory(transactions: Transaction[]): Partial<Record<CashflowCategory, number>> {
  const out: Partial<Record<CashflowCategory, number>> = {};
  for (const t of transactions) {
    if (t.type !== "outflow" && t.type !== "transfer") continue;
    const key = t.category;
    out[key] = (out[key] ?? 0) + t.amount;
  }
  return out;
}

/**
 * Compute anomalies for the currently selected period.
 *
 * @returns array of SpendAnomaly, sorted by ratio descending
 */
export function detectAnomalies(plan: Plan): SpendAnomaly[] {
  const currentPeriodId = plan.setup.selectedPeriodId;
  const periods = [...plan.periods].sort((a, b) => a.id - b.id);
  const currentPeriod = periods.find(p => p.id === currentPeriodId);

  if (!currentPeriod) return [];

  // Transactions for the current period
  const currentTxns = plan.transactions.filter(
    t => t.date >= currentPeriod.start && t.date <= currentPeriod.end
  );
  const currentByCat = sumByCategory(currentTxns);

  // Prior periods (up to ROLLING_WINDOW, strictly before current)
  const priorPeriods = periods
    .filter(p => p.id < currentPeriodId)
    .slice(-ROLLING_WINDOW);

  if (priorPeriods.length === 0) return [];

  // Compute per-category totals for each prior period
  const priorTotals: Partial<Record<CashflowCategory, number[]>> = {};

  for (const period of priorPeriods) {
    const txns = plan.transactions.filter(
      t => t.date >= period.start && t.date <= period.end
    );
    const byCat = sumByCategory(txns);
    for (const [cat, amount] of Object.entries(byCat) as [CashflowCategory, number][]) {
      if (!priorTotals[cat]) priorTotals[cat] = [];
      priorTotals[cat]!.push(amount);
    }
  }

  const anomalies: SpendAnomaly[] = [];

  for (const [cat, currentAmount] of Object.entries(currentByCat) as [CashflowCategory, number][]) {
    if (EXCLUDED.includes(cat)) continue;
    if (!currentAmount || currentAmount <= 0) continue;

    const priorAmounts = priorTotals[cat] ?? [];
    if (priorAmounts.length === 0) continue;

    const avg = priorAmounts.reduce((s, v) => s + v, 0) / priorAmounts.length;
    if (avg < MIN_AVG_AMOUNT) continue;

    const ratio = currentAmount / avg;
    if (ratio < ANOMALY_THRESHOLD) continue;

    anomalies.push({
      category: cat,
      currentAmount,
      avgAmount: avg,
      ratio,
      periodsUsed: priorAmounts.length,
    });
  }

  return anomalies.sort((a, b) => b.ratio - a.ratio);
}
