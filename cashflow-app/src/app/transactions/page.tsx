"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { loadPlan, savePlan } from "@/lib/storage";
import { getPeriod, generateEvents } from "@/lib/cashflowEngine";
import { formatMoney, getCurrency } from "@/lib/currency";
import { suggestBillId } from "@/lib/billLinking";
import { detectRecurringBills, type DetectedBill } from "@/lib/billDetection";
import { getConfidenceLabel, suggestCategory } from "@/lib/categorization";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportData";
import SidebarNav from "@/components/SidebarNav";
import EmptyState from "@/components/EmptyState";
import { showToast } from "@/components/Toast";
import { MerchantLogo } from "@/components/MerchantLogo";
import { FormError } from "@/components/FormError";
import type { Transaction, CashflowCategory, CashflowType, Plan, BillTemplate } from "@/data/plan";
import { normalizeText, splitTokens } from "@/lib/textUtils";


function formatNice(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  return `${weekday} ${day} ${month}`;
}

function makeId() {
  return `txn-${Date.now()}`;
}

function today() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}



const incomeStopWords = new Set(["income", "salary", "pay", "payment", "wage"]);

function scoreRuleMatch(hay: string, tokens: string[]) {
  const normalized = normalizeText(hay);
  if (!normalized) return 0;
  const wordSet = new Set(splitTokens(normalized));
  let score = 0;
  for (const token of tokens) {
    if (!token) continue;
    if (wordSet.has(token)) {
      score += 2;
    } else if (normalized.includes(token)) {
      score += 1;
    }
  }
  return score;
}

function suggestIncomeRuleId(label: string, notes: string, rules: Plan["incomeRules"]) {
  if (!label && !notes) return "";
  let bestId = "";
  let bestScore = 0;
  const hay = `${label} ${notes ?? ""}`.trim();

  rules.forEach((rule) => {
    if (!rule.enabled) return;
    const labelBase = rule.label.replace(/income/gi, "").trim();
    const tokens = Array.from(
      new Set(
        [labelBase, rule.id]
          .map((value) => splitTokens(value))
          .flat()
          .filter((token) => token.length >= 2 && !incomeStopWords.has(token))
      )
    );
    const score = scoreRuleMatch(hay, tokens);
    if (score > bestScore) {
      bestScore = score;
      bestId = rule.id;
    }
  });

  return bestScore > 0 ? bestId : "";
}

const outflowStopWords = new Set(["outflow", "rule", "transfer", "payment", "bill", "giving", "savings"]);

function suggestOutflowRuleId(label: string, notes: string, rules: Plan["outflowRules"]) {
  if (!label && !notes) return "";
  let bestId = "";
  let bestScore = 0;
  const hay = `${label} ${notes ?? ""}`.trim();

  rules.forEach((rule) => {
    if (!rule.enabled) return;
    const tokens = Array.from(
      new Set([rule.label, rule.id].map((value) => splitTokens(value)).flat())
    ).filter((token) => token.length >= 2 && !outflowStopWords.has(token));
    const score = scoreRuleMatch(hay, tokens);
    if (score > bestScore) {
      bestScore = score;
      bestId = rule.id;
    }
  });

  return bestScore > 0 ? bestId : "";
}

function resolveIncomeRuleId(draft: TransactionDraft, rules: Plan["incomeRules"]) {
  if (draft.type !== "income") return undefined;
  const suggested = suggestIncomeRuleId(draft.label, draft.notes, rules);
  if (draft.linkedRuleId === null) return undefined;
  const resolved = draft.linkedRuleId ?? suggested;
  return resolved || undefined;
}

const OUTFLOW_CATEGORIES: CashflowCategory[] = ["bill", "giving", "allowance", "buffer", "other"];
const DEFAULT_CATEGORY_FOR_TYPE: Record<CashflowType, CashflowCategory> = {
  income: "income",
  outflow: "other",
  transfer: "savings",
};
const BILL_CATEGORIES = new Set<CashflowCategory>(["bill", "giving"]);
const FREE_TEXT_CATEGORIES = new Set<CashflowCategory>(["allowance", "buffer", "other"]);
const AUTO_CATEGORY_CONFIDENCE = 60;

function categoryOptionsForType(type: CashflowType) {
  if (type === "income") return ["income"] as CashflowCategory[];
  if (type === "transfer") return ["savings"] as CashflowCategory[];
  return OUTFLOW_CATEGORIES;
}

function isBillCategory(category: CashflowCategory) {
  return BILL_CATEGORIES.has(category);
}

function isFreeTextCategory(category: CashflowCategory) {
  return FREE_TEXT_CATEGORIES.has(category);
}

function resolveSuggestedId(explicit: string | null | undefined, suggested: string) {
  if (explicit === null) return "";
  return explicit ?? suggested ?? "";
}

function formatCategoryLabel(category: CashflowCategory) {
  return `${category.slice(0, 1).toUpperCase()}${category.slice(1)}`;
}

function formatFrequencyLabel(frequency: string) {
  const labels: Record<string, string> = {
    monthly: "Monthly",
    biweekly: "Every 2 weeks",
    weekly: "Weekly",
  };
  return labels[frequency] || frequency;
}

function slugifyBillLabel(label: string) {
  const slug = normalizeText(label).replace(/\s+/g, "-");
  return slug || "bill";
}

function findExistingBillByLabel(label: string, bills: BillTemplate[]) {
  const normalized = normalizeText(label);
  if (!normalized) return undefined;
  return bills.find((bill) => normalizeText(bill.label) === normalized);
}

function makeUniqueBillId(label: string, bills: BillTemplate[]) {
  const base = slugifyBillLabel(label);
  let id = base;
  let counter = 1;
  while (bills.some((bill) => bill.id === id)) {
    counter += 1;
    id = `${base}-${counter}`;
  }
  return id;
}

function suggestDetectedBill(label: string, notes: string, detectedBills: DetectedBill[]) {
  if (!label && !notes) return null;
  const hay = `${label} ${notes ?? ""}`.trim();
  let best: DetectedBill | null = null;
  let bestScore = 0;
  detectedBills.forEach((bill) => {
    const tokens = splitTokens(bill.merchantName).filter((token) => token.length >= 2);
    if (tokens.length === 0) return;
    const score = scoreRuleMatch(hay, tokens);
    if (score > bestScore) {
      bestScore = score;
      best = bill;
    }
  });
  return bestScore >= 2 ? best : null;
}

type TransactionDraft = {
  date: string;
  label: string;
  amount: string;
  type: CashflowType;
  category: CashflowCategory;
  notes: string;
  linkedRuleId?: string | null;
  linkedBillId?: string | null;
};

function normalizeCategoryForType(type: CashflowType, category: CashflowCategory) {
  const options = categoryOptionsForType(type);
  return options.includes(category) ? category : DEFAULT_CATEGORY_FOR_TYPE[type];
}

function resolveBillId(draft: TransactionDraft, bills: Plan["bills"]) {
  if (draft.type !== "outflow" || !isBillCategory(draft.category)) return undefined;
  if (draft.linkedBillId === null) return undefined;
  const options = bills.filter((bill) => bill.category === draft.category && bill.enabled);
  const suggested = suggestBillId(draft.label, draft.notes, options);
  const resolved = draft.linkedBillId ?? suggested;
  return resolved || undefined;
}

