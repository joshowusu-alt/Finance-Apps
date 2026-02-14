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
