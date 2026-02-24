"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/currency";
import type { Transaction, CashflowCategory } from "@/data/plan";

const CATEGORY_OPTIONS: { value: CashflowCategory; label: string; emoji: string }[] = [
  { value: "bill",      label: "Bill",      emoji: "📄" },
  { value: "giving",    label: "Giving",    emoji: "❤️" },
  { value: "savings",   label: "Savings",   emoji: "🏦" },
  { value: "allowance", label: "Allowance", emoji: "💳" },
  { value: "buffer",    label: "Buffer",    emoji: "🛡️" },
];

type Props = {
  transactions: Transaction[];
  onRecategorise: (id: string, category: CashflowCategory) => void;
  onDismissAll?: () => void;
};

export default function TransactionTriage({ transactions, onRecategorise, onDismissAll }: Props) {
  const [localDismissed, setLocalDismissed] = useState<Set<string>>(new Set());

  const visible = transactions.filter((t) => !localDismissed.has(t.id));

  if (visible.length === 0) return null;

  function skipOne(id: string) {
    setLocalDismissed((prev) => new Set([...prev, id]));
  }

  function applyCategory(id: string, category: CashflowCategory) {
    setLocalDismissed((prev) => new Set([...prev, id]));
    onRecategorise(id, category);
  }

  const PAGE = 5;
  const showing = visible.slice(0, PAGE);
  const remaining = visible.length - PAGE;

  return (
    <div className="vn-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--vn-text)]">Categorise Transactions</span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(212,168,67,0.15)", color: "var(--gold, #d4a843)" }}
            >
              {visible.length}
            </span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--vn-muted)" }}>
            These are labelled &ldquo;other&rdquo; — pick a category to improve your reports.
          </div>
        </div>
        {onDismissAll && (
          <button
            onClick={onDismissAll}
            className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--vn-muted)", background: "var(--vn-bg)", border: "1px solid var(--vn-border)" }}
          >
            Skip all
          </button>
        )}
      </div>

      {/* Triage rows */}
      <div className="space-y-2">
        {showing.map((t) => (
          <div
            key={t.id}
            className="rounded-xl p-3 transition-opacity"
            style={{ background: "var(--vn-bg)", border: "1px solid var(--vn-border)" }}
          >
            {/* Row top: label, date, amount, skip */}
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" style={{ color: "var(--vn-text)" }}>{t.label}</div>
                <div className="text-[11px]" style={{ color: "var(--vn-muted)" }}>{t.date}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>
                  {formatMoney(t.amount)}
                </span>
                <button
                  onClick={() => skipOne(t.id)}
                  aria-label="Skip this transaction"
                  className="w-6 h-6 flex items-center justify-center rounded-full transition-colors"
                  style={{ color: "var(--vn-muted)" }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => applyCategory(t.id, opt.value)}
                  className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: "var(--vn-surface)",
                    border: "1px solid var(--vn-border)",
                    color: "var(--vn-text)",
                  }}
                >
                  <span aria-hidden="true">{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {remaining > 0 && (
          <div className="text-center text-[11px] py-1" style={{ color: "var(--vn-muted)" }}>
            +{remaining} more to categorise
          </div>
        )}
      </div>
    </div>
  );
}
