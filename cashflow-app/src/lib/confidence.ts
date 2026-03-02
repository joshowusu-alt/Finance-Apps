/**
 * Financial Confidence Engine v2
 *
 * Computes a composite Financial Confidence Score (0–100) with a 4-tier
 * status label from existing Derived data + plan setup.
 *
 * Score composition (weighted points):
 *   Liquidity Safety     40 pts  — lowest balance, risk days, remaining
 *   Behaviour Stability  30 pts  — spending pace, income consistency
 *   Progress Momentum    30 pts  — savings streak, period delta, risk delta
 *
 * Status tiers:
 *   Secure      ≥ 90
 *   Stable      ≥ 75
 *   Watch zone  ≥ 60
 *   Tight zone  < 60
 *
 * Override gates:
 *   lowestBal < 0   → force "Tight zone"
 *   riskDays > 3    → cap score at 74 (forces Watch zone or below)
 */

import { deriveApp } from "@/lib/derive";
import type { Derived } from "@/lib/derive";
import type { Plan } from "@/data/plan";
import { TIER_EXPLANATIONS } from "@/lib/copy";

// ── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceStatus = "Secure" | "Stable" | "Watch zone" | "Tight zone";

export interface ConfidenceResult {
  /** Composite score 0–100 */
  score: number;
  /** Liquidity weighted points 0–40 */
  liquidity: number;
  /** Behaviour stability weighted points 0–30 */
  behaviour: number;
  /** Progress momentum weighted points 0–30 */
  momentum: number;
  /** 4-tier status label */
  status: ConfidenceStatus;
  /** 1–2 sentence calm explanation shown in the status bar */
  explanation: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function sumPeriodOutflows(plan: Plan, start: string, end: string): number {
  return plan.transactions
    .filter(
      (t) =>
        t.date >= start &&
        t.date <= end &&
        t.type === "outflow" &&
        t.category !== "savings"
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

function sumPeriodIncome(plan: Plan, start: string, end: string): number {
  return plan.transactions
    .filter((t) => t.date >= start && t.date <= end && t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeConfidenceScore(derived: Derived, plan: Plan): ConfidenceResult {
  // ── Raw inputs ──────────────────────────────────────────────────────────
  const lowestBal = derived.cashflow.lowest.balance;
  const riskDays = derived.cashflow.daysBelowMin;
  const income = derived.totals.incomeExpected;
  const remaining = derived.totals.remaining;
  const streak = derived.savingsHealth.streak;

  const periodStart = derived.period.start;
  const periodEnd = derived.period.end;
  const periodId = derived.period.id;

  // ── 1. Liquidity sub-score (0–40 pts) ───────────────────────────────────
  const expectedMin = Math.max(plan.setup.expectedMinBalance ?? 0, income * 0.05, 200);

  // lowestPts (0–50 raw)
  let lowestPts: number;
  if (lowestBal >= expectedMin) {
    lowestPts = 50;
  } else if (lowestBal >= 0) {
    lowestPts = expectedMin > 0 ? (lowestBal / expectedMin) * 50 : 50;
  } else {
    lowestPts = 0;
  }

  // riskPts (0–30 raw)
  const riskPts =
    riskDays === 0 ? 30
    : riskDays === 1 ? 22
    : riskDays === 2 ? 14
    : riskDays === 3 ? 6
    : 0;

  // remainingPts (0–20 raw)
  let remainingPts: number;
  if (income > 0) {
    remainingPts = remaining / income > 0.10 ? 20 : remaining >= 0 ? 10 : 0;
  } else {
    remainingPts = remaining > 0 ? 15 : 0;
  }

  const liquidityRaw = (lowestPts + riskPts + remainingPts) / 100;
  const liquidity = Math.round(clamp(liquidityRaw * 40, 0, 40));

  // ── 2. Behaviour sub-score (0–30 pts) ───────────────────────────────────
  const budgetOutflows = derived.totals.committedBills + derived.totals.allocationsTotal;
  const budgetSavings = derived.savingsHealth.savingsThisPeriod;
  const budgetSpending = budgetOutflows - budgetSavings;

  // Pace scoring — SSOT from derived.spendingPace, no local time-based computation
  const actualSpending = sumPeriodOutflows(plan, periodStart, periodEnd);
  const { paceStatus: spendingPaceStatus, varianceToExpected: spendingVariance, totalPlannedOutflows: spendingBudget } = derived.spendingPace;
  const normalizedVariance = spendingBudget > 0 ? spendingVariance / spendingBudget : 0;

  let pacePts: number;
  if (spendingPaceStatus === "pacing-well")                           pacePts = 60;
  else if (normalizedVariance > 0 && normalizedVariance <= 0.10)     pacePts = 48;
  else if (normalizedVariance > 0.10 && normalizedVariance <= 0.20)  pacePts = 36;
  else if (normalizedVariance > 0.20)                                 pacePts = 20;
  else                                                                 pacePts = 54;

  // Income stability (last 3 periods)
  const sortedPeriodsDesc = [...plan.periods].sort((a, b) => b.id - a.id);
  const last3 = sortedPeriodsDesc.slice(0, 3);
  let stabilityPts: number;
  if (last3.length >= 2) {
    const incomeArr = last3.map((p) => sumPeriodIncome(plan, p.start, p.end));
    const mean = incomeArr.reduce((s, v) => s + v, 0) / incomeArr.length;
    const variance = incomeArr.reduce((s, v) => s + (v - mean) ** 2, 0) / incomeArr.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 1;
    stabilityPts = cv < 0.05 ? 40 : cv < 0.15 ? 32 : cv < 0.30 ? 22 : 12;
  } else {
    stabilityPts = derived.incomeStability.label === "Consistent" ? 36 : 20;
  }

  const behaviourRaw = (pacePts + stabilityPts) / 100;
  const behaviour = Math.round(clamp(behaviourRaw * 30, 0, 30));

  // ── 3. Momentum sub-score (0–30 pts) ────────────────────────────────────
  const streakPts = streak === 0 ? 10 : streak === 1 ? 24 : streak === 2 ? 32 : 40;

  const sortedPeriodsAsc = [...plan.periods].sort((a, b) => a.id - b.id);
  const currentIdx = sortedPeriodsAsc.findIndex((p) => p.id === periodId);
  const prevPeriod = currentIdx > 0 ? sortedPeriodsAsc[currentIdx - 1] : null;

  let deltaPts: number;
  let riskReductionPts: number;

  if (prevPeriod) {
    const prevDerived = deriveApp(plan, prevPeriod.id);
    const prevActual = sumPeriodOutflows(plan, prevPeriod.start, prevPeriod.end);
    const prevBudgetOutflows =
      prevDerived.totals.committedBills + prevDerived.totals.allocationsTotal;
    const prevBudgetSavings = prevDerived.savingsHealth.savingsThisPeriod;
    const prevBudgetSpending = prevBudgetOutflows - prevBudgetSavings;

    const prevRatio = prevBudgetSpending > 0 ? prevActual / prevBudgetSpending : 1;
    const currRatio = budgetSpending > 0 ? actualSpending / budgetSpending : 1;
    const delta = prevRatio - currRatio; // positive = improved (spending less vs budget)
    deltaPts = delta > 0.05 ? 30 : delta >= -0.05 ? 20 : 10;

    const prevRiskDays = prevDerived.cashflow.daysBelowMin;
    const riskDelta = riskDays - prevRiskDays; // negative = fewer risk days (good)
    riskReductionPts = riskDelta < 0 ? 30 : riskDelta === 0 ? 20 : 10;
  } else {
    deltaPts = 20;
    riskReductionPts = 20;
  }

  const momentumRaw = (streakPts + deltaPts + riskReductionPts) / 100;
  const momentum = Math.round(clamp(momentumRaw * 30, 0, 30));

  // ── Composite + override gates ────────────────────────────────────────────
  let rawScore = liquidity + behaviour + momentum;
  if (riskDays > 3) rawScore = Math.min(rawScore, 74); // force Watch or below
  const score = Math.round(clamp(rawScore, 0, 100));

  let status: ConfidenceStatus;
  if (lowestBal < 0) {
    status = "Tight zone";
  } else if (score >= 90) {
    status = "Secure";
  } else if (score >= 75) {
    status = "Stable";
  } else if (score >= 60) {
    status = "Watch zone";
  } else {
    status = "Tight zone";
  }

  // ── Explanation ───────────────────────────────────────────────────────────
  let explanation: string;

  if (status === "Tight zone" && lowestBal < 0) {
    explanation = TIER_EXPLANATIONS["Tight zone"].negativeForecast;
  } else if (status === "Tight zone" && riskDays > 3) {
    explanation = TIER_EXPLANATIONS["Tight zone"].multipleRiskDays;
  } else if (status === "Tight zone") {
    explanation = TIER_EXPLANATIONS["Tight zone"].spendingAhead;
  } else if (status === "Watch zone" && riskDays > 0) {
    explanation = TIER_EXPLANATIONS["Watch zone"].riskDays;
  } else if (status === "Watch zone" && normalizedVariance > 0.10) {
    explanation = TIER_EXPLANATIONS["Watch zone"].moderatelyAhead;
  } else if (status === "Watch zone") {
    explanation = TIER_EXPLANATIONS["Watch zone"].default;
  } else if (status === "Stable" && streak >= 2) {
    explanation = TIER_EXPLANATIONS["Stable"].streak;
  } else if (status === "Stable") {
    explanation = TIER_EXPLANATIONS["Stable"].default;
  } else if (deltaPts === 30) {
    explanation = TIER_EXPLANATIONS["Secure"].improving;
  } else {
    explanation = TIER_EXPLANATIONS["Secure"].default;
  }

  return { score, liquidity, behaviour, momentum, status, explanation };
}
