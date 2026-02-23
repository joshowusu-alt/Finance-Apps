"use client";

/**
 * GoalRings
 *
 * Compact circular-progress rings for up to 4 active savings goals.
 * Renders on the Dashboard when the plan has at least one active goal.
 *
 * Props:
 *   goals — entries from plan.savingsGoals filtered to active/undefined status
 *   transactions — used to tally goal-linked transfers on top of currentAmount
 */

import Link from "next/link";
import type { SavingsGoal, Transaction } from "@/data/plan";
import { formatMoney } from "@/lib/currency";

type Props = {
  goals: SavingsGoal[];
  transactions: Transaction[];
};

const R = 30;           // SVG circle radius
const CX = 38;          // SVG viewBox centre
const CIRCUMFERENCE = 2 * Math.PI * R;

function Ring({ goal, transactions }: { goal: SavingsGoal; transactions: Transaction[] }) {
  const linked = transactions
    .filter((t) => t.goalId === goal.id)
    .reduce((s, t) => s + t.amount, 0);

  const saved = goal.currentAmount + linked;
  const target = goal.targetAmount > 0 ? goal.targetAmount : 1;
  const pct = Math.min(1, saved / target);
  const dashOffset = CIRCUMFERENCE * (1 - pct);
  const isComplete = pct >= 1;

  const color = goal.color ?? "#C5A046";

  // Format target date without calling Date.now()
  const deadlineLabel = goal.targetDate
    ? new Date(goal.targetDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })
    : null;

  return (
    <div className="flex flex-col items-center gap-2 min-w-0">
      {/* Ring SVG */}
      <div className="relative" aria-label={`${goal.icon ?? ""}${goal.name}: ${Math.round(pct * 100)}% complete`}>
        <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
          {/* Track */}
          <circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke="var(--vn-border)"
            strokeWidth="6"
          />
          {/* Progress arc — starts at 12 o'clock */}
          <circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={isComplete ? "#4FAF7B" : color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 38 38)"
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)" }}
          />
          {/* Centre icon / tick */}
          <text
            x="38"
            y="43"
            textAnchor="middle"
            fontSize="20"
            aria-hidden="true"
          >
            {isComplete ? "✓" : (goal.icon ?? "🎯")}
          </text>
        </svg>

        {/* Completion glow */}
        {isComplete && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: "0 0 16px rgba(79,175,123,0.35)" }}
          />
        )}
      </div>

      {/* Name */}
      <span
        className="text-[11px] font-semibold text-(--vn-text) text-center max-w-19 truncate"
        title={goal.name}
      >
        {goal.name}
      </span>

      {/* Progress label */}
      <span className="text-[10px] text-(--vn-muted) leading-none">
        {formatMoney(saved)} / {formatMoney(target)}
      </span>

      {/* Target date */}
      {deadlineLabel && (
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-(--vn-bg) text-(--vn-muted)">
          by {deadlineLabel}
        </span>
      )}
    </div>
  );
}

export default function GoalRings({ goals, transactions }: Props) {
  // Show up to 4 — active ones first, then by progress desc
  const sorted = [...goals]
    .filter((g) => g.status !== "paused")
    .sort((a, b) => {
      const pa = Math.min(1, (a.currentAmount) / (a.targetAmount || 1));
      const pb = Math.min(1, (b.currentAmount) / (b.targetAmount || 1));
      return pb - pa;
    })
    .slice(0, 4);

  if (sorted.length === 0) return null;

  return (
    <section
      aria-label="Savings goals progress"
      className="vn-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-(--vn-text)">Goals</h2>
          <p className="text-xs text-(--vn-muted) mt-0.5">Savings progress at a glance</p>
        </div>
        <Link
          href="/goals"
          className="text-xs font-semibold text-(--vn-primary) hover:underline"
        >
          Manage →
        </Link>
      </div>

      {/* 2-col on phones → 4-col on sm+. justify-items-center keeps rings centred in each cell */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-6 justify-items-center">
        {sorted.map((g) => (
          <Ring key={g.id} goal={g} transactions={transactions} />
        ))}
      </div>
    </section>
  );
}
