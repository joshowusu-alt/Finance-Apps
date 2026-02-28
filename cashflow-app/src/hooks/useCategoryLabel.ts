import type { CashflowCategory, CustomCategory, BuiltInCategory } from "@/data/plan";

export const BUILT_IN_LABELS: Record<BuiltInCategory, string> = {
  income:    "Income",
  bill:      "Bills",
  giving:    "Giving",
  savings:   "Savings",
  allowance: "Allowance",
  buffer:    "Buffer",
  other:     "Other",
};

export function getCategoryLabel(
  category: CashflowCategory,
  customCategories: CustomCategory[] = []
): string {
  // Check custom categories first
  const custom = customCategories.find(
    (c) => c.id === category || c.name.toLowerCase() === category.toLowerCase()
  );
  if (custom) return custom.name;
  // Fall back to built-in labels
  return BUILT_IN_LABELS[category as BuiltInCategory] ?? category;
}

export function getCategoryEmoji(
  category: CashflowCategory,
  customCategories: CustomCategory[] = []
): string {
  const custom = customCategories.find(
    (c) => c.id === category || c.name.toLowerCase() === category.toLowerCase()
  );
  if (custom?.icon) return custom.icon;
  const EMOJIS: Record<BuiltInCategory, string> = {
    income: "💰", bill: "📋", giving: "🤝", savings: "🏦",
    allowance: "🎯", buffer: "🛡️", other: "📦",
  };
  return EMOJIS[category as BuiltInCategory] ?? "🏷️";
}
