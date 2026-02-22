"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { loadPlan, savePlan } from "@/lib/storage";
import { formatMoney } from "@/lib/currency";
import SidebarNav from "@/components/SidebarNav";
import { toast } from "@/components/Toast";
import type { NetWorthAccount, NetWorthAccountType, NetWorthSnapshot, Plan, OutflowRule, BillTemplate } from "@/data/plan";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

// ─────────────────────────────────────────────────────────────────
// Account type metadata
// ─────────────────────────────────────────────────────────────────
const ASSET_TYPES: NetWorthAccountType[] = ["savings", "investment", "property", "other-asset"];
const LIABILITY_TYPES: NetWorthAccountType[] = ["credit-card", "loan", "mortgage", "other-liability"];

const TYPE_META: Record<NetWorthAccountType, { label: string; icon: string; color: string; group: "asset" | "liability" }> = {
  savings:          { label: "Savings & Cash",   icon: "🏦", color: "#22c55e", group: "asset" },
  investment:       { label: "Investments",      icon: "📈", color: "#5DA9E9", group: "asset" },
  property:         { label: "Property",         icon: "🏠", color: "#f59e0b", group: "asset" },
  "other-asset":    { label: "Other Assets",     icon: "💼", color: "#06b6d4", group: "asset" },
  "credit-card":    { label: "Credit Cards",     icon: "💳", color: "#ef4444", group: "liability" },
  loan:             { label: "Loans",            icon: "📋", color: "#f97316", group: "liability" },
  mortgage:         { label: "Mortgage",         icon: "🏡", color: "#AAB2BD", group: "liability" },
  "other-liability":{ label: "Other Debts",      icon: "⚠️",  color: "#B85C5C", group: "liability" },
};

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function today() {
  return new Date().toISOString().split("T")[0];
}

// ─────────────────────────────────────────────────────────────────
// Account row component
// ─────────────────────────────────────────────────────────────────
function AccountRow({
  account,
  effectiveAmt,
  onEdit,
  onDelete,
}: {
  account: NetWorthAccount;
  effectiveAmt: number;
  onEdit: (a: NetWorthAccount) => void;
  onDelete: (id: string) => void;
}) {
  const meta = TYPE_META[account.type];
  const isAuto = !!(account.linkedRuleId || account.linkedBillId);
  return (
    <div className="flex items-center gap-3 py-3 px-1 group">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm"
        style={{ background: `${meta.color}18` }}
      >
        {account.icon || meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--vn-text)] truncate">{account.name}</span>
          {isAuto && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: "rgba(34,197,94,0.15)", color: "#16a34a" }}
            >
              LIVE
            </span>
          )}
        </div>
        {account.institution && (
          <div className="text-[11px] text-[var(--vn-muted)]">{account.institution}</div>
        )}
      </div>
      <div className="font-semibold tabular-nums text-[var(--vn-text)] text-sm shrink-0">
        {formatMoney(effectiveAmt)}
      </div>
      {/* Always visible on mobile (opacity-50), full opacity on desktop hover */}
      <div className="flex gap-0.5 ml-1 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(account)}
          className="p-1.5 rounded-lg text-[var(--vn-muted)] hover:text-[var(--vn-text)] hover:bg-[var(--vn-bg)] active:bg-[var(--vn-bg)] transition-colors"
          aria-label="Edit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(account.id)}
          className="p-1.5 rounded-lg text-[var(--vn-muted)] hover:text-[var(--error)] active:text-[var(--error)] hover:bg-[var(--error-soft)] active:bg-[var(--error-soft)] transition-colors"
          aria-label="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Account form (add / edit)
