import type { BillTemplate } from "@/data/plan";

const BILL_STOP_WORDS = new Set([
  "bill",
  "payment",
  "giving",
  "charity",
  "donation",
  "donations",
  "one",
  "off",
  "transfer",
]);

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function splitTokens(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function uniqueTokens(values: string[]) {
  return Array.from(new Set(values.flatMap((value) => splitTokens(value))));
}

function billTokens(bill: BillTemplate) {
  const tokens = uniqueTokens([bill.label, bill.id]).filter((token) => token.length >= 2);
  const filtered = tokens.filter((token) => !BILL_STOP_WORDS.has(token));
  return filtered.length ? filtered : tokens;
}

function scoreMatch(hay: string, tokens: string[]) {
  const normalized = normalizeText(hay);
  if (!normalized) return { score: 0, matched: 0 };
  const wordSet = new Set(splitTokens(normalized));
  let score = 0;
  let matched = 0;
  for (const token of tokens) {
    if (!token) continue;
    if (wordSet.has(token)) {
      score += 2;
      matched += 1;
    } else if (normalized.includes(token)) {
      score += 1;
      matched += 1;
    }
  }
  return { score, matched };
}

export function suggestBillId(label: string, notes: string, bills: BillTemplate[]) {
  if (!label && !notes) return "";
  const hay = `${label} ${notes ?? ""}`.trim();
  let bestId = "";
  let bestScore = 0;
  let bestMatched = 0;

  bills.forEach((bill) => {
    const tokens = billTokens(bill);
    if (tokens.length === 0) return;
    const { score, matched } = scoreMatch(hay, tokens);
    if (score > bestScore || (score === bestScore && matched > bestMatched)) {
      bestScore = score;
      bestMatched = matched;
      bestId = bill.id;
    }
  });

  return bestScore >= 2 ? bestId : "";
}
