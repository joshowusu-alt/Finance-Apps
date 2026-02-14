/**
 * Auto-Categorization System
 * 
 * Rule-based keyword matching for automatic transaction categorization.
 * Maps merchant names and descriptions to spending categories.
 */

import type { CashflowCategory } from "@/data/plan";
import { normalizeText } from "@/lib/textUtils";

// Category rule with keywords and optional merchant patterns
type CategoryRule = {
    category: CashflowCategory;
    keywords: string[];
    exactMatches?: string[];
    patterns?: RegExp[];
    priority?: number; // Higher priority takes precedence
};

// Comprehensive category rules based on UK merchants
const CATEGORY_RULES: CategoryRule[] = [
    // Income patterns
    {
        category: "income",
        keywords: ["salary", "payroll", "wages", "income", "deposit", "refund", "cashback", "interest"],
        exactMatches: ["fm income", "mcd income", "outlier income"],
        priority: 10,
    },

    // Savings transfers
    {
        category: "savings",
        keywords: ["savings", "moneybox", "money box", "isa", "investment", "vanguard", "trading212", "freetrade"],
        exactMatches: ["transfer to savings", "transfer to moneybox", "stocks and shares isa"],
        priority: 9,
    },

    // Giving & Charity
    {
        category: "giving",
        keywords: ["tithe", "offering", "charity", "donation", "church", "giving", "perez", "jpc", "parents", "mummy"],
        exactMatches: ["tithe", "offerings", "parents", "charity - perez uni", "charity - jpc utilities"],
        priority: 8,
    },

    // Bills - Housing
    {
        category: "bill",
        keywords: [
            "rent", "mortgage", "council tax", "water bill", "thames water", "electricity", "gas", "energy",
            "british gas", "edf", "octopus energy", "ovo", "bulb", "eon", "sse", "scottish power",
        ],
        exactMatches: ["rent", "water bill", "electricity", "gas", "electricity & gas"],
        priority: 7,
    },

    // Bills - Communications
    {
        category: "bill",
        keywords: [
            "internet", "broadband", "fibre", "community fibre", "bt", "virgin media", "sky", "talktalk",
            "ee", "vodafone", "o2", "three", "giffgaff", "lebara", "lycamobile", "tesco mobile",
            "phone", "mobile", "iphone payments", "sky mobile",
        ],
        exactMatches: ["community fibre", "community fibre / internet", "iphone payments", "lebara"],
        priority: 7,
    },

    // Bills - Insurance & Finance
    {
        category: "bill",
        keywords: [
            "insurance", "car insurance", "home insurance", "life insurance", "admiral", "direct line",
            "aviva", "axa", "confused", "compare the market", "road tax", "dvla", "mot", "breakdown",
            "aa", "rac", "green flag",
        ],
        exactMatches: ["insurance", "road tax", "car insurance"],
        priority: 7,
    },

    // Bills - Credit & Loans
    {
        category: "bill",
        keywords: [
            "credit card", "loan", "payment", "monzo", "barclays", "capital one", "amex", "american express",
            "hsbc", "natwest", "lloyds", "santander", "nationwide", "halifax", "laptop",
        ],
        exactMatches: ["credit card payment", "monzo payment", "capital one", "laptop"],
        priority: 7,
    },

    // Bills - Transport (fuel, transport subscriptions)
    {
        category: "bill",
        keywords: ["fuel", "petrol", "diesel", "shell", "bp", "esso", "texaco", "sainsburys fuel", "tesco fuel"],
        exactMatches: ["fuel", "fuel for renault scenic"],
        priority: 6,
    },

    // Allowance - Food & Groceries
    {
        category: "allowance",
        keywords: [
            "tesco", "sainsbury", "sainsburys", "asda", "morrisons", "aldi", "lidl", "waitrose", "marks spencer",
            "m&s", "co-op", "coop", "iceland", "costco", "ocado", "amazon fresh", "gorillas", "getir",
            "just eat", "deliveroo", "uber eats", "dominos", "pizza hut", "mcdonalds", "kfc", "nandos",
            "greggs", "pret", "starbucks", "costa", "caffe nero", "food", "grocery", "groceries",
        ],
        exactMatches: ["tesco", "sainsburys", "costco", "asda", "aldi", "lidl"],
        priority: 5,
    },

    // Allowance - Transport
    {
        category: "allowance",
        keywords: [
            "tfl", "transport for london", "oyster", "uber", "bolt", "ola", "freenow", "gett",
            "national rail", "trainline", "thameslink", "southeastern", "southern", "greater anglia",
            "tube", "bus", "train", "transport",
        ],
        exactMatches: ["tfl", "transport - tfl", "transportation - tfl", "uber", "bolt"],
        priority: 5,
    },

    // Allowance - Shopping & Personal
    {
        category: "allowance",
        keywords: [
            "amazon", "ebay", "argos", "john lewis", "currys", "primark", "next", "asos", "boohoo",
            "boots", "superdrug", "bodyshop", "lush", "tkmaxx", "home bargains", "b&m", "wilko",
            "ikea", "dunelm", "the range", "house keep", "wipes", "cerelac", "body wash", "toothpaste",
        ],
        exactMatches: ["amazon", "ebay", "ikea", "house keep"],
        priority: 4,
    },

    // Allowance - Entertainment & Subscriptions
    {
        category: "allowance",
        keywords: [
            "netflix", "disney", "amazon prime", "spotify", "apple music", "youtube", "twitch",
            "playstation", "xbox", "nintendo", "steam", "cinema", "odeon", "cineworld", "vue",
            "bowling", "gym", "fitness", "subscription", "capcut",
        ],
        exactMatches: ["netflix", "disney+", "spotify", "apple music"],
        priority: 4,
    },

    // Other - catch-all for miscellaneous
    {
        category: "other",
        keywords: ["openai", "chatgpt", "misc", "miscellaneous"],
        priority: 1,
    },
];