function resolveOutflowRuleId(draft: TransactionDraft, rules: Plan["outflowRules"]) {
  if (draft.type !== "outflow" || !isFreeTextCategory(draft.category)) return undefined;
  if (draft.linkedRuleId === null) return undefined;
  const options = rules.filter((rule) => rule.category === draft.category && rule.enabled);
  const suggested = suggestOutflowRuleId(draft.label, draft.notes, options);
  const resolved = draft.linkedRuleId ?? suggested;
  return resolved || undefined;
}

function resolveTransferRuleId(draft: TransactionDraft, rules: Plan["outflowRules"]) {
  if (draft.type !== "transfer") return undefined;
  if (draft.linkedRuleId === null) return undefined;
  const savingsRule = rules.find((rule) => rule.enabled && rule.category === "savings");
  const suggested = savingsRule?.id ?? "savings";
  const resolved = draft.linkedRuleId ?? suggested;
  return resolved || undefined;
}

/* ---------- Progress bar component ---------- */
function ProgressBar({ value, max, favorable }: { value: number; max: number; favorable: boolean }) {
  if (max <= 0) return null;
  const pct = Math.min((value / max) * 100, 100);
  const overBudget = value > max;
  const barColor = overBudget
    ? favorable
      ? "bg-emerald-500 dark:bg-emerald-400"
      : "bg-rose-500 dark:bg-rose-400"
    : "bg-blue-500 dark:bg-blue-400";
  return (
    <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- Budget vs Actual Summary ---------- */
type BudgetData = {
  budgetIncome: number; budgetSpending: number; budgetBills: number; budgetAllocations: number;
  discretionaryBudget: number; budgetSavings: number; budgetLeftover: number;
  actualIncome: number; actualSpending: number; actualSavings: number; actualLeftover: number;
  actualBudgeted: number; actualUnbudgeted: number;
  billTxns: Transaction[]; allocationTxns: Transaction[]; unbudgetedTxns: Transaction[];
  incomeTxns: Transaction[]; savingsTxns: Transaction[];
};

function BudgetVsActualSummary({ data, formatMoney: fmt }: { data: BudgetData; formatMoney: (n: number) => string }) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const cards = [
    {
      key: "income", label: "Income",
      budget: data.budgetIncome, actual: data.actualIncome,
      favorableWhenOver: true,
      breakdown: [] as { name: string; value: number }[],
      txns: data.incomeTxns,
    },
    {
      key: "spending", label: "Spending",
      budget: data.budgetSpending, actual: data.actualBudgeted,
      favorableWhenOver: false,
      breakdown: [
        { name: "Committed bills", value: data.budgetBills },
        { name: "Recurring outflows", value: data.budgetAllocations },
        ...(data.discretionaryBudget > 0 ? [{ name: "Discretionary cap", value: data.discretionaryBudget }] : []),
      ],
      txns: [...data.billTxns, ...data.allocationTxns, ...data.unbudgetedTxns],
    },
    {
      key: "savings", label: "Savings",
      budget: data.budgetSavings, actual: data.actualSavings,
      favorableWhenOver: true,
      breakdown: [] as { name: string; value: number }[],
      txns: data.savingsTxns,
    },
    {
      key: "leftover", label: "Leftover",
      budget: data.budgetLeftover, actual: data.actualLeftover,
      favorableWhenOver: true,
      breakdown: [] as { name: string; value: number }[],
      txns: [] as Transaction[],
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => {
        const delta = card.actual - card.budget;
        const favorable = card.favorableWhenOver ? delta >= 0 : delta <= 0;
        const expanded = expandedCard === card.key;
        const hasTxns = card.txns.length > 0;

        return (
          <div
            key={card.key}
            className={`rounded-2xl border bg-white/70 dark:bg-slate-800/70 p-4 shadow-sm transition-colors ${
              hasTxns ? "cursor-pointer hover:border-(--accent) dark:hover:border-(--accent)" : ""
            } ${expanded ? "border-(--accent) dark:border-(--accent)" : "border-slate-200 dark:border-slate-700"}`}
            onClick={() => hasTxns && setExpandedCard(expanded ? null : card.key)}
            role={hasTxns ? "button" : undefined}
            tabIndex={hasTxns ? 0 : undefined}
            onKeyDown={(e) => { if (hasTxns && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setExpandedCard(expanded ? null : card.key); } }}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{card.label}</div>
              {hasTxns && (
                <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Budget {fmt(card.budget)}</div>
            {card.breakdown.length > 0 && (
              <div className="mt-0.5 space-y-0">
                {card.breakdown.filter((b) => b.value > 0).map((b) => (
                  <div key={b.name} className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
                    <span>{b.name}</span>
                    <span>{fmt(b.value)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{fmt(card.actual)}</div>

            {/* Progress bar */}
            {card.budget > 0 && <ProgressBar value={card.actual} max={card.budget} favorable={card.favorableWhenOver} />}

            {delta !== 0 && (
              <div className={`mt-1 text-xs font-semibold ${favorable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {delta > 0 ? "+" : ""}{fmt(delta)}
              </div>
            )}

            {/* Unbudgeted spending callout on spending card */}
            {card.key === "spending" && data.actualUnbudgeted > 0 && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-2 py-1.5 border border-amber-200 dark:border-amber-700/50">
                <span className="text-amber-600 dark:text-amber-400 text-xs">⚠</span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">+{fmt(data.actualUnbudgeted)} unbudgeted</span>
                  <span className="text-[9px] text-amber-600/70 dark:text-amber-400/70">Total actual: {fmt(data.actualSpending)}</span>
                </div>
              </div>
            )}

            {/* Drill-down transaction list */}
            {expanded && card.txns.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1.5 max-h-48 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {card.txns.slice(0, 20).map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {card.key === "spending" && !txn.linkedBillId && !txn.linkedRuleId && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unbudgeted" />
                      )}
                      <span className="truncate text-slate-600 dark:text-slate-300">{txn.label}</span>
                    </div>
                    <span className="font-medium text-slate-800 dark:text-slate-200 ml-2 shrink-0">{fmt(txn.amount)}</span>
                  </div>
                ))}
                {card.txns.length > 20 && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center">+{card.txns.length - 20} more</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TransactionsPage() {
  const [plan, setPlan] = useState<Plan>(() => loadPlan());
  const [newTransaction, setNewTransaction] = useState<TransactionDraft>({
    date: today(),
    label: "",
    amount: "",
    type: "outflow" as CashflowType,
    category: "other" as CashflowCategory,
    notes: "",
    linkedRuleId: undefined,
    linkedBillId: undefined,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTransaction, setEditTransaction] = useState<TransactionDraft | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<CashflowType | "all">("all");
  const [filterCategory, setFilterCategory] = useState<CashflowCategory | "all">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [newCategoryTouched, setNewCategoryTouched] = useState(false);

  const [editCategoryTouched, setEditCategoryTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!newTransaction.date) newErrors.date = "Date is required";
    if (!newTransaction.label.trim()) newErrors.label = "Label is required";

    const amount = parseFloat(newTransaction.amount);
    if (!newTransaction.amount || isNaN(amount) || amount <= 0) {
      newErrors.amount = "Valid amount required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    const onFocus = () => setPlan(loadPlan());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const period = useMemo(() => {
    if (!plan) return null;
    return getPeriod(plan, plan.setup.selectedPeriodId);
  }, [plan]);

  const budgetVsActual = useMemo(() => {
    if (!plan || !period) return null;
    const events = generateEvents(plan, plan.setup.selectedPeriodId);
    const txns = plan.transactions.filter(
      (t) => t.date >= period.start && t.date <= period.end
    );
    const billIds = new Set(plan.bills.map((b) => b.id));
    const ruleIds = new Set(plan.outflowRules.map((r) => r.id));

    const budgetIncome = events.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const budgetBills = events.filter((e) => e.type === "outflow" && billIds.has(e.sourceId ?? "")).reduce((s, e) => s + e.amount, 0);
    const budgetSavings = events.filter((e) => e.type === "outflow" && e.category === "savings").reduce((s, e) => s + e.amount, 0);
    const budgetAllocations = events.filter((e) => e.type === "outflow" && !billIds.has(e.sourceId ?? "") && e.category !== "savings").reduce((s, e) => s + e.amount, 0);
    const discretionaryBudget = plan.setup.variableCap ?? 0;
    const budgetSpending = budgetBills + budgetAllocations + discretionaryBudget;
    const budgetOutflows = budgetSpending + budgetSavings;
    const budgetLeftover = budgetIncome - budgetOutflows;

    const actualIncome = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const actualSavings = txns.filter((t) => t.category === "savings").reduce((s, t) => s + t.amount, 0);
    const actualSpending = txns.filter((t) => t.type === "outflow" && t.category !== "savings").reduce((s, t) => s + t.amount, 0);

    // Split actual spending into budgeted (linked to rule/bill) and unbudgeted
    const actualBudgeted = txns.filter((t) =>
      t.type === "outflow" && t.category !== "savings" &&
      (t.linkedBillId || t.linkedRuleId)
    ).reduce((s, t) => s + t.amount, 0);
    const actualUnbudgeted = actualSpending - actualBudgeted;

    const actualLeftover = actualIncome - actualSpending - actualSavings;

    // Build drill-down lists per category
    const spendingTxns = txns.filter((t) => t.type === "outflow" && t.category !== "savings");
    const billTxns = spendingTxns.filter((t) => t.linkedBillId && billIds.has(t.linkedBillId));
    const allocationTxns = spendingTxns.filter((t) => t.linkedRuleId && ruleIds.has(t.linkedRuleId) && !t.linkedBillId);
    const unbudgetedTxns = spendingTxns.filter((t) => !t.linkedBillId && !t.linkedRuleId);
    const incomeTxns = txns.filter((t) => t.type === "income");
    const savingsTxns = txns.filter((t) => t.category === "savings");

    return {
      budgetIncome, budgetSpending, budgetBills, budgetAllocations,
      discretionaryBudget, budgetSavings, budgetLeftover,
      actualIncome, actualSpending, actualSavings, actualLeftover,
      actualBudgeted, actualUnbudgeted,
      billTxns, allocationTxns, unbudgetedTxns, incomeTxns, savingsTxns,
    };
  }, [plan, period]);

  const periodTransactions = useMemo(() => {
    if (!plan || !period) return [];
    let filtered = plan.transactions
      .filter((t) => t.date >= period.start && t.date <= period.end);

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((t) =>
        t.label.toLowerCase().includes(query) ||
        t.notes?.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    // Apply category filter
    if (filterCategory !== "all") {
      filtered = filtered.filter((t) => t.category === filterCategory);
    }

    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [plan, period, searchQuery, filterType, filterCategory]);

  const listRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: periodTransactions.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 140,
    overscan: 8,
  });

  const incomeSuggestion = useMemo(() => {
    if (!plan || newTransaction.type !== "income") return "";
    return suggestIncomeRuleId(newTransaction.label, newTransaction.notes, plan.incomeRules);
  }, [newTransaction.label, newTransaction.notes, newTransaction.type, plan]);

  const incomeSuggestionLabel = useMemo(() => {
    if (!plan || !incomeSuggestion) return "";
    return plan.incomeRules.find((rule) => rule.id === incomeSuggestion)?.label ?? "";
  }, [plan, incomeSuggestion]);

  const billOptions = useMemo(() => {
    if (!plan || newTransaction.type !== "outflow" || !isBillCategory(newTransaction.category)) return [];
    return plan.bills.filter(
      (bill) =>
        bill.category === newTransaction.category &&
        (bill.enabled || bill.id === newTransaction.linkedBillId)
    );
  }, [plan, newTransaction.type, newTransaction.category, newTransaction.linkedBillId]);

  const billSuggestion = useMemo(() => {
    if (billOptions.length === 0) return "";
    const candidates = billOptions.filter((bill) => bill.enabled);
    return suggestBillId(newTransaction.label, newTransaction.notes, candidates.length ? candidates : billOptions);
  }, [billOptions, newTransaction.label, newTransaction.notes]);

  const billSuggestionLabel = useMemo(() => {
    if (!billSuggestion) return "";
    return billOptions.find((bill) => bill.id === billSuggestion)?.label ?? "";
  }, [billOptions, billSuggestion]);

  const outflowRuleOptions = useMemo(() => {
    if (!plan || newTransaction.type !== "outflow" || !isFreeTextCategory(newTransaction.category)) return [];
    return plan.outflowRules.filter(
      (rule) =>
        rule.category === newTransaction.category &&
        (rule.enabled || rule.id === newTransaction.linkedRuleId)
    );
  }, [plan, newTransaction.type, newTransaction.category, newTransaction.linkedRuleId]);

  const outflowRuleSuggestion = useMemo(() => {
    if (outflowRuleOptions.length === 0) return "";
    const candidates = outflowRuleOptions.filter((rule) => rule.enabled);
    return suggestOutflowRuleId(
      newTransaction.label,
      newTransaction.notes,
      candidates.length ? candidates : outflowRuleOptions
    );
  }, [outflowRuleOptions, newTransaction.label, newTransaction.notes]);

  const outflowSuggestionLabel = useMemo(() => {
    if (!outflowRuleSuggestion) return "";
    return outflowRuleOptions.find((rule) => rule.id === outflowRuleSuggestion)?.label ?? "";
  }, [outflowRuleOptions, outflowRuleSuggestion]);

  const transferRuleOptions = useMemo(() => {
    if (!plan) return [];
    return plan.outflowRules.filter((rule) => rule.category === "savings" && rule.enabled);
  }, [plan]);

  const transferRuleId = useMemo(
    () => transferRuleOptions[0]?.id ?? "savings",
    [transferRuleOptions]
  );

  const transferRuleLabel = useMemo(
    () => transferRuleOptions[0]?.label ?? "Savings",
    [transferRuleOptions]
  );

  const detectedRecurringBills: DetectedBill[] = useMemo(
    () => detectRecurringBills(plan.transactions, plan.bills),
    [plan.transactions, plan.bills]
  );

  const categorySuggestion = useMemo(() => {
    if (!newTransaction.label && !newTransaction.notes) return null;
    const suggestion = suggestCategory(newTransaction.label, newTransaction.notes);
    const allowed = categoryOptionsForType(newTransaction.type);
    if (!allowed.includes(suggestion.category)) return null;
    return suggestion;
  }, [newTransaction.label, newTransaction.notes, newTransaction.type]);

  const categoryConfidenceLabel = useMemo(
    () => (categorySuggestion ? getConfidenceLabel(categorySuggestion.confidence) : ""),
    [categorySuggestion]
  );

  const shouldAutoApplyCategory = useMemo(
    () => Boolean(categorySuggestion && categorySuggestion.confidence >= AUTO_CATEGORY_CONFIDENCE),
    [categorySuggestion]
  );

  useEffect(() => {
    if (!categorySuggestion || !shouldAutoApplyCategory) return;
    if (newCategoryTouched) return;
    if (newTransaction.category === categorySuggestion.category) return;
    setNewTransaction((prev) => ({
      ...prev,
      category: categorySuggestion.category,
      linkedRuleId: prev.type === "outflow" ? undefined : prev.linkedRuleId,
      linkedBillId: undefined,
    }));
  }, [categorySuggestion, newCategoryTouched, newTransaction.category, shouldAutoApplyCategory]);

  const recurringBillSuggestion: DetectedBill | null = useMemo(() => {
    if (newTransaction.type !== "outflow" || !isBillCategory(newTransaction.category)) return null;
    if (!newTransaction.label && !newTransaction.notes) return null;
    if (billSuggestion) return null;
    const candidates = detectedRecurringBills.filter((bill) => isBillCategory(bill.suggestedCategory));
    return suggestDetectedBill(newTransaction.label, newTransaction.notes, candidates);
  }, [
    billSuggestion,
    detectedRecurringBills,
    newTransaction.category,
    newTransaction.label,
    newTransaction.notes,
    newTransaction.type,
  ]);

  const editIncomeSuggestion = useMemo(() => {
    if (!plan || !editTransaction || editTransaction.type !== "income") return "";
    return suggestIncomeRuleId(editTransaction.label, editTransaction.notes, plan.incomeRules);
  }, [editTransaction, plan]);

  const editIncomeSuggestionLabel = useMemo(() => {
    if (!plan || !editIncomeSuggestion) return "";
    return plan.incomeRules.find((rule) => rule.id === editIncomeSuggestion)?.label ?? "";
  }, [plan, editIncomeSuggestion]);

  const editBillOptions = useMemo(() => {
    if (!plan || !editTransaction || editTransaction.type !== "outflow" || !isBillCategory(editTransaction.category)) {
      return [];
    }
    return plan.bills.filter(
      (bill) =>
        bill.category === editTransaction.category &&
        (bill.enabled || bill.id === editTransaction.linkedBillId)
    );
  }, [plan, editTransaction]);

  const editBillSuggestion = useMemo(() => {
    if (editBillOptions.length === 0 || !editTransaction) return "";
    const candidates = editBillOptions.filter((bill) => bill.enabled);
    return suggestBillId(editTransaction.label, editTransaction.notes, candidates.length ? candidates : editBillOptions);
  }, [editBillOptions, editTransaction]);

  const editBillSuggestionLabel = useMemo(() => {
    if (!editBillSuggestion) return "";
    return editBillOptions.find((bill) => bill.id === editBillSuggestion)?.label ?? "";
  }, [editBillOptions, editBillSuggestion]);

  const editCategorySuggestion = useMemo(() => {
    if (!editTransaction) return null;
    if (!editTransaction.label && !editTransaction.notes) return null;
    const suggestion = suggestCategory(editTransaction.label, editTransaction.notes);
    const allowed = categoryOptionsForType(editTransaction.type);
    if (!allowed.includes(suggestion.category)) return null;
    return suggestion;
  }, [editTransaction]);

  const editCategoryConfidenceLabel = useMemo(
    () => (editCategorySuggestion ? getConfidenceLabel(editCategorySuggestion.confidence) : ""),
    [editCategorySuggestion]
  );

  const shouldAutoApplyEditCategory = useMemo(
    () => Boolean(editCategorySuggestion && editCategorySuggestion.confidence >= AUTO_CATEGORY_CONFIDENCE),
    [editCategorySuggestion]
  );

  useEffect(() => {
    if (!editTransaction || !editCategorySuggestion || !shouldAutoApplyEditCategory) return;
    if (editCategoryTouched) return;
    if (editTransaction.category === editCategorySuggestion.category) return;
    setEditTransaction((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        category: editCategorySuggestion.category,
        linkedRuleId: prev.type === "outflow" ? undefined : prev.linkedRuleId,
        linkedBillId: undefined,
      };
    });
  }, [editCategorySuggestion, editCategoryTouched, editTransaction, shouldAutoApplyEditCategory]);

  const editRecurringBillSuggestion = useMemo(() => {
    if (!editTransaction) return null;
    if (editTransaction.type !== "outflow" || !isBillCategory(editTransaction.category)) return null;
    if (!editTransaction.label && !editTransaction.notes) return null;
    if (editBillSuggestion) return null;
    const candidates = detectedRecurringBills.filter((bill) => isBillCategory(bill.suggestedCategory));
    return suggestDetectedBill(editTransaction.label, editTransaction.notes, candidates);
  }, [detectedRecurringBills, editBillSuggestion, editTransaction]);

  const editOutflowRuleOptions = useMemo(() => {
    if (!plan || !editTransaction || editTransaction.type !== "outflow" || !isFreeTextCategory(editTransaction.category)) {
      return [];
    }
    return plan.outflowRules.filter(
      (rule) =>
        rule.category === editTransaction.category &&
        (rule.enabled || rule.id === editTransaction.linkedRuleId)
    );
  }, [plan, editTransaction]);

  const editOutflowRuleSuggestion = useMemo(() => {
    if (editOutflowRuleOptions.length === 0 || !editTransaction) return "";
    const candidates = editOutflowRuleOptions.filter((rule) => rule.enabled);
    return suggestOutflowRuleId(
      editTransaction.label,
      editTransaction.notes,
      candidates.length ? candidates : editOutflowRuleOptions
    );
  }, [editOutflowRuleOptions, editTransaction]);

  const editOutflowSuggestionLabel = useMemo(() => {
    if (!editOutflowRuleSuggestion) return "";
    return editOutflowRuleOptions.find((rule) => rule.id === editOutflowRuleSuggestion)?.label ?? "";
  }, [editOutflowRuleOptions, editOutflowRuleSuggestion]);

  function ensureBillFromDraft(draft: TransactionDraft, detected?: DetectedBill) {
    if (!plan) return null;
    if (draft.type !== "outflow" || !isBillCategory(draft.category)) return null;
    const label = (detected?.merchantName ?? draft.label ?? "").trim();
    if (!label) {
      showToast("Add a label to create a bill", "error");
      return null;
    }

    const amountValue = detected?.averageAmount ?? parseFloat(draft.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      showToast("Enter a valid amount to create a bill", "error");
      return null;
    }

    const dateParts = draft.date?.split("-") ?? [];
    const fallbackDueDay = Number(dateParts[2]);
    const rawDueDay = detected?.suggestedDueDay ?? fallbackDueDay;
    const safeDueDay = Number.isFinite(rawDueDay)
      ? Math.min(31, Math.max(1, Math.round(rawDueDay)))
      : 1;

    const detectedCategory = detected?.suggestedCategory ?? draft.category;
    const category = isBillCategory(detectedCategory) ? detectedCategory : "bill";

    const existing = findExistingBillByLabel(label, plan.bills);
    const matched = existing && existing.category === category ? existing : undefined;
    const bill = matched ?? {
      id: makeUniqueBillId(label, plan.bills),
      label,
      amount: amountValue,
      dueDay: safeDueDay,
      category,
      enabled: true,
    };
    const nextPlan = matched ? plan : { ...plan, bills: [...plan.bills, bill] };
    return { bill, created: !matched, nextPlan };
  }

  function saveUpdatedTransaction(
    id: string,
    draft: TransactionDraft,
    toastLabel = "Transaction updated successfully",
    planOverride?: Plan
  ) {
    const currentPlan = planOverride ?? plan;
    if (!currentPlan) return false;
    if (!draft.label || !draft.amount) return false;
    const amount = parseFloat(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) return false;

    const normalizedDraft = {
      ...draft,
      category: normalizeCategoryForType(draft.type, draft.category),
    };

    const linkedIncomeId = resolveIncomeRuleId(normalizedDraft, currentPlan.incomeRules);
    const linkedBillId = resolveBillId(normalizedDraft, currentPlan.bills);
    const linkedOutflowRuleId = resolveOutflowRuleId(normalizedDraft, currentPlan.outflowRules);
    const linkedTransferRuleId = resolveTransferRuleId(normalizedDraft, currentPlan.outflowRules);

    const updated = {
      ...currentPlan,
      transactions: currentPlan.transactions.map((t) => {
        if (t.id !== id) return t;
        let linkedRuleId: string | undefined;
        if (normalizedDraft.type === "income") {
          linkedRuleId = linkedIncomeId;
        } else if (normalizedDraft.type === "transfer") {
          linkedRuleId = linkedTransferRuleId;
        } else {
          linkedRuleId = linkedOutflowRuleId;
        }
        return {
          ...t,
          date: normalizedDraft.date,
          label: normalizedDraft.label,
          amount: amount,
          type: normalizedDraft.type,
          category: normalizedDraft.category,
          notes: normalizedDraft.notes || undefined,
          linkedRuleId,
          linkedBillId,
        };
      }),
    };

    savePlan(updated);
    setPlan(updated);
    showToast(toastLabel, "success");
    return true;
  }

  function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const currentPlan = loadPlan();
    if (!currentPlan) return;

    const amount = parseFloat(newTransaction.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const draft = {
      ...newTransaction,
      category: normalizeCategoryForType(newTransaction.type, newTransaction.category),
    };

    const linkedIncomeId = resolveIncomeRuleId(draft, currentPlan.incomeRules);
    const linkedBillId = resolveBillId(draft, currentPlan.bills);
    const linkedOutflowRuleId = resolveOutflowRuleId(draft, currentPlan.outflowRules);
    const linkedTransferRuleId = resolveTransferRuleId(draft, currentPlan.outflowRules);

    let linkedRuleId: string | undefined;
    if (draft.type === "income") {
      linkedRuleId = linkedIncomeId;
    } else if (draft.type === "transfer") {
      linkedRuleId = linkedTransferRuleId;
    } else {
      linkedRuleId = linkedOutflowRuleId;
    }

    const transaction: Transaction = {
      id: makeId(),
      date: draft.date,
      label: draft.label,
      amount: amount,
      type: draft.type,
      category: draft.category,
      notes: draft.notes || undefined,
      linkedRuleId,
      linkedBillId,
    };

    const updated = {
      ...currentPlan,
      transactions: [...currentPlan.transactions, transaction],
    };

    savePlan(updated);
    setPlan(updated);
    showToast("Transaction added successfully", "success");

    setNewTransaction({
      date: today(),
      label: "",
      amount: "",
      type: "outflow",
      category: "other",
      notes: "",
      linkedRuleId: undefined,
      linkedBillId: undefined,
    });
    setNewCategoryTouched(false);
    setErrors({});
  }

  function handleDeleteTransaction(id: string) {
    if (!plan) return;
    const updated = {
      ...plan,
      transactions: plan.transactions.filter((t) => t.id !== id),
    };
    savePlan(updated);
    setPlan(updated);
    showToast("Transaction deleted", "success");
  }

  function handleEditTransaction(txn: Transaction) {
    setEditingId(txn.id);
    setEditTransaction({
      date: txn.date,
      label: txn.label,
      amount: String(txn.amount),
      type: txn.type,
      category: normalizeCategoryForType(txn.type, txn.category),
      notes: txn.notes ?? "",
      linkedRuleId: txn.linkedRuleId,
      linkedBillId: txn.linkedBillId,
    });
    setEditCategoryTouched(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTransaction(null);
    setEditCategoryTouched(false);
    setErrors({});
  }

  function handleUpdateTransaction(id: string, overrideDraft?: TransactionDraft) {
    const draft = overrideDraft ?? editTransaction;
    if (!draft) return;
    const updated = saveUpdatedTransaction(id, draft);
    if (updated) {
      cancelEdit();
    }
  }

  function handleCreateBillForNewTransaction() {
    const result = ensureBillFromDraft(newTransaction, recurringBillSuggestion ?? undefined);
    if (!result) return;
    if (result.created) {
      savePlan(result.nextPlan);
      setPlan(result.nextPlan);
    }
    const message = result.created
      ? `Bill created: ${result.bill.label}`
      : `Bill already exists: ${result.bill.label}`;
    showToast(message, "success");
    setNewTransaction((prev) => ({
      ...prev,
      category: result.bill.category,
      linkedBillId: result.bill.id,
    }));
  }

  function handleCreateBillForEditTransaction() {
    if (!editTransaction || !editingId) return;
    const result = ensureBillFromDraft(editTransaction, editRecurringBillSuggestion ?? undefined);
    if (!result) return;
    const nextDraft = {
      ...editTransaction,
      category: result.bill.category,
      linkedBillId: result.bill.id,
    };
    const toastLabel = result.created
      ? `Bill created and linked: ${result.bill.label}`
      : `Bill linked: ${result.bill.label}`;
    const updated = saveUpdatedTransaction(editingId, nextDraft, toastLabel, result.nextPlan);
    if (updated) {
      cancelEdit();
    }
  }

  function toggleSelectAll() {
    if (selectedIds.size === periodTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(periodTransactions.map((t) => t.id)));
    }
  }

  function toggleSelect(id: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }

  function handleBulkDelete() {
    if (!plan || selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected transaction(s)?`)) return;

    const updated = {
      ...plan,
      transactions: plan.transactions.filter((t) => !selectedIds.has(t.id)),
    };
    savePlan(updated);
    setPlan(updated);
    showToast(`Deleted ${selectedIds.size} transaction(s)`, "success");
    setSelectedIds(new Set());
    setBulkMode(false);
  }

  function handleBulkExport() {
    if (!period) return;
    const selected = periodTransactions.filter((t) => selectedIds.has(t.id));
    exportToCSV(selected, `${period.label}-selected`);
    showToast(`Exported ${selected.length} transaction(s) to CSV`, "success");
  }

  if (!period) {
    return <div className="px-6 py-10 text-slate-500 dark:text-slate-400">Loading...</div>;
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-5 pb-28 pt-6">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <SidebarNav periodLabel={period.label} periodStart={period.start} periodEnd={period.end} />
          <section className="space-y-6">
            <div className="vn-card p-6">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Transactions</div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Transactions</h1>
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Add what really happened.</div>
            </div>

            {/* Add Transaction Form */}
            <div className="vn-card p-6">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">Add transaction</div>
              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Date</label>
                    <input
                      type="date"
                      value={newTransaction.date}
                      onChange={(e) =>
                        setNewTransaction({ ...newTransaction, date: e.target.value })
                      }
                      className={`mt-1 w-full rounded-lg border bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)] ${errors.date ? "border-red-500 ring-1 ring-red-500" : "border-slate-200 dark:border-slate-700"
                        }`}
                    />
                    <FormError message={errors.date} />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Label</label>
                    <input
                      type="text"
                      placeholder="e.g., Grocery shopping"
                      value={newTransaction.label}
                      onChange={(e) =>
                        setNewTransaction({ ...newTransaction, label: e.target.value })
                      }
                      className={`mt-1 w-full rounded-lg border bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[var(--accent)] ${errors.label ? "border-red-500 ring-1 ring-red-500" : "border-slate-200 dark:border-slate-700"
                        }`}
                    />
                    <FormError message={errors.label} />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Amount ({getCurrency()})</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      value={newTransaction.amount}
                      onChange={(e) =>
                        setNewTransaction({ ...newTransaction, amount: e.target.value })
                      }
                      className={`mt-1 w-full rounded-lg border bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[var(--accent)] ${errors.amount ? "border-red-500 ring-1 ring-red-500" : "border-slate-200 dark:border-slate-700"
                        }`}
                    />
                    <FormError message={errors.amount} />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Type</label>
                    <select
                      value={newTransaction.type}
                      onChange={(e) => {
                        const nextType = e.target.value as CashflowType;
                        const nextCategory = normalizeCategoryForType(nextType, newTransaction.category);
                        setNewTransaction({
                          ...newTransaction,
                          type: nextType,
                          category: nextCategory,
                          linkedRuleId: undefined,
                          linkedBillId: undefined,
                        });
                        setNewCategoryTouched(false);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                    >
                      <option value="income">Income</option>
                      <option value="outflow">Outflow</option>
                      <option value="transfer">Transfer (to savings)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Category</label>
                    <select
                      value={newTransaction.category}
                      onChange={(e) => {
                        const nextCategory = e.target.value as CashflowCategory;
                        setNewTransaction({
                          ...newTransaction,
                          category: nextCategory,
                          linkedRuleId: newTransaction.type === "outflow" ? undefined : newTransaction.linkedRuleId,
                          linkedBillId: undefined,
                        });
                        setNewCategoryTouched(true);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                    >
                      {categoryOptionsForType(newTransaction.type).map((category) => (
                        <option key={category} value={category}>
                          {formatCategoryLabel(category)}
                        </option>
                      ))}
                    </select>
                    {categorySuggestion ? (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {shouldAutoApplyCategory ? "Auto-categorized" : "Suggested"}:{" "}
                        {formatCategoryLabel(categorySuggestion.category)}{" "}
                        {categoryConfidenceLabel ? `(${categoryConfidenceLabel} confidence)` : ""}
                        {!newCategoryTouched && shouldAutoApplyCategory ? " (auto-selected)" : ""}
                      </p>
                    ) : null}
                  </div>

                  {newTransaction.type === "income" ? (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Income source</label>
                      <select
                        value={resolveSuggestedId(newTransaction.linkedRuleId, incomeSuggestion)}
                        onChange={(e) =>
                          setNewTransaction({
                            ...newTransaction,
                            linkedRuleId: e.target.value ? e.target.value : null,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                      >
                        <option value="">Unassigned</option>
                        {plan.incomeRules
                          .filter((rule) => rule.enabled || rule.id === newTransaction.linkedRuleId)
                          .map((rule) => (
                            <option key={rule.id} value={rule.id}>
                              {rule.label}
                            </option>
                          ))}
                      </select>
                      {incomeSuggestionLabel ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Suggested: {incomeSuggestionLabel}
                          {newTransaction.linkedRuleId === undefined ? " (auto-selected)" : ""}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {newTransaction.type === "transfer" ? (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Savings target</label>
                      <select
                        value={resolveSuggestedId(newTransaction.linkedRuleId, transferRuleId)}
                        onChange={(e) =>
                          setNewTransaction({
                            ...newTransaction,
                            linkedRuleId: e.target.value ? e.target.value : null,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                      >
                        <option value="">Unassigned</option>
                        {transferRuleOptions.length === 0 ? (
                          <option value={transferRuleId}>{transferRuleLabel}</option>
                        ) : (
                          transferRuleOptions.map((rule) => (
                            <option key={rule.id} value={rule.id}>
                              {rule.label}
                            </option>
                          ))
                        )}
                      </select>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Suggested: {transferRuleLabel}
                        {newTransaction.linkedRuleId === undefined ? " (auto-selected)" : ""}
                      </p>
                    </div>
                  ) : null}

                  {newTransaction.type === "outflow" && isBillCategory(newTransaction.category) ? (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {newTransaction.category === "giving" ? "Giving target" : "Bill"}
                      </label>
                      <select
                        value={resolveSuggestedId(newTransaction.linkedBillId, billSuggestion)}
                        onChange={(e) =>
                          setNewTransaction({
                            ...newTransaction,
                            linkedBillId: e.target.value ? e.target.value : null,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                      >
                        <option value="">Unassigned</option>
                        {billOptions.map((bill) => (
                          <option key={bill.id} value={bill.id}>
                            {bill.label}
                          </option>
                        ))}
                      </select>
                      {billSuggestionLabel ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          This looks like your {billSuggestionLabel}{" "}
                          {newTransaction.category === "giving" ? "giving" : "payment"}.
                          {newTransaction.linkedBillId === undefined ? " (auto-selected)" : ""}
                        </p>
                      ) : null}
                      {!billSuggestionLabel && recurringBillSuggestion ? (
                        <div className="mt-2 rounded-lg border border-indigo-100 dark:border-indigo-400/40 bg-indigo-50/70 dark:bg-indigo-900/20 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                          <div className="font-semibold text-slate-700 dark:text-slate-200">Recurring pattern detected</div>
                          <div className="mt-1 text-slate-500 dark:text-slate-400">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {(recurringBillSuggestion as any).merchantName} | {formatMoney((recurringBillSuggestion as any).averageAmount)} |{" "}
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {formatFrequencyLabel((recurringBillSuggestion as any).frequency)} | Day{" "}
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {(recurringBillSuggestion as any).suggestedDueDay}
                          </div>
                          <button
                            type="button"
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onClick={handleCreateBillForNewTransaction as any}
                            className="mt-2 inline-flex items-center rounded-md border border-indigo-200 dark:border-indigo-400/40 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs min-h-9 font-semibold text-indigo-600 dark:text-indigo-300 hover:border-indigo-300 hover:text-indigo-700 dark:hover:border-indigo-300"
                          >
                            Create bill
                          </button>
                        </div>
                      ) : null}
                      {!billSuggestionLabel && !recurringBillSuggestion ? (
                        <button
                          type="button"
                          onClick={handleCreateBillForNewTransaction}
                          className="mt-2 inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs min-h-9 font-semibold text-slate-600 dark:text-slate-300 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        >
                          Create bill from this transaction
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {newTransaction.type === "outflow" &&
                    isFreeTextCategory(newTransaction.category) &&
                    outflowRuleOptions.length > 0 ? (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Outflow rule (optional)</label>
                      <select
                        value={resolveSuggestedId(newTransaction.linkedRuleId, outflowRuleSuggestion)}
                        onChange={(e) =>
                          setNewTransaction({
                            ...newTransaction,
                            linkedRuleId: e.target.value ? e.target.value : null,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                      >
                        <option value="">Unassigned</option>
                        {outflowRuleOptions.map((rule) => (
                          <option key={rule.id} value={rule.id}>
                            {rule.label}
                          </option>
                        ))}
                      </select>
                      {outflowSuggestionLabel ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Suggested: {outflowSuggestionLabel}
                          {newTransaction.linkedRuleId === undefined ? " (auto-selected)" : ""}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {newTransaction.type === "outflow" && isFreeTextCategory(newTransaction.category)
                        ? "Details (free text)"
                        : "Notes (optional)"}
                    </label>
                    <input
                      type="text"
                      placeholder="Add notes"
                      value={newTransaction.notes}
                      onChange={(e) =>
                        setNewTransaction({ ...newTransaction, notes: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full vn-btn vn-btn-primary text-sm hover:bg-[var(--accent-deep)]"
                  aria-label="Add new transaction"
                >
                  Add transaction
                </button>
              </form>
            </div>

            {/* Budget vs Actual Summary */}
            {budgetVsActual && (
              <BudgetVsActualSummary data={budgetVsActual} formatMoney={formatMoney} />
            )}

            {/* Transactions List */}
            <div className="vn-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Transactions ({periodTransactions.length})
                  {bulkMode && selectedIds.size > 0 && (
                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                      ({selectedIds.size} selected)
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!bulkMode ? (
                    <>
                      <button
                        onClick={() => setBulkMode(true)}
                        className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs min-h-10 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={periodTransactions.length === 0}
                        aria-label="Enable bulk selection mode"
                      >
                        Select
                      </button>
                      <button
                        onClick={() => exportToCSV(periodTransactions, period.label)}
                        className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs min-h-10 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={periodTransactions.length === 0}
                        aria-label="Export transactions to CSV"
                      >
                        CSV
                      </button>
                      <button
                        onClick={() => exportToExcel(periodTransactions, period.label)}
                        className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs min-h-10 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={periodTransactions.length === 0}
                        aria-label="Export transactions to Excel"
                      >
                        Excel
                      </button>
                      <button
                        onClick={() => exportToPDF(periodTransactions, period.label, period.start, period.end)}
                        className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs min-h-10 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={periodTransactions.length === 0}
                        aria-label="Export transactions to PDF"
                      >
                        PDF
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleBulkExport}
                        className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs min-h-10 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={selectedIds.size === 0}
                      >
                        Export Selected
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        className="rounded-lg bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-500/40 px-3 py-1.5 text-xs min-h-10 font-semibold text-rose-700 dark:text-rose-200 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={selectedIds.size === 0}
                      >
                        Delete Selected
                      </button>
                      <button
                        onClick={() => {
                          setBulkMode(false);
                          setSelectedIds(new Set());
                        }}
                        className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs min-h-10 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Search and Filters */}
              <div className="mb-4 space-y-3">
                {bulkMode && periodTransactions.length > 0 && (
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === periodTransactions.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                    <label className="text-sm text-slate-600 dark:text-slate-300">
                      Select all ({periodTransactions.length})
                    </label>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[var(--accent)]"
                  />
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as CashflowType | "all")}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="all">All types</option>
                    <option value="income">Income</option>
                    <option value="outflow">Outflow</option>
                    <option value="transfer">Transfer</option>
                  </select>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value as CashflowCategory | "all")}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="all">All categories</option>
                    <option value="income">Income</option>
                    <option value="bill">Bill</option>
                    <option value="giving">Giving</option>
                    <option value="allowance">Allowance</option>
                    <option value="buffer">Buffer</option>
                    <option value="savings">Savings</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {periodTransactions.length === 0 ? (
                <div className="mt-4 rounded-xl bg-white/70 dark:bg-slate-800/70 p-8">
                  <EmptyState
                    icon={searchQuery || filterType !== "all" || filterCategory !== "all" ? "🔍" : "📝"}
                    title={searchQuery || filterType !== "all" || filterCategory !== "all" ? "No matching transactions" : "No transactions yet"}
                    description={
                      searchQuery || filterType !== "all" || filterCategory !== "all"
                        ? "Try adjusting your search or filters to find what you're looking for."
                        : "Start by adding your first transaction above, or sync from your bank account."
                    }
                    action={
                      searchQuery || filterType !== "all" || filterCategory !== "all"
                        ? {
                          label: "Clear filters",
                          onClick: () => {
                            setSearchQuery("");
                            setFilterType("all");
                            setFilterCategory("all");
                          },
                        }
                        : undefined
                    }
                  />
                </div>
              ) : (
                <div className="mt-4">
                  <div
                    ref={listRef}
                    className="max-h-[65vh] overflow-auto pr-2"
                  >
                    <div
                      className="relative w-full"
                      style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                    >
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const txn = periodTransactions[virtualRow.index];
                        if (!txn) return null;
                        return (
                          <div
                            key={txn.id}
                            data-index={virtualRow.index}
                            ref={rowVirtualizer.measureElement}
                            className="absolute left-0 top-0 w-full"
                            style={{ transform: `translateY(${virtualRow.start}px)` }}
                          >
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-4 flex flex-wrap items-center justify-between gap-3">
                              {bulkMode && (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(txn.id)}
                                  onChange={() => toggleSelect(txn.id)}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                              {editingId === txn.id && editTransaction ? (
                                <div className="w-full space-y-3">
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Date</label>
                                      <input
                                        type="date"
                                        value={editTransaction.date}
                                        onChange={(e) =>
                                          setEditTransaction({ ...editTransaction, date: e.target.value })
                                        }
                                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Label</label>
                                      <input
                                        type="text"
                                        value={editTransaction.label}
                                        onChange={(e) =>
                                          setEditTransaction({ ...editTransaction, label: e.target.value })
                                        }
                                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Amount ({getCurrency()})</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editTransaction.amount}
                                        onChange={(e) =>
                                          setEditTransaction({ ...editTransaction, amount: e.target.value })
                                        }
                                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Type</label>
                                      <select
                                        value={editTransaction.type}
                                        onChange={(e) => {
                                          const nextType = e.target.value as CashflowType;
                                          const nextCategory = normalizeCategoryForType(nextType, editTransaction.category);
                                          setEditTransaction({
                                            ...editTransaction,
                                            type: nextType,
                                            category: nextCategory,
                                            linkedRuleId: undefined,
                                            linkedBillId: undefined,
                                          });
                                          setEditCategoryTouched(false);
                                        }}
                                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                                      >
                                        <option value="income">Income</option>
                                        <option value="outflow">Outflow</option>
                                        <option value="transfer">Transfer (to savings)</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Category</label>
                                      <select
                                        value={editTransaction.category}
                                        onChange={(e) => {
                                          const nextCategory = e.target.value as CashflowCategory;
                                          setEditTransaction({
                                            ...editTransaction,
                                            category: nextCategory,
                                            linkedRuleId: editTransaction.type === "outflow" ? undefined : editTransaction.linkedRuleId,
                                            linkedBillId: undefined,
                                          });
                                          setEditCategoryTouched(true);
                                        }}
                                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                                      >
                                        {categoryOptionsForType(editTransaction.type).map((category) => (
                                          <option key={category} value={category}>
                                            {formatCategoryLabel(category)}
                                          </option>
                                        ))}
                                      </select>
                                      {editCategorySuggestion ? (
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                          {shouldAutoApplyEditCategory ? "Auto-categorized" : "Suggested"}:{" "}
                                          {formatCategoryLabel(editCategorySuggestion.category)}{" "}
                                          {editCategoryConfidenceLabel ? `(${editCategoryConfidenceLabel} confidence)` : ""}
                                          {!editCategoryTouched && shouldAutoApplyEditCategory ? " (auto-selected)" : ""}
                                        </p>
                                      ) : null}
                                    </div>
                                    {editTransaction.type === "income" ? (
                                      <div>
                                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Income source</label>
                                        <select
                                          value={resolveSuggestedId(editTransaction.linkedRuleId, editIncomeSuggestion)}
                                          onChange={(e) =>
                                            setEditTransaction({
                                              ...editTransaction,
                                              linkedRuleId: e.target.value ? e.target.value : null,
                                            })
                                          }
                                          className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                                        >
                                          <option value="">Unassigned</option>
                                          {plan.incomeRules
                                            .filter((rule) => rule.enabled || rule.id === editTransaction.linkedRuleId)
                                            .map((rule) => (
                                              <option key={rule.id} value={rule.id}>
                                                {rule.label}
                                              </option>
                                            ))}
                                        </select>
                                        {editIncomeSuggestionLabel ? (
                                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Suggested: {editIncomeSuggestionLabel}
                                            {editTransaction.linkedRuleId === undefined ? " (auto-selected)" : ""}
                                          </p>
                                        ) : null}
                                      </div>
                                    ) : null}

                                    {editTransaction.type === "transfer" ? (
                                      <div>
                                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Savings target</label>
                                        <select
                                          value={resolveSuggestedId(editTransaction.linkedRuleId, transferRuleId)}
                                          onChange={(e) =>
                                            setEditTransaction({
                                              ...editTransaction,
                                              linkedRuleId: e.target.value ? e.target.value : null,
                                            })
                                          }
                                          className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                                        >
                                          <option value="">Unassigned</option>
                                          {transferRuleOptions.length === 0 ? (
                                            <option value={transferRuleId}>{transferRuleLabel}</option>
                                          ) : (
                                            transferRuleOptions.map((rule) => (
                                              <option key={rule.id} value={rule.id}>
                                                {rule.label}
                                              </option>
                                            ))
                                          )}
                                        </select>
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                          Suggested: {transferRuleLabel}
                                          {editTransaction.linkedRuleId === undefined ? " (auto-selected)" : ""}
                                        </p>
                                      </div>
                                    ) : null}

                                    {editTransaction.type === "outflow" && isBillCategory(editTransaction.category) ? (
                                      <div>
                                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                          {editTransaction.category === "giving" ? "Giving target" : "Bill"}
                                        </label>
                                        <select
                                          value={resolveSuggestedId(editTransaction.linkedBillId, editBillSuggestion)}
                                          onChange={(e) =>
                                            setEditTransaction({
                                              ...editTransaction,
                                              linkedBillId: e.target.value ? e.target.value : null,
                                            })
                                          }
                                          className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                                        >
                                          <option value="">Unassigned</option>
                                          {editBillOptions.map((bill) => (
                                            <option key={bill.id} value={bill.id}>
                                              {bill.label}
                                            </option>
                                          ))}
                                        </select>
                                        {editBillSuggestionLabel ? (
                                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            This looks like your {editBillSuggestionLabel}{" "}
                                            {editTransaction.category === "giving" ? "giving" : "payment"}.
                                            {editTransaction.linkedBillId === undefined ? " (auto-selected)" : ""}
                                          </p>
                                        ) : null}
                                        {!editBillSuggestionLabel && editRecurringBillSuggestion ? (
                                          <div className="mt-2 rounded-lg border border-indigo-100 dark:border-indigo-400/40 bg-indigo-50/70 dark:bg-indigo-900/20 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                                            <div className="font-semibold text-slate-700 dark:text-slate-200">Recurring pattern detected</div>
                                            <div className="mt-1 text-slate-500 dark:text-slate-400">
                                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                              {(editRecurringBillSuggestion as any).merchantName} | {formatMoney((editRecurringBillSuggestion as any).averageAmount)} |{" "}
                                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                              {formatFrequencyLabel((editRecurringBillSuggestion as any).frequency)} | Day{" "}
                                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                              {(editRecurringBillSuggestion as any).suggestedDueDay}
                                            </div>
                                            <button
                                              type="button"
                                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                              onClick={handleCreateBillForEditTransaction as any}
                                              className="mt-2 inline-flex items-center rounded-md border border-indigo-200 dark:border-indigo-400/40 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs min-h-9 font-semibold text-indigo-600 dark:text-indigo-300 hover:border-indigo-300 hover:text-indigo-700 dark:hover:border-indigo-300"
                                            >
                                              Create bill
                                            </button>
                                          </div>
                                        ) : null}
                                        {!editBillSuggestionLabel && !editRecurringBillSuggestion ? (
                                          <button
                                            type="button"
                                            onClick={handleCreateBillForEditTransaction}
                                            className="mt-2 inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs min-h-9 font-semibold text-slate-600 dark:text-slate-300 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                          >
                                            Create bill from this transaction
                                          </button>
                                        ) : null}
                                      </div>
                                    ) : null}

                                    {editTransaction.type === "outflow" &&
                                      isFreeTextCategory(editTransaction.category) &&
                                      editOutflowRuleOptions.length > 0 ? (
                                      <div>
                                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Outflow rule (optional)</label>
                                        <select
                                          value={resolveSuggestedId(editTransaction.linkedRuleId, editOutflowRuleSuggestion)}
                                          onChange={(e) =>
                                            setEditTransaction({
                                              ...editTransaction,
                                              linkedRuleId: e.target.value ? e.target.value : null,
                                            })
                                          }
                                          className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                                        >
                                          <option value="">Unassigned</option>
                                          {editOutflowRuleOptions.map((rule) => (
                                            <option key={rule.id} value={rule.id}>
                                              {rule.label}
                                            </option>
                                          ))}
                                        </select>
                                        {editOutflowSuggestionLabel ? (
                                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Suggested: {editOutflowSuggestionLabel}
                                            {editTransaction.linkedRuleId === undefined ? " (auto-selected)" : ""}
                                          </p>
                                        ) : null}
                                      </div>
                                    ) : null}

                                    <div>
                                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        {editTransaction.type === "outflow" && isFreeTextCategory(editTransaction.category)
                                          ? "Details (free text)"
                                          : "Notes (optional)"}
                                      </label>
                                      <input
                                        type="text"
                                        value={editTransaction.notes}
                                        onChange={(e) =>
                                          setEditTransaction({ ...editTransaction, notes: e.target.value })
                                        }
                                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[var(--accent)]"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleUpdateTransaction(txn.id)}
                                      className="vn-btn vn-btn-primary text-xs hover:bg-[var(--accent-deep)]"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                                    <MerchantLogo merchantName={txn.label} size="sm" />
                                    <div>
                                      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                                        {txn.label}
                                        {txn.type === "outflow" && txn.category !== "savings" && !txn.linkedBillId && !txn.linkedRuleId && (
                                          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Unbudgeted spending" />
                                        )}
                                      </div>
                                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                        <span>{formatNice(txn.date)}</span>
                                        <span className="text-slate-300">|</span>
                                        <span className="capitalize">{txn.category}</span>
                                        {txn.notes && (
                                          <>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-slate-500 dark:text-slate-400">{txn.notes}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div
                                      className={`text-right ${txn.type === "income"
                                        ? "text-green-600"
                                        : txn.type === "transfer"
                                          ? "text-sky-600"
                                          : "text-rose-600"
                                        }`}
                                    >
                                      <div className="text-sm font-semibold">
                                        {txn.type === "income" ? "+" : txn.type === "transfer" ? "T" : "-"}
                                        {formatMoney(txn.amount)}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleEditTransaction(txn)}
                                      className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 transition-colors"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTransaction(txn.id)}
                                      className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

    </main>
  );
}


