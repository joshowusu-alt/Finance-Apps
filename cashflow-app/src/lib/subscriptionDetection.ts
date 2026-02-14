import type { Recurrence, Transaction } from "@/data/plan";
import { detectRecurringBills, type DetectedBill } from "@/lib/billDetection";
import { suggestCategory } from "@/lib/categorization";
import { normalizeText } from "@/lib/textUtils";

export type SubscriptionRecommendation = "keep" | "review" | "cancel";

export type DetectedSubscription = {
  id: string;
  merchantName: string;
  averageAmount: number;
  frequency: Recurrence;
  confidence: number;
  occurrences: Array<{ date: string; amount: number }>;
  lastChargeDate: string;
  monthlyCost: number;
  annualCost: number;
  recommendation: SubscriptionRecommendation;
  recommendationReason: string;
};

const SUBSCRIPTION_KEYWORDS = [
  "subscription",
  "subription",
  "membership",
  "member",
  "streaming",
  "netflix",
  "spotify",
  "disney",
  "prime",
  "amazon prime",
  "apple",
  "icloud",
  "apple music",
  "google",
  "youtube",
  "youtube premium",
  "microsoft",
  "office",
  "adobe",
  "dropbox",
  "onedrive",
  "canva",
  "notion",
  "capcut",
  "gym",
  "fitness",
  "peloton",
  "strava",
  "headspace",
  "calm",
  "audible",
  "kindle",
  "hulu",
  "paramount",
  "max",
  "peacock",
  "tidal",
  "deezer",
  "soundcloud",
  "openai",
  "chatgpt",
];

const NON_SUBSCRIPTION_KEYWORDS = [
  "rent",
  "mortgage",
  "council",
  "tax",
  "road tax",
  "insurance",
  "utility",
  "utilities",
  "electricity",
  "gas",
  "water",
  "fuel",
  "petrol",
  "diesel",
  "credit",
  "loan",
  "payment",
  "transfer",
  "bank",
  "savings",
  "broadband",
  "internet",
  "fibre",
  "phone",
  "mobile",
];



function containsKeyword(text: string, keywords: string[]) {
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

function normalizeMerchant(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(payment to|transfer to|direct debit|dd)\s+/i, "")
    .replace(/\s+(ltd|limited|uk|co|plc|inc)$/i, "")
    .trim();
}

function frequencyToMonthly(amount: number, frequency: Recurrence) {
  if (frequency === "weekly") return amount * 4.33;
  if (frequency === "biweekly") return amount * 2.17;
  return amount;
}

function frequencyToExpectedGap(frequency: Recurrence) {
  if (frequency === "weekly") return 7;
  if (frequency === "biweekly") return 14;
  return 31;
}

function getLastChargeDate(occurrences: Array<{ date: string }>) {
  return occurrences.reduce((latest, item) => (item.date > latest ? item.date : latest), "");
}

function diffDays(fromISO: string, toISO: string) {
  const from = new Date(`${fromISO}T00:00:00`);
  const to = new Date(`${toISO}T00:00:00`);
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function isSubscriptionCandidate(bill: DetectedBill, extraText: string) {
  const text = `${bill.merchantName} ${extraText}`.trim();
  const hasSubscription = containsKeyword(text, SUBSCRIPTION_KEYWORDS);
  if (hasSubscription) return true;
  const hasNonSubscription = containsKeyword(text, NON_SUBSCRIPTION_KEYWORDS);
  if (hasNonSubscription) return false;

  const suggestion = suggestCategory(bill.merchantName, extraText);
  const isAllowance = suggestion.category === "allowance" && suggestion.confidence >= 50;
  const amountLikely = bill.averageAmount <= 45;
  const steady = bill.confidence >= 70;
  return isAllowance && amountLikely && steady;
}

function buildRecommendation(
  subscription: Omit<DetectedSubscription, "recommendation" | "recommendationReason">,
  asOfDate: string
): { recommendation: SubscriptionRecommendation; reason: string } {
  const expectedGap = frequencyToExpectedGap(subscription.frequency);
  const daysSince = subscription.lastChargeDate
    ? diffDays(subscription.lastChargeDate, asOfDate)
    : 0;

  if (subscription.lastChargeDate && daysSince > expectedGap * 2) {
    return {
      recommendation: "cancel",
      reason: `No charge in the last ${daysSince} days.`,
    };
  }

  if (subscription.monthlyCost >= 50) {
    return {
      recommendation: "cancel",
      reason: "High cost compared with other subscriptions.",
    };
  }

  if (subscription.confidence >= 80 && subscription.monthlyCost <= 15) {
    return {
      recommendation: "keep",
      reason: "Low cost and consistent charges.",
    };
  }

  if (subscription.confidence >= 70 && subscription.monthlyCost <= 30) {
    return {
      recommendation: "keep",
      reason: "Consistent charges at a moderate cost.",
    };
  }

  return {
    recommendation: "review",
    reason: "Review value vs usage.",
  };
}

export function detectSubscriptions(
  transactions: Transaction[],
  options?: { asOfDate?: string }
): DetectedSubscription[] {
  const asOfDate = options?.asOfDate ?? new Date().toISOString().slice(0, 10);
  const recurring = detectRecurringBills(transactions);

  const merchantText = new Map<string, string>();
  transactions.forEach((txn) => {
    if (txn.type !== "outflow") return;
    const key = normalizeMerchant(txn.label);
    if (!key) return;
    const text = `${txn.label} ${txn.notes ?? ""}`.trim();
    merchantText.set(key, `${merchantText.get(key) ?? ""} ${text}`.trim());
  });

  const subscriptions = recurring
    .filter((bill) => {
      const key = normalizeMerchant(bill.merchantName);
      const extraText = merchantText.get(key) ?? "";
      return isSubscriptionCandidate(bill, extraText);
    })
    .map((bill) => {
      const key = normalizeMerchant(bill.merchantName);
      const extraText = merchantText.get(key) ?? "";
      const monthlyCost = frequencyToMonthly(bill.averageAmount, bill.frequency);
      const annualCost = monthlyCost * 12;
      const lastChargeDate = getLastChargeDate(bill.occurrences);
      const baseId = normalizeMerchant(bill.merchantName).replace(/\s+/g, "-") || bill.id;
      const base = {
        id: `sub-${baseId}`,
        merchantName: bill.merchantName,
        averageAmount: bill.averageAmount,
        frequency: bill.frequency,
        confidence: bill.confidence,
        occurrences: bill.occurrences,
        lastChargeDate,
        monthlyCost,
        annualCost,
      };
      const recommendation = buildRecommendation(base, asOfDate);
      return {
        ...base,
        recommendation: recommendation.recommendation,
        recommendationReason: recommendation.reason,
      };
    })
    .sort((a, b) => b.monthlyCost - a.monthlyCost);

  return subscriptions;
}