// Tokenize text into words
function tokenize(text: string): string[] {
    return normalizeText(text).split(" ").filter(Boolean);
}

// Check if any keyword is found in text
function containsKeyword(text: string, keywords: string[]): boolean {
    const normalized = normalizeText(text);
    return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

// Check for exact matches (cleaned)
function hasExactMatch(text: string, exactMatches: string[]): boolean {
    const normalized = normalizeText(text);
    return exactMatches.some((match) => normalized === normalizeText(match));
}

// Check if any pattern matches
function matchesPattern(text: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(text));
}

// Calculate similarity score between two strings (Jaccard index)
function similarityScore(text1: string, text2: string): number {
    const tokens1 = new Set(tokenize(text1));
    const tokens2 = new Set(tokenize(text2));

    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    let intersection = 0;
    tokens1.forEach((token) => {
        if (tokens2.has(token)) intersection++;
    });

    const union = tokens1.size + tokens2.size - intersection;
    return union > 0 ? intersection / union : 0;
}

export type CategorySuggestion = {
    category: CashflowCategory;
    confidence: number; // 0-100
    matchedKeywords: string[];
    reason: string;
};

/**
 * Suggest a category for a transaction based on merchant name and description
 */
export function suggestCategory(
    merchantName: string,
    description?: string
): CategorySuggestion {
    const searchText = `${merchantName} ${description || ""}`.trim();

    if (!searchText) {
        return {
            category: "other",
            confidence: 0,
            matchedKeywords: [],
            reason: "No merchant or description provided",
        };
    }

    let bestMatch: CategorySuggestion = {
        category: "other",
        confidence: 0,
        matchedKeywords: [],
        reason: "No matching rules found",
    };

    for (const rule of CATEGORY_RULES) {
        const matchedKeywords: string[] = [];
        let score = 0;

        // Check exact matches first (highest confidence)
        if (rule.exactMatches && hasExactMatch(searchText, rule.exactMatches)) {
            score = 95;
            matchedKeywords.push(...rule.exactMatches.filter((m) =>
                normalizeText(searchText).includes(normalizeText(m))
            ));
        }

        // Check pattern matches
        else if (rule.patterns && matchesPattern(searchText, rule.patterns)) {
            score = 85;
        }

        // Check keyword matches
        else if (containsKeyword(searchText, rule.keywords)) {
            const matched = rule.keywords.filter((k) =>
                normalizeText(searchText).includes(k.toLowerCase())
            );
            matchedKeywords.push(...matched);

            // Score based on number of keyword matches and priority
            score = Math.min(80, 40 + matched.length * 15 + (rule.priority || 0) * 3);
        }

        // Apply priority boost
        const priorityBoost = (rule.priority || 0) * 2;
        score = Math.min(100, score + priorityBoost);

        if (score > bestMatch.confidence) {
            bestMatch = {
                category: rule.category,
                confidence: score,
                matchedKeywords,
                reason: matchedKeywords.length > 0
                    ? `Matched keywords: ${matchedKeywords.slice(0, 3).join(", ")}`
                    : "Pattern match",
            };
        }
    }

    // Apply minimum confidence threshold
    if (bestMatch.confidence < 30) {
        return {
            category: "other",
            confidence: 10,
            matchedKeywords: [],
            reason: "Low confidence - defaulting to other",
        };
    }

    return bestMatch;
}