// ─────────────────────────────────────────────────────────────────
function AccountForm({
  initial,
  outflowRules,
  bills,
  onSave,
  onCancel,
}: {
  initial?: NetWorthAccount;
  outflowRules: OutflowRule[];
  bills: BillTemplate[];
  onSave: (a: Omit<NetWorthAccount, "id"> & { id?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName]               = useState(initial?.name ?? "");
  const [type, setType]               = useState<NetWorthAccountType>(initial?.type ?? "savings");
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [balance, setBalance]         = useState(initial ? String(initial.balance) : "");
  const [icon, setIcon]               = useState(initial?.icon ?? "");
  const [notes, setNotes]             = useState(initial?.notes ?? "");
  const [error, setError]             = useState("");
  // Auto-link fields
  const [linkedRuleId, setLinkedRuleId] = useState(initial?.linkedRuleId ?? "");
  const [linkedBillId, setLinkedBillId] = useState(initial?.linkedBillId ?? "");
  const [baseBalance, setBaseBalance]   = useState(
    initial?.baseBalance !== undefined ? String(initial.baseBalance) : "0"
  );
  const [baseDate, setBaseDate]         = useState(initial?.baseDate ?? "");
  const [linkedRuleShare, setLinkedRuleShare] = useState(
    initial?.linkedRuleShare !== undefined ? String(Math.round((initial.linkedRuleShare) * 100)) : "100"
  );

  const isAutoLinked = !!linkedRuleId || !!linkedBillId;
  const isSavingsType = type === "savings";
  const isLiabilityType = LIABILITY_TYPES.includes(type);

  // For savings accounts: only show savings outflow rules
  const savingsRules = outflowRules.filter(r => r.category === "savings" && r.enabled);
  // For liabilities: show all outflow rules + bills as payment sources
  const paymentRules = outflowRules.filter(r => r.enabled);
  const paymentBills = bills.filter(b => b.enabled);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Account name is required"); return; }
    const baseBal = parseFloat(baseBalance) || 0;
    if (!isAutoLinked) {
      const bal = parseFloat(balance);
      if (isNaN(bal) || bal < 0) { setError("Balance must be a positive number"); return; }
    }
    onSave({
      id: initial?.id,
      name: name.trim(),
      type,
      institution: institution.trim() || undefined,
      balance: isAutoLinked ? baseBal : parseFloat(balance),
      icon: icon.trim() || undefined,
      notes: notes.trim() || undefined,
      linkedRuleId: linkedRuleId || undefined,
      linkedBillId: linkedBillId || undefined,
      linkedRuleShare: (isAutoLinked && linkedRuleId)
        ? Math.min(1, Math.max(0, parseFloat(linkedRuleShare) / 100 || 1))
        : undefined,
      baseBalance: isAutoLinked ? baseBal : undefined,
      baseDate: isAutoLinked && baseDate ? baseDate : undefined,
    });
  }

  // Clear link when type changes
  function handleTypeChange(t: NetWorthAccountType) {
    setType(t);
    setLinkedRuleId("");
    setLinkedBillId("");
    setLinkedRuleShare("100");
  }

  const allTypes = [...ASSET_TYPES, ...LIABILITY_TYPES];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-5 vn-card">
      <h3 className="text-sm font-bold text-[var(--vn-text)]">
        {initial ? "Edit account" : "Add account"}
      </h3>
      {error && <p className="text-xs text-rose-500">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        {/* Name */}
        <div className="col-span-2">
          <label className="text-xs font-semibold text-[var(--vn-muted)] uppercase tracking-wide">Account name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Monzo Current Account"
            className="mt-1 w-full rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)] focus:outline-none focus:border-[var(--vn-gold)]"
          />
        </div>

        {/* Type */}
        <div>
          <label className="text-xs font-semibold text-[var(--vn-muted)] uppercase tracking-wide">Type *</label>
          <select
            value={type}
            onChange={e => handleTypeChange(e.target.value as NetWorthAccountType)}
            className="mt-1 w-full rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)] focus:outline-none focus:border-[var(--vn-gold)]"
          >
            <optgroup label="Assets">
              {ASSET_TYPES.map(t => (
                <option key={t} value={t}>{TYPE_META[t].icon} {TYPE_META[t].label}</option>
              ))}
            </optgroup>
            <optgroup label="Liabilities">
              {LIABILITY_TYPES.map(t => (
                <option key={t} value={t}>{TYPE_META[t].icon} {TYPE_META[t].label}</option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Balance — hidden when auto-linked */}
        {!isAutoLinked && (
          <div>
            <label className="text-xs font-semibold text-[var(--vn-muted)] uppercase tracking-wide">Balance *</label>
            <input
              type="number"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)] focus:outline-none focus:border-[var(--vn-gold)]"
            />
          </div>
        )}

        {/* Institution */}
        <div>
          <label className="text-xs font-semibold text-[var(--vn-muted)] uppercase tracking-wide">Institution</label>
          <input
            value={institution}
            onChange={e => setInstitution(e.target.value)}
            placeholder="e.g. Monzo, Vanguard"
            className="mt-1 w-full rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)] focus:outline-none focus:border-[var(--vn-gold)]"
          />
        </div>

        {/* Icon */}
        <div>
          <label className="text-xs font-semibold text-[var(--vn-muted)] uppercase tracking-wide">Icon (emoji)</label>
          <input
            value={icon}
            onChange={e => setIcon(e.target.value)}
            placeholder={TYPE_META[type].icon}
            maxLength={4}
            className="mt-1 w-full rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)] focus:outline-none focus:border-[var(--vn-gold)]"
          />
        </div>
      </div>

      {/* ── Auto-link section ─────────────────────────────────── */}
      {(isSavingsType || isLiabilityType) && (
        <div className="rounded-xl border border-[var(--vn-border)] bg-[var(--vn-bg)] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--vn-text)]">
              {isSavingsType ? "🔄 Auto-sync from savings transfers" : "🔄 Auto-track payments"}
            </span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(168,115,26,0.15)", color: "var(--vn-gold)" }}
            >
              LIVE
            </span>
          </div>
          <p className="text-xs text-[var(--vn-muted)]">
            {isSavingsType
              ? "Link to a savings rule so the balance updates automatically as you record transfers."
              : "Link to a payment rule or bill so card payments automatically reduce this liability."}
          </p>

          {isSavingsType && savingsRules.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-[var(--vn-muted)] uppercase tracking-wide">Savings rule</label>
              <select
                value={linkedRuleId}
                onChange={e => { setLinkedRuleId(e.target.value); setLinkedBillId(""); }}
                className="mt-1 w-full rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)] focus:outline-none focus:border-[var(--vn-gold)]"
              >
                <option value="">— Not linked (manual) —</option>
                {savingsRules.map(r => (
                  <option key={r.id} value={r.id}>{r.label} (£{r.amount.toFixed(2)})</option>
                ))}
              </select>
            </div>
          )}

          {isLiabilityType && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--vn-muted)] uppercase tracking-wide">Payment rule</label>
                <select
                  value={linkedRuleId}
                  onChange={e => { setLinkedRuleId(e.target.value); if (e.target.value) setLinkedBillId(""); }}
                  className="mt-1 w-full rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)] focus:outline-none focus:border-[var(--vn-gold)]"
                >
                  <option value="">— None —</option>
                  {paymentRules.map(r => (
                    <option key={r.id} value={r.id}>{r.label} (£{r.amount.toFixed(2)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--vn-muted)] uppercase tracking-wide">Or bill</label>
                <select
                  value={linkedBillId}
                  onChange={e => { setLinkedBillId(e.target.value); if (e.target.value) setLinkedRuleId(""); }}
                  className="mt-1 w-full rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)] focus:outline-none focus:border-[var(--vn-gold)]"
                >
                  <option value="">— None —</option>
                  {paymentBills.map(b => (
                    <option key={b.id} value={b.id}>{b.label} (£{b.amount.toFixed(2)})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Base balance + start date — shown when linked */}
          {isAutoLinked && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--vn-muted)] uppercase tracking-wide">
                  {isSavingsType ? "Opening balance (£)" : "Current balance owed (£)"}
                </label>
                <input
                  type="number"
                  value={baseBalance}
                  onChange={e => setBaseBalance(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)] focus:outline-none focus:border-[var(--vn-gold)]"
                />
                <p className="mt-1 text-[10px] text-[var(--vn-muted)]">
                  {isSavingsType ? "Amount already in this account" : "Outstanding balance before payments"}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--vn-muted)] uppercase tracking-wide">Count transactions from</label>
                <input
                  type="date"
                  value={baseDate}
                  onChange={e => setBaseDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)] focus:outline-none focus:border-[var(--vn-gold)]"
                />
                <p className="mt-1 text-[10px] text-[var(--vn-muted)]">Leave blank to count all</p>
              </div>

              {/* Split % — only relevant for liability linked to a rule */}
              {isLiabilityType && linkedRuleId && (
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-[var(--vn-muted)] uppercase tracking-wide">
                    % of rule attributed to this card
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      value={linkedRuleShare}
                      onChange={e => setLinkedRuleShare(e.target.value)}
                      min="1"
                      max="100"
                      step="1"
                      className="w-24 rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)] focus:outline-none focus:border-[var(--vn-gold)]"
                    />
                    <span className="text-sm text-[var(--vn-muted)]">%</span>
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--vn-muted)]">
                    Split one budget rule across multiple cards. E.g. two cards sharing a £500 rule: 60% here, 40% on the other.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="text-xs font-semibold text-[var(--vn-muted)] uppercase tracking-wide">Notes</label>
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Optional notes"
          className="mt-1 w-full rounded-lg border border-[var(--vn-border)] bg-[var(--vn-surface)] px-3 py-2 text-sm text-[var(--vn-text)] focus:outline-none focus:border-[var(--vn-gold)]"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" className="vn-btn vn-btn-primary text-sm flex-1">
          {initial ? "Save changes" : "Add account"}
        </button>
        <button type="button" onClick={onCancel} className="vn-btn vn-btn-ghost text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────
// Recharts custom tooltip
// ─────────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="vn-card px-4 py-3 text-sm shadow-xl" style={{ minWidth: 160 }}>
      <div className="text-xs text-[var(--vn-muted)] mb-1">{label}</div>
      <div className={`font-bold tabular-nums text-base ${val >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
        {formatMoney(val)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────
export default function NetWorthPage() {
  const [plan, setPlan]               = useState<Plan | null>(null);
  const [accounts, setAccounts]       = useState<NetWorthAccount[]>([]);
  const [snapshots, setSnapshots]     = useState<NetWorthSnapshot[]>([]);
  const [showForm, setShowForm]       = useState(false);
  const [editAccount, setEditAccount] = useState<NetWorthAccount | null>(null);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);

  // ── Load plan ──────────────────────────────────────────────────
  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    setAccounts(p.netWorthAccounts ?? []);
    setSnapshots(p.netWorthSnapshots ?? []);
  }, []);

  // ── Derived from plan ─────────────────────────────────────────
  const transactions  = plan?.transactions  ?? [];
  const outflowRules  = plan?.outflowRules  ?? [];
  const bills         = plan?.bills         ?? [];

  // ── Effective balance computation ──────────────────────────────
  // For savings (asset): baseBalance + sum of matching transactions (transfers in)
  // For liabilities: baseBalance − sum of matching payment transactions
  function effectiveBalance(account: NetWorthAccount): number {
    if (!account.linkedRuleId && !account.linkedBillId) return account.balance;
    const since = account.baseDate ?? "0000-00-00";
    const share = account.linkedRuleShare ?? 1; // fraction of rule attributed to this account
    let txSum = 0;
    if (account.linkedRuleId) {
      txSum += transactions
        .filter(t => t.linkedRuleId === account.linkedRuleId && t.date >= since)
        .reduce((s, t) => s + t.amount, 0) * share;
    }
    if (account.linkedBillId) {
      txSum += transactions
        .filter(t => t.linkedBillId === account.linkedBillId && t.date >= since)
        .reduce((s, t) => s + t.amount, 0);
    }
    const base = account.baseBalance ?? 0;
    if (ASSET_TYPES.includes(account.type)) {
      // Savings / asset: base + accumulated transfers
      return base + txSum;
    } else {
      // Liability: base − payments made (floor at 0)
      return Math.max(0, base - txSum);
    }
  }

  // ── Totals ─────────────────────────────────────────────────────
  const { totalAssets, totalLiabilities, netWorth } = useMemo(() => {
    const assets = accounts
      .filter(a => ASSET_TYPES.includes(a.type))
      .reduce((s, a) => s + effectiveBalance(a), 0);
    const liabilities = accounts
      .filter(a => LIABILITY_TYPES.includes(a.type))
      .reduce((s, a) => s + effectiveBalance(a), 0);
    return { totalAssets: assets, totalLiabilities: liabilities, netWorth: assets - liabilities };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, transactions]);

  // ── Persist helpers ───────────────────────────────────────────
  function persist(newAccounts: NetWorthAccount[], newSnapshots?: NetWorthSnapshot[]) {
    if (!plan) return;
    const updated: Plan = {
      ...plan,
      netWorthAccounts: newAccounts,
      netWorthSnapshots: newSnapshots ?? snapshots,
    };
    savePlan(updated);
    setPlan(updated);
    setAccounts(newAccounts);
    if (newSnapshots) setSnapshots(newSnapshots);
  }

  // ── Account CRUD ──────────────────────────────────────────────
  function handleSaveAccount(data: Omit<NetWorthAccount, "id"> & { id?: string }) {
    let next: NetWorthAccount[];
    if (data.id) {
      next = accounts.map(a => a.id === data.id ? { ...a, ...data, id: a.id } : a);
    } else {
      next = [...accounts, { ...data, id: makeId() } as NetWorthAccount];
    }
    next = next.map((a, i) => ({ ...a, order: a.order ?? i }));
    persist(next);
    setShowForm(false);
    setEditAccount(null);
    toast.success(`Account ${data.id ? "updated" : "added"}`);
  }

  function handleDeleteAccount(id: string) {
    if (!confirm("Remove this account?")) return;
    persist(accounts.filter(a => a.id !== id));
    toast.success("Account removed");
  }

  function handleEditAccount(a: NetWorthAccount) {
    setEditAccount(a);
    setShowForm(true);
  }

  // ── Snapshot ──────────────────────────────────────────────────
  function handleSaveSnapshot() {
    const snap: NetWorthSnapshot = {
      id: makeId(),
      date: today(),
      totalAssets,
      totalLiabilities,
      netWorth,
      accountBalances: Object.fromEntries(accounts.map(a => [a.id, effectiveBalance(a)])),
    };
    const next = [...snapshots, snap].sort((a, b) => a.date.localeCompare(b.date));
    persist(accounts, next);
    setSnapshotMsg(`Snapshot saved for ${today()}`);
    setTimeout(() => setSnapshotMsg(null), 3000);
    toast.success("Snapshot saved");
  }

  // ── Chart data ────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return snapshots.slice(-24).map(s => ({
      date: s.date.slice(0, 7), // YYYY-MM
      netWorth: s.netWorth,
      assets: s.totalAssets,
      liabilities: s.totalLiabilities,
    }));
  }, [snapshots]);

  // ── Grouped accounts for display ──────────────────────────────
  const assetAccounts    = accounts.filter(a => ASSET_TYPES.includes(a.type));
  const liabilityAccounts = accounts.filter(a => LIABILITY_TYPES.includes(a.type));

  if (!plan) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--vn-muted)] text-sm">Loading…</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-40 pt-5">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav />

          <div className="space-y-6">

            {/* ── Page header ─────────────────────────────────── */}
            <header className="vn-masthead">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 relative z-10">
                <div>
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(212,168,67,0.8)" }}>
                    Financial Position
                  </p>
                  <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-playfair, serif)" }}>
                    Net Worth
                  </h1>
                  <p className="mt-1 text-sm" style={{ color: "rgba(240,237,232,0.55)" }}>
                    Assets, liabilities &amp; your total financial position
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 mt-1">
                  <button
                    onClick={handleSaveSnapshot}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: "rgba(212,168,67,0.18)",
                      border: "1px solid rgba(212,168,67,0.35)",
                      color: "#d4a843",
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save snapshot
                  </button>
                  <button
                    onClick={() => { setEditAccount(null); setShowForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: "rgba(240,237,232,0.12)",
                      border: "1px solid rgba(240,237,232,0.2)",
                      color: "rgba(240,237,232,0.9)",
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add account
                  </button>
                </div>
              </div>

              {snapshotMsg && (
                <p className="relative z-10 mt-3 text-xs" style={{ color: "rgba(212,168,67,0.9)" }}>
                  ✓ {snapshotMsg}
                </p>
              )}
            </header>

            {/* ── Net Worth hero metric ────────────────────────── */}
            {/* Mobile: 2-col grid so Assets/Liabilities each get 50% width */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* Net Worth — full width on mobile, 1/3 on desktop */}
              <div className="col-span-2 sm:col-span-1 vn-stat-card">
                <p className="vn-label mb-2">Total Net Worth</p>
                <p
                  className={`text-3xl font-bold tabular-nums tracking-tight ${netWorth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatMoney(netWorth)}
                </p>
                <p className="vn-subtext mt-1">Assets minus liabilities</p>
              </div>
              <div className="vn-stat-card min-w-0">
                <p className="vn-label mb-2">Total Assets</p>
                <p className="text-xl sm:text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 tracking-tight break-all">
                  {formatMoney(totalAssets)}
                </p>
                <p className="vn-subtext mt-1">{assetAccounts.length} account{assetAccounts.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="vn-stat-card min-w-0">
                <p className="vn-label mb-2">Total Liabilities</p>
                <p className="text-xl sm:text-2xl font-bold tabular-nums text-rose-500 tracking-tight break-all">
                  {formatMoney(totalLiabilities)}
                </p>
                <p className="vn-subtext mt-1">{liabilityAccounts.length} account{liabilityAccounts.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* ── Add / Edit form ──────────────────────────────── */}
            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <AccountForm
                    initial={editAccount ?? undefined}
                    outflowRules={outflowRules}
                    bills={bills}
                    onSave={handleSaveAccount}
                    onCancel={() => { setShowForm(false); setEditAccount(null); }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Assets ──────────────────────────────────────── */}
            <section className="vn-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-[var(--vn-text)]">Assets</h2>
                  <p className="text-xs text-[var(--vn-muted)] mt-0.5">Everything you own</p>
                </div>
                <span className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatMoney(totalAssets)}
                </span>
              </div>

              {assetAccounts.length === 0 ? (
                <div className="text-center py-8 text-[var(--vn-muted)]">
                  <div className="text-3xl mb-2">💰</div>
                  <p className="text-sm">No assets added yet</p>
                  <button
                    onClick={() => { setEditAccount(null); setShowForm(true); }}
                    className="mt-3 text-xs font-semibold text-[var(--vn-gold)] hover:underline"
                  >
                    Add your first asset →
                  </button>
                </div>
              ) : (
                <div>
                  {/* Group by type */}
                  {ASSET_TYPES.map(type => {
                    const group = assetAccounts.filter(a => a.type === type);
                    if (group.length === 0) return null;
                    const meta = TYPE_META[type];
                    const subtotal = group.reduce((s, a) => s + effectiveBalance(a), 0);
                    return (
                      <div key={type} className="mb-4 last:mb-0">
                        <div className="flex items-center justify-between mb-2 pb-1 border-b border-[var(--vn-border)]">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{meta.icon}</span>
                            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--vn-muted)]">{meta.label}</span>
                          </div>
                          <span className="text-xs font-bold tabular-nums" style={{ color: meta.color }}>{formatMoney(subtotal)}</span>
                        </div>
                        <div className="divide-y divide-[var(--vn-border)]/50">
                          {group.map(a => (
                            <AccountRow key={a.id} account={a} effectiveAmt={effectiveBalance(a)} onEdit={handleEditAccount} onDelete={handleDeleteAccount} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Liabilities ──────────────────────────────────── */}
            <section className="vn-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-[var(--vn-text)]">Liabilities</h2>
                  <p className="text-xs text-[var(--vn-muted)] mt-0.5">Everything you owe</p>
                </div>
                <span className="text-lg font-bold tabular-nums text-rose-500">
                  {formatMoney(totalLiabilities)}
                </span>
              </div>

              {liabilityAccounts.length === 0 ? (
                <div className="text-center py-8 text-[var(--vn-muted)]">
                  <div className="text-3xl mb-2">💳</div>
                  <p className="text-sm">No liabilities added yet</p>
                  <button
                    onClick={() => { setEditAccount(null); setShowForm(true); }}
                    className="mt-3 text-xs font-semibold text-[var(--vn-gold)] hover:underline"
                  >
                    Add a liability →
                  </button>
                </div>
              ) : (
                <div>
                  {LIABILITY_TYPES.map(type => {
                    const group = liabilityAccounts.filter(a => a.type === type);
                    if (group.length === 0) return null;
                    const meta = TYPE_META[type];
                    const subtotal = group.reduce((s, a) => s + effectiveBalance(a), 0);
                    return (
                      <div key={type} className="mb-4 last:mb-0">
                        <div className="flex items-center justify-between mb-2 pb-1 border-b border-[var(--vn-border)]">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{meta.icon}</span>
                            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--vn-muted)]">{meta.label}</span>
                          </div>
                          <span className="text-xs font-bold tabular-nums" style={{ color: meta.color }}>{formatMoney(subtotal)}</span>
                        </div>
                        <div className="divide-y divide-[var(--vn-border)]/50">
                          {group.map(a => (
                            <AccountRow key={a.id} account={a} effectiveAmt={effectiveBalance(a)} onEdit={handleEditAccount} onDelete={handleDeleteAccount} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Net Worth trend chart ─────────────────────────── */}
            {chartData.length >= 2 && (
              <section className="vn-card p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-base font-bold text-[var(--vn-text)]">Net Worth Over Time</h2>
                    <p className="text-xs text-[var(--vn-muted)] mt-0.5">
                      {chartData.length} snapshot{chartData.length !== 1 ? "s" : ""} recorded
                    </p>
                  </div>
                  {snapshots.length > 0 && (
                    <span className="text-xs text-[var(--vn-muted)]">
                      Last: {snapshots[snapshots.length - 1].date}
                    </span>
                  )}
                </div>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a8731a" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#a8731a" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--vn-border)" strokeOpacity={0.5} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "var(--vn-muted)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--vn-muted)" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `£${Math.round(v / 1000)}k`}
                        width={52}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={0} stroke="var(--vn-border)" strokeWidth={1} />
                      <Area
                        type="monotone"
                        dataKey="netWorth"
                        stroke="#a8731a"
                        strokeWidth={2.5}
                        fill="url(#nwGradient)"
                        dot={{ r: 4, fill: "#a8731a", strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: "#a8731a", strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* ── Snapshot list (when chart not yet available) ─── */}
            {snapshots.length > 0 && chartData.length < 2 && (
              <section className="vn-card p-6">
                <h2 className="text-base font-bold text-[var(--vn-text)] mb-4">Snapshot history</h2>
                <div className="space-y-2">
                  {[...snapshots].reverse().slice(0, 10).map(s => (
                    <div key={s.id} className="flex items-center justify-between py-2 border-b border-[var(--vn-border)] last:border-0">
                      <span className="text-sm text-[var(--vn-muted)]">{s.date}</span>
                      <div className="flex gap-6 text-sm tabular-nums">
                        <span className="text-emerald-600 dark:text-emerald-400">+{formatMoney(s.totalAssets)}</span>
                        <span className="text-rose-500">−{formatMoney(s.totalLiabilities)}</span>
                        <span className={`font-bold ${s.netWorth >= 0 ? "text-[var(--vn-text)]" : "text-rose-500"}`}>
                          {formatMoney(s.netWorth)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-[var(--vn-muted)]">
                  Add more snapshots over time to see your trend chart.
                </p>
              </section>
            )}

            {/* ── Empty state ───────────────────────────────────── */}
            {accounts.length === 0 && !showForm && (
              <div className="vn-card p-10 text-center">
                <div className="text-4xl mb-3">📊</div>
                <h2 className="text-lg font-bold text-[var(--vn-text)] mb-1">Build your financial picture</h2>
                <p className="text-sm text-[var(--vn-muted)] max-w-sm mx-auto mb-6">
                  Add your savings accounts, investments, property, loans and credit cards to track your total net worth over time.
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="vn-btn vn-btn-primary text-sm px-8"
                >
                  Add your first account
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}
