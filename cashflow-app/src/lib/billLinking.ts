import type { BillTemplate } from "@/data/plan";
import { normalizeText, splitTokens, scoreTextMatch } from "@/lib/textUtils";

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



function uniqueTokens(values: string[]) {
  return Array.from(new Set(values.flatMap((value) => splitTokens(value))));
}

function billTokens(bill: BillTemplate) {
  const tokens = uniqueTokens([bill.label, bill.id]).filter((token) => token.length >= 2);
  const filtered = tokens.filter((token) => !BILL_STOP_WORDS.has(token));
  return filtered.length ? filtered : tokens;
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
    const { score, matched } = scoreTextMatch(hay, tokens);
    if (score > bestScore || (score === bestScore && matched > bestMatched)) {
      bestScore = score;
      bestMatched = matched;
      bestId = bill.id;
    }
  });

  return bestScore >= 2 ? bestId : "";
}
