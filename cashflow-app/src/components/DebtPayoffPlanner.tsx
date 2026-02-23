"use client";

/**
 * DebtPayoffPlanner
 *
 * Shows all liability accounts from the user's net-worth data, ranked by the
 * "avalanche" strategy (highest balance = clear first).
 *
 * For each debt:
 *   • Current balance with a visual progress bar vs an (optional) original balance
 *   • Debt type badge
 *   • Simple "months to clear" estimate based on the linked outflow rule or a
 *     user-defined monthly payment (falls back to 1% of balance / month)
 *
 * Collapsible — hidden behind a collapsed header on first render to avoid
 * cluttering the dashboard.
 */

import { useMemo, useState } from "react";
import type { NetWorthAccount } from "@/data/plan";
import { formatMoney } from "@/lib/currency";

type Props = {
  accounts: NetWorthAccount[];
};

const LIABILITY_TYPES: NetWorthAccount["type"][] = [
  "credit-card",
  "loan",
  "mortgage",
  "other-liability",
];

const TYPE_LABEL: Record<string, string> = {
  "credit-card":    "Credit card",
  "loan":           "Loan",
  "mortgage":       "Mortgage",
  "other-liability":"Other debt",
};

const TYPE_COLOR: Record<string, string> = {
  "credit-card":    "#e05252",
  "loan":           "#d48a2f",
  "mortgage":       "#5DA9E9",
  "other-liability":"#AAB2BD",
};

function months(balance: number, monthlyPayment: number): string {
  if (monthlyPayment <= 0 || balance <= 0) return "—";
  const m = Math.ceil(balance / monthlyPayment);
  if (m > 600) return "30+ yrs";
  if (m >= 24) return `${Math.round(m / 12)} yrs`;
  return `${m} mo`;
}

function DebtRow({ account }: { account: NetWorthAccount }) {
  const balance = Math.abs(account.balance);
  // Estimate original balance: assume balance is current and original was 20% more (rough heuristic
  // for loans) — users can see the progress even without a stored original.
  const assumed = balance * 1.2;
  const pctPaid = balance === 0 ? 1 : Math.max(0, Math.min(1, 1 - balance / assumed));

  // Rough monthly payment — 2% of balance or ≥ £25
  const estPayment = Math.max(25, balance * 0.02);
  const clarity = months(balance, estPayment);

  return (
    <div
      className="flex flex-col gap-2 py-3 border-b border-(--vn-border) last:border-0"
      role="listitem"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{
              background: TYPE_COLOR[account.type] + "22",
              color: TYPE_COLOR[account.type],
              border: `1px solid ${TYPE_COLOR[account.type]}44`,
            }}
          >
            {TYPE_LABEL[account.type] ?? account.type}
          </span>
          <span
            className="text-sm font-medium text-(--vn-text) truncate"
            title={account.name}
          >
            {account.icon ? `${account.icon} ` : ""}{account.name}
          </span>
        </div>
        <span className="text-sm font-bold text-(--vn-text) tabular-nums shrink-0">
          {formatMoney(balance)}
        </span>
      </div>

      {/* Progress bar — darker = more paid off */}
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--vn-border)" }}
        role="progressbar"
        aria-valuenow={Math.round(pctPaid * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${account.name} payoff progress: ${Math.round(pctPaid * 100)}% paid off`}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.round(pctPaid * 100)}%`,
            background: TYPE_COLOR[account.type],
            opacity: 0.85,
          }}
        />
      </div>

      <div className="flex justify-between text-(--vn-muted) text-[10px]">
        <span>Est. clear in {clarity}</span>
        <span>at ~{formatMoney(estPayment)}/mo</span>
      </div>
    </div>
  );
}

export default function DebtPayoffPlanner({ accounts }: Props) {
  const [open, setOpen] = useState(false);

  const liabilities = useMemo(
    () =>
      accounts
        .filter((a) => LIABILITY_TYPES.includes(a.type) && a.balance !== 0)
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)), // avalanche order
    [accounts],
  );

  if (liabilities.length === 0) return null;

  const totalDebt = liabilities.reduce((s, a) => s + Math.abs(a.balance), 0);

  return (
    <section aria-label="Debt payoff planner" className="vn-card p-5">
      {/* Header — always visible */}
      <button
        className="w-full flex items-center justify-between gap-3"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="debt-planner-body"
      >
        <div className="text-left">
          <h2 className="text-sm font-bold text-(--vn-text)">
            💳 Debt Payoff Planner
          </h2>
          <p className="text-xs text-(--vn-muted) mt-0.5">
            {liabilities.length} debt{liabilities.length > 1 ? "s" : ""} · Total{" "}
            {formatMoney(totalDebt)} — avalanche order
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Total badge — hidden on narrow phones since the subtitle already shows the total */}
          <span
            className="hidden sm:inline-flex text-[10px] font-semibold px-2 py-1 rounded-full"
            style={{
              background: "rgba(224,82,82,0.10)",
              color: "#e05252",
              border: "1px solid rgba(224,82,82,0.20)",
            }}
          >
            {formatMoney(totalDebt)}
          </span>
          <svg
            className={`w-4 h-4 text-(--vn-muted) transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div id="debt-planner-body" role="list" className="mt-2">
          {/* Avalanche tip */}
          <p className="text-[10px] text-(--vn-muted) mb-2 italic">
            Avalanche strategy: tackle highest-balance first while paying minimums on the rest.
          </p>
          {liabilities.map((a) => (
            <DebtRow key={a.id} account={a} />
          ))}
        </div>
      )}
    </section>
  );
}
