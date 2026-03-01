/**
 * Financial Confidence Engine
 *
 * Computes a composite Financial Confidence Score (0–100) and a 4-tier
 * status label from existing Derived data + plan setup.
 *
 * Score composition:
 *   Liquidity Safety   50%  — lowest balance, risk days
 *   Behaviour Stability 30%  — health label proxy, income consistency
 *   Progress Momentum  20%  — savings streak
 *
 * Status tiers (with override gates):
 *   Secure   75–100  (no risk days, no negative balance)
 *   Stable   50–74   (no risk days)
 *   Watch    30–49   (or: risk days > 0 and score ≥ 50)
 *   At Risk  0–29    (or: any negative balance, or risk days > 0 and score < 50)
 */

import type { Plan } from "@/data/plan";
import type { Derived } from "@/lib/derive";

// ── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceStatus = "Secure" | "Stable" | "Watch" | "At Risk";

export interface ConfidenceResult {
  /** Composite score 0–100 */
  score: number;
  /** Liquidity sub-score 0–100 */
  liquidity: number;
  /** Behaviour stability sub-score 0–100 */
  behaviour: number;
  /** Progress momentum sub-score 0–100 */
  momentum: number;
  /** 4-tier status label */
  status: ConfidenceStatus;
  /** 1–2 sentence explanation shown in the status bar */
  reason: string;
  /** Very short label (≤ 40 chars) for compact badges */
  shortReason: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function buildReason(
  status: ConfidenceStatus,
  riskDays: number,
  lowestBal: number,
  streak: number,
  expectedMin: number
): { reason: string; shortReason: string } {
  if (status === "Secure") {
    if (streak >= 2) {
      return {
        reason: `You are clear through to end of period with ${streak} periods of savings met in a row.`,
        shortReason: "Clear through period end.",
      };
    }
    return {
      reason: "Your balance stays well above your safety net through to period end.",
      shortReason: "On track through period end.",
    };
  }

  if (status === "Stable") {
    if (riskDays > 0) {
      return {
        reason: `${riskDays} day${riskDays === 1 ? "" : "s"} dip below your £${expectedMin} safety net — consider a small adjustment.`,
        shortReason: `${riskDays} risk day${riskDays === 1 ? "" : "s"} — minor adjustment needed.`,
      };
    }
    return {
      reason: "Looking steady. Keep an eye on your spending pace as the period progresses.",
      shortReason: "Steady — monitor spending pace.",
    };
  }

  if (status === "Watch") {
    if (riskDays > 0) {
      return {
        reason: `${riskDays} day${riskDays === 1 ? "" : "s"} forecast below your safety net. One adjustment recommended.`,
        shortReason: `${riskDays} risk day${riskDays === 1 ? "" : "s"} — action recommended.`,
      };
    }
    return {
      reason: "Balance dips close to your safety net this period. Review your allocations.",
      shortReason: "Dipping close to safety net.",
    };
  }

  // At Risk
  if (lowestBal < 0) {
    return {
      reason: "Your balance is forecast to go negative. Reduce spending or add income to recover.",
      shortReason: "Balance goes negative — act now.",
    };
  }
  return {
    reason: `Balance drops below zero or your safety net on ${riskDays} day${riskDays === 1 ? "" : "s"}. Immediate review recommended.`,
    shortReason: "Safety net breached — review plan.",
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeConfidenceScore(derived: Derived, plan: Plan): ConfidenceResult {
  const expectedMin = plan.setup.expectedMinBalance ?? 0;
  const lowestBal = derived.cashflow.lowest.balance;
  const riskDays = derived.cashflow.daysBelowMin;
  const streak = derived.savingsHealth.streak;

  // ── 1. Liquidity Score (0–100) ──────────────────────────────────────────
  // Ratio of lowest projected balance to safety net (or 0 baseline)
  const lowestRatio =
    expectedMin > 0
      ? lowestBal / expectedMin
      : lowestBal > 0
        ? 1
        : 0;
  const riskPenalty = clamp(riskDays * 8, 0, 64);
  const liquidity = clamp(Math.round(lowestRatio * 100 - riskPenalty), 0, 100);

  // ── 2. Behaviour Score (0–100) ──────────────────────────────────────────
  // Proxy via health label (derived from lowest balance vs expectedMin)
  const behaviourBase =
    derived.health.label === "Healthy" ? 82
      : derived.health.label === "Watch" ? 52
        : 20;
  // Income consistency adjustment
  const stabilityAdj = derived.incomeStability.label === "Consistent" ? 8 : -5;
  const behaviour = clamp(behaviourBase + stabilityAdj, 0, 100);

  // ── 3. Momentum Score (0–100) ───────────────────────────────────────────
  // Savings streak contributes up to 60 pts (20 per period, cap 3)
  const streakPts = clamp(streak * 20, 0, 60);
  // Base of 40 (neutral) — streak adds on top
  const momentum = clamp(40 + streakPts, 0, 100);

  // ── Composite ──────────────────────────────────────────────────────────
  const raw = liquidity * 0.5 + behaviour * 0.3 + momentum * 0.2;
  const score = Math.round(clamp(raw, 0, 100));

  // ── Status tier with override gates ────────────────────────────────────
  let status: ConfidenceStatus;

  if (lowestBal < 0) {
    // Any forecast negative balance → always At Risk
    status = "At Risk";
  } else if (riskDays > 0) {
    // Risk days present → never Secure or Stable
    status = score >= 50 ? "Watch" : "At Risk";
  } else if (score >= 75) {
    status = "Secure";
  } else if (score >= 50) {
    status = "Stable";
  } else if (score >= 30) {
    status = "Watch";
  } else {
    status = "At Risk";
  }

  const { reason, shortReason } = buildReason(status, riskDays, lowestBal, streak, expectedMin);

  return { score, liquidity, behaviour, momentum, status, reason, shortReason };
}
