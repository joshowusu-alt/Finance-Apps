"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { loadPlan, savePlan } from "@/lib/storage";
import { getPeriod, getVarianceByCategory, getSavingsTransferReconciliation } from "@/lib/cashflowEngine";
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

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

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

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function splitTokens(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
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

  const variance = useMemo(() => {
    if (!plan) return {};
    return getVarianceByCategory(plan, plan.setup.selectedPeriodId);
  }, [plan]);

  const savingsReconciliation = useMemo(() => {
    if (!plan) return null;
    return getSavingsTransferReconciliation(plan, plan.setup.selectedPeriodId);
  }, [plan]);

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
              <h1 className="text-2xl font-semibold text-slate-900">Transactions</h1>
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Add what really happened.</div>
            </div>

            {/* Add Transaction Form */}
            <div className="vn-card p-6">
              <div className="text-sm font-semibold text-slate-800 mb-4">Add transaction</div>
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
                      className={`mt-1 w-full rounded-lg border bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)] ${errors.date ? "border-red-500 ring-1 ring-red-500" : "border-slate-200"
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
                      className={`mt-1 w-full rounded-lg border bg-white/80 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[var(--accent)] ${errors.label ? "border-red-500 ring-1 ring-red-500" : "border-slate-200"
                        }`}
                    />
                    <FormError message={errors.label} />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Amount (GBP)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      value={newTransaction.amount}
                      onChange={(e) =>
                        setNewTransaction({ ...newTransaction, amount: e.target.value })
                      }
                      className={`mt-1 w-full rounded-lg border bg-white/80 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[var(--accent)] ${errors.amount ? "border-red-500 ring-1 ring-red-500" : "border-slate-200"
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
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                        <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs text-slate-600">
                          <div className="font-semibold text-slate-700">Recurring pattern detected</div>
                          <div className="mt-1 text-slate-500">
                            {(recurringBillSuggestion as any).merchantName} | {gbp((recurringBillSuggestion as any).averageAmount)} |{" "}
                            {formatFrequencyLabel((recurringBillSuggestion as any).frequency)} | Day{" "}
                            {(recurringBillSuggestion as any).suggestedDueDay}
                          </div>
                          <button
                            type="button"
                            onClick={handleCreateBillForNewTransaction as any}
                            className="mt-2 inline-flex items-center rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:border-indigo-300 hover:text-indigo-700"
                          >
                            Create bill
                          </button>
                        </div>
                      ) : null}
                      {!billSuggestionLabel && !recurringBillSuggestion ? (
                        <button
                          type="button"
                          onClick={handleCreateBillForNewTransaction}
                          className="mt-2 inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[var(--accent)]"
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

            {/* Variance Summary */}
            <div className="vn-card p-6">
              <div className="text-sm font-semibold text-slate-800">Variance by category</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Object.values(variance)
                  .filter((v) => v)
                  .map((v) => {
                    if (!v) return null;
                    const isIncome = v.category === "income";
                    const overBudget = v.actual > v.budgeted;
                    const statusColor =
                      v.status === "over"
                        ? "border-rose-200 bg-rose-50"
                        : v.status === "under"
                          ? "border-amber-200 bg-amber-50"
                          : "border-slate-200 bg-white/70";

                    return (
                      <div
                        key={v.category}
                        className={`rounded-2xl border ${statusColor} p-4`}
                      >
                        <div className="text-sm text-slate-600 dark:text-slate-300 capitalize">{v.category}</div>
                        <div className="mt-2 flex items-end justify-between">
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Budget</div>
                            <div className="text-lg font-semibold text-slate-900">
                              {gbp(v.budgeted)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-500 dark:text-slate-400">Actual</div>
                            <div className="text-lg font-semibold text-slate-900">
                              {gbp(v.actual)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span
                            className={`text-xs font-semibold ${overBudget
                              ? isIncome
                                ? "text-green-600"
                                : "text-rose-600"
                              : isIncome
                                ? "text-rose-600"
                                : "text-green-600"
                              }`}
                          >
                            {overBudget ? "+" : "-"}
                            {gbp(Math.abs(v.variance))}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {Math.abs(v.variancePercent).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Savings Transfer Reconciliation */}
            {savingsReconciliation && (
              <div className="vn-card p-6">
                <div className="text-sm font-semibold text-slate-800 mb-4">Savings transfer reconciliation</div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Budgeted transfer</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {gbp(savingsReconciliation.budgeted)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Actual transfer</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {gbp(savingsReconciliation.actual)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Variance</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {savingsReconciliation.status === "over" ? "+" : savingsReconciliation.status === "under" ? "-" : ""}
                      {gbp(Math.abs(savingsReconciliation.variance))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Transactions List */}
            <div className="vn-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-slate-800">
                  Transactions ({periodTransactions.length})
                  {bulkMode && selectedIds.size > 0 && (
                    <span className="ml-2 text-xs text-blue-600">
                      ({selectedIds.size} selected)
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!bulkMode ? (
                    <>
                      <button
                        onClick={() => setBulkMode(true)}
                        className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={periodTransactions.length === 0}
                        aria-label="Enable bulk selection mode"
                      >
                        Select
                      </button>
                      <button
                        onClick={() => exportToCSV(periodTransactions, period.label)}
                        className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={periodTransactions.length === 0}
                        aria-label="Export transactions to CSV"
                      >
                        CSV
                      </button>
                      <button
                        onClick={() => exportToExcel(periodTransactions, period.label)}
                        className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={periodTransactions.length === 0}
                        aria-label="Export transactions to Excel"
                      >
                        Excel
                      </button>
                      <button
                        onClick={() => exportToPDF(periodTransactions, period.label, period.start, period.end)}
                        className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={selectedIds.size === 0}
                      >
                        Export Selected
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        className="rounded-lg bg-white border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={selectedIds.size === 0}
                      >
                        Delete Selected
                      </button>
                      <button
                        onClick={() => {
                          setBulkMode(false);
                          setSelectedIds(new Set());
                        }}
                        className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
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
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === periodTransactions.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
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
                    className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[var(--accent)]"
                  />
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as CashflowType | "all")}
                    className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="all">All types</option>
                    <option value="income">Income</option>
                    <option value="outflow">Outflow</option>
                    <option value="transfer">Transfer</option>
                  </select>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value as CashflowCategory | "all")}
                    className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                <div className="mt-4 rounded-xl bg-white/70 p-8">
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
                            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 flex flex-wrap items-center justify-between gap-3">
                              {bulkMode && (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(txn.id)}
                                  onChange={() => toggleSelect(txn.id)}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
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
                                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Amount (GBP)</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editTransaction.amount}
                                        onChange={(e) =>
                                          setEditTransaction({ ...editTransaction, amount: e.target.value })
                                        }
                                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                                          <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs text-slate-600">
                                            <div className="font-semibold text-slate-700">Recurring pattern detected</div>
                                            <div className="mt-1 text-slate-500">
                                              {(editRecurringBillSuggestion as any).merchantName} | {gbp((editRecurringBillSuggestion as any).averageAmount)} |{" "}
                                              {formatFrequencyLabel((editRecurringBillSuggestion as any).frequency)} | Day{" "}
                                              {(editRecurringBillSuggestion as any).suggestedDueDay}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={handleCreateBillForEditTransaction as any}
                                              className="mt-2 inline-flex items-center rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:border-indigo-300 hover:text-indigo-700"
                                            >
                                              Create bill
                                            </button>
                                          </div>
                                        ) : null}
                                        {!editBillSuggestionLabel && !editRecurringBillSuggestion ? (
                                          <button
                                            type="button"
                                            onClick={handleCreateBillForEditTransaction}
                                            className="mt-2 inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
                                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[var(--accent)]"
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
                                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
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
                                      <div className="text-sm font-semibold text-slate-900">{txn.label}</div>
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
                                        {gbp(txn.amount)}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleEditTransaction(txn)}
                                      className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 transition-colors"
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
