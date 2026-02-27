/**
 * Shared text normalization and tokenization utilities.
 * Used across pages and lib modules for transaction matching, bill linking, etc.
 */

/** Normalize text: lowercase, strip non-alphanumeric, collapse whitespace */
export function normalizeText(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Split normalized text into individual tokens */
export function splitTokens(value: string): string[] {
    return normalizeText(value)
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length > 0);
}

/** Check if any token appears in the haystack string */
export function matchesTokens(hay: string, tokens: string[]): boolean {
    const normalized = normalizeText(hay);
    if (!normalized) return false;
    const wordSet = new Set(splitTokens(normalized));
    for (const token of tokens) {
        if (!token) continue;
        if (token.length <= 2) {
            if (wordSet.has(token)) return true;
        } else if (normalized.includes(token)) {
            return true;
        }
    }
    return false;
}

/**
 * Normalize a merchant/payee label for grouping and matching:
 * strips punctuation, collapses whitespace, removes common payment prefixes
 * and legal suffixes (Ltd, Plc, Inc, etc.).
 */
export function normalizeMerchant(label: string): string {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^(payment to|transfer to|direct debit|dd)\s+/i, "")
        .replace(/\s+(ltd|limited|uk|co|plc|inc)$/i, "")
        .trim();
}

/**
 * Check whether any keyword (after normalization) appears inside text.
 * Both the haystack and each keyword are run through normalizeText so
 * punctuation and casing differences are ignored.
 */
export function containsKeyword(text: string, keywords: string[]): boolean {
    const normalized = normalizeText(text);
    return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
}

/**
 * Score how well a set of tokens matches a haystack string.
 * Exact word matches score 2; substring matches score 1.
 * Returns both the total score and the number of matched tokens.
 */
export function scoreTextMatch(
    hay: string,
    tokens: string[]
): { score: number; matched: number } {
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