/**
 * Bulk categorize multiple transactions
 */
export function categorizeTransactions(
    transactions: Array<{ merchantName: string; description?: string }>
): CategorySuggestion[] {
    return transactions.map((t) => suggestCategory(t.merchantName, t.description));
}

/**
 * Get the confidence level label
 */
export function getConfidenceLabel(confidence: number): "high" | "medium" | "low" {
    if (confidence >= 80) return "high";
    if (confidence >= 50) return "medium";
    return "low";
}

/**
 * Common UK merchant to domain mappings for logo fetching
 */
export const COMMON_MERCHANTS: Record<string, { domain: string; displayName: string }> = {
    tesco: { domain: "tesco.com", displayName: "Tesco" },
    sainsbury: { domain: "sainsburys.co.uk", displayName: "Sainsbury's" },
    sainsburys: { domain: "sainsburys.co.uk", displayName: "Sainsbury's" },
    asda: { domain: "asda.com", displayName: "ASDA" },
    morrisons: { domain: "morrisons.com", displayName: "Morrisons" },
    aldi: { domain: "aldi.co.uk", displayName: "Aldi" },
    lidl: { domain: "lidl.co.uk", displayName: "Lidl" },
    waitrose: { domain: "waitrose.com", displayName: "Waitrose" },
    costco: { domain: "costco.co.uk", displayName: "Costco" },
    amazon: { domain: "amazon.co.uk", displayName: "Amazon" },
    netflix: { domain: "netflix.com", displayName: "Netflix" },
    spotify: { domain: "spotify.com", displayName: "Spotify" },
    uber: { domain: "uber.com", displayName: "Uber" },
    bolt: { domain: "bolt.eu", displayName: "Bolt" },
    deliveroo: { domain: "deliveroo.com", displayName: "Deliveroo" },
    monzo: { domain: "monzo.com", displayName: "Monzo" },
    barclays: { domain: "barclays.co.uk", displayName: "Barclays" },
    hsbc: { domain: "hsbc.co.uk", displayName: "HSBC" },
    lloyds: { domain: "lloydsbank.com", displayName: "Lloyds" },
    natwest: { domain: "natwest.com", displayName: "NatWest" },
    shell: { domain: "shell.co.uk", displayName: "Shell" },
    bp: { domain: "bp.com", displayName: "BP" },
    tfl: { domain: "tfl.gov.uk", displayName: "TfL" },
    ikea: { domain: "ikea.com", displayName: "IKEA" },
    openai: { domain: "openai.com", displayName: "OpenAI" },
    apple: { domain: "apple.com", displayName: "Apple" },
    sky: { domain: "sky.com", displayName: "Sky" },
    lebara: { domain: "lebara.co.uk", displayName: "Lebara" },
};
