import type { CashflowCategory, CashflowType, Plan, BillTemplate } from "@/data/plan";
import { type DetectedBill } from "@/lib/billDetection";
import { suggestBillId } from "@/lib/billLinking";
import { normalizeText, splitTokens } from "@/lib/textUtils";

export function formatNice(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  return `${weekday} ${day} ${month}`;
}

export function makeId() {
  return `txn-${Date.now()}`;
}

export type TransactionDraft = {
  date: string;
  label: string;
  amount: string;
  type: CashflowType;
  category: CashflowCategory;
  notes: string;
  linkedRuleId?: string | null;
  linkedBillId?: string | null;
  goalId?: string | null;
};

export const incomeStopWords = new Set(["income", "salary", "pay", "payment", "wage"]);

export function scoreRuleMatch(hay: string, tokens: string[]) {
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

export function suggestIncomeRuleId(label: string, notes: string, rules: Plan["incomeRules"]) {
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

export const outflowStopWords = new Set(["outflow", "rule", "transfer", "payment", "bill", "giving", "savings"]);

export function suggestOutflowRuleId(label: string, notes: string, rules: Plan["outflowRules"]) {
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

export function resolveIncomeRuleId(draft: TransactionDraft, rules: Plan["incomeRules"]) {
  if (draft.type !== "income") return undefined;
  const suggested = suggestIncomeRuleId(draft.label, draft.notes, rules);
  if (draft.linkedRuleId === null) return undefined;
  const resolved = draft.linkedRuleId ?? suggested;
  return resolved || undefined;
}

export const OUTFLOW_CATEGORIES: CashflowCategory[] = ["bill", "giving", "allowance", "buffer", "other"];
export const DEFAULT_CATEGORY_FOR_TYPE: Record<CashflowType, CashflowCategory> = {
  income: "income",
  outflow: "other",
  transfer: "savings",
};
export const BILL_CATEGORIES = new Set<CashflowCategory>(["bill", "giving"]);
export const FREE_TEXT_CATEGORIES = new Set<CashflowCategory>(["allowance", "buffer", "other"]);
export const AUTO_CATEGORY_CONFIDENCE = 60;

export function categoryOptionsForType(type: CashflowType) {
  if (type === "income") return ["income"] as CashflowCategory[];
  if (type === "transfer") return ["savings"] as CashflowCategory[];
  return OUTFLOW_CATEGORIES;
}

export function isBillCategory(category: CashflowCategory) {
  return BILL_CATEGORIES.has(category);
}

export function isFreeTextCategory(category: CashflowCategory) {
  return FREE_TEXT_CATEGORIES.has(category);
}

export function resolveSuggestedId(explicit: string | null | undefined, suggested: string) {
  if (explicit === null) return "";
  return explicit ?? suggested ?? "";
}

export function formatCategoryLabel(category: CashflowCategory) {
  return `${category.slice(0, 1).toUpperCase()}${category.slice(1)}`;
}

export const CADENCE_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  "bi-weekly": "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annually",
  annually: "Annually",
  yearly: "Annually",
};

export function formatFrequencyLabel(frequency: string) {
  return CADENCE_LABELS[frequency] ?? frequency;
}

export function slugifyBillLabel(label: string) {
  const slug = normalizeText(label).replace(/\s+/g, "-");
  return slug || "bill";
}

export function findExistingBillByLabel(label: string, bills: BillTemplate[]) {
  const normalized = normalizeText(label);
  if (!normalized) return undefined;
  return bills.find((bill) => normalizeText(bill.label) === normalized);
}

export function makeUniqueBillId(label: string, bills: BillTemplate[]) {
  const base = slugifyBillLabel(label);
  let id = base;
  let counter = 1;
  while (bills.some((bill) => bill.id === id)) {
    counter += 1;
    id = `${base}-${counter}`;
  }
  return id;
}

export function suggestDetectedBill(label: string, notes: string, detectedBills: DetectedBill[]) {
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

export function normalizeCategoryForType(type: CashflowType, category: CashflowCategory) {
  const options = categoryOptionsForType(type);
  return options.includes(category) ? category : DEFAULT_CATEGORY_FOR_TYPE[type];
}

export function resolveBillId(draft: TransactionDraft, bills: Plan["bills"]) {
  if (draft.type !== "outflow" || !isBillCategory(draft.category)) return undefined;
  if (draft.linkedBillId === null) return undefined;
  const options = bills.filter((bill) => bill.category === draft.category && bill.enabled);
  const suggested = suggestBillId(draft.label, draft.notes, options);
  const resolved = draft.linkedBillId ?? suggested;
  return resolved || undefined;
}

export function resolveOutflowRuleId(draft: TransactionDraft, rules: Plan["outflowRules"]) {
  if (draft.type !== "outflow" || !isFreeTextCategory(draft.category)) return undefined;
  if (draft.linkedRuleId === null) return undefined;
  const options = rules.filter((rule) => rule.category === draft.category && rule.enabled);
  const suggested = suggestOutflowRuleId(draft.label, draft.notes, options);
  const resolved = draft.linkedRuleId ?? suggested;
  return resolved || undefined;
}

export function resolveTransferRuleId(draft: TransactionDraft, rules: Plan["outflowRules"]) {
  if (draft.type !== "transfer") return undefined;
  if (draft.linkedRuleId === null) return undefined;
  const savingsRule = rules.find((rule) => rule.enabled && rule.category === "savings");
  const suggested = savingsRule?.id ?? "savings";
  const resolved = draft.linkedRuleId ?? suggested;
  return resolved || undefined;
}
