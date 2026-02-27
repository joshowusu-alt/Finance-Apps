"use client";

import { useFocusTrap } from "@/hooks/useFocusTrap";
import { formatMoney } from "@/lib/currency";
import type { Plan } from "@/data/plan";

// ─── Diff helpers ──────────────────────────────────────────────────────────

function summaryOf(plan: Plan) {
  const period = plan.periods.find((p) => p.id === plan.setup.selectedPeriodId) ?? plan.periods[0];
  const txns = period
    ? plan.transactions.filter((t) => t.date >= period.start && t.date <= period.end)
    : plan.transactions;

  const income = txns.reduce((s, t) => s + (t.type === "income" ? t.amount : 0), 0);
  const outflow = txns.reduce((s, t) => s + (t.type === "outflow" ? t.amount : 0), 0);
  return {
    periodLabel: period?.label ?? "Current period",
    txnCount: txns.length,
    totalTxns: plan.transactions.length,
    income,
    outflow,
    net: income - outflow,
    rulesCount: plan.incomeRules.length + plan.outflowRules.length + plan.bills.length,
  };
}

function StatRow({ label, local, remote }: { label: string; local: string | number; remote: string | number }) {
  const differs = String(local) !== String(remote);
  return (
    <div className={`grid grid-cols-3 gap-2 py-1.5 text-sm ${differs ? "rounded-lg px-2 -mx-2" : ""}`}
      style={differs ? { background: "color-mix(in srgb, var(--vn-warning, #f59e0b) 8%, transparent)" } : {}}>
      <span className="text-(--vn-muted) truncate">{label}</span>
      <span className={`text-center font-medium tabular-nums ${differs ? "text-(--vn-text)" : "text-(--vn-muted)"}`}>{local}</span>
      <span className={`text-center font-medium tabular-nums ${differs ? "text-(--vn-text)" : "text-(--vn-muted)"}`}>{remote}</span>
    </div>
  );
}

type Props = {
  localPlan: Plan;
  remotePlan: Plan;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  onKeepLocal: () => void;
  onKeepRemote: () => void;
};

export default function MergeConflictModal({
  localPlan,
  remotePlan,
  localUpdatedAt,
  remoteUpdatedAt,
  onKeepLocal,
  onKeepRemote,
}: Props) {
  const local = summaryOf(localPlan);
  const remote = summaryOf(remotePlan);

  const trapRef = useFocusTrap(true);

  function fmt(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sync conflict"
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
    >
      <div
        ref={trapRef}
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--vn-surface)", border: "1px solid var(--vn-border)" }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-(--vn-border)" style={{ background: "color-mix(in srgb, #f59e0b 8%, transparent)" }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h2 className="font-bold text-(--vn-text)" style={{ fontFamily: "var(--font-playfair, serif)" }}>
                Sync conflict
              </h2>
              <p className="text-xs text-(--vn-muted) mt-0.5">
                Both devices edited the plan at the same time. Choose which version to keep.
              </p>
            </div>
          </div>
        </div>

        {/* Comparison table */}
        <div className="px-5 py-4">
          {/* Column headers */}
          <div className="grid grid-cols-3 gap-2 pb-2 mb-1 border-b border-(--vn-border)">
            <span className="text-xs font-semibold uppercase tracking-wide text-(--vn-muted)"></span>
            <div className="text-center">
              <div className="text-xs font-semibold uppercase tracking-wide text-(--vn-muted)">This device</div>
              <div className="text-xs text-(--vn-muted) mt-0.5">{fmt(localUpdatedAt)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold uppercase tracking-wide text-(--vn-muted)">Other device</div>
              <div className="text-xs text-(--vn-muted) mt-0.5">{fmt(remoteUpdatedAt)}</div>
            </div>
          </div>

          <div className="space-y-0.5">
            <StatRow label="Transactions" local={local.txnCount} remote={remote.txnCount} />
            <StatRow label="Income (period)" local={formatMoney(local.income)} remote={formatMoney(remote.income)} />
            <StatRow label="Outflows (period)" local={formatMoney(local.outflow)} remote={formatMoney(remote.outflow)} />
            <StatRow label="Rules & bills" local={local.rulesCount} remote={remote.rulesCount} />
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 grid grid-cols-2 gap-3">
          <button
            onClick={onKeepLocal}
            className="rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            Keep this device
          </button>
          <button
            onClick={onKeepRemote}
            className="rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)" }}
          >
            Take other device
          </button>
        </div>
      </div>
    </div>
  );
}
