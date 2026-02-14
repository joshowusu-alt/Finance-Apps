/**
 * Plaid category mapping — Single source of truth for converting
 * Plaid transaction categories to our CashflowCategory / CashflowType.
 *
 * Fixes the previously inconsistent mapping in transactions/route.ts
 * (returned invalid "expense") vs sync/route.ts (returned valid categories).
 */

import type { CashflowCategory, CashflowType } from "@/data/plan";

/**
 * Map Plaid category hierarchy to our CashflowCategory.
 * Returns a valid CashflowCategory — never "expense" or other invalid values.
 */
export function mapPlaidCategory(
  plaidCategories: string[] | null | undefined,
): CashflowCategory {
  if (!plaidCategories || plaidCategories.length === 0) return "other";

  const primary = plaidCategories[0].toLowerCase();

  if (
    primary.includes("payroll") ||
    primary.includes("income") ||
    primary.includes("transfer in") ||
    primary.includes("deposit")
  ) {
    return "income";
  }

  if (
    primary.includes("rent") ||
    primary.includes("utilities") ||
    primary.includes("mortgage") ||
    primary.includes("subscription") ||
    primary.includes("phone") ||
    primary.includes("internet") ||
    primary.includes("insurance")
  ) {
    return "bill";
  }

  if (
    primary.includes("savings") ||
    primary.includes("investment") ||
    primary.includes("transfer")
  ) {
    return "savings";
  }

  if (
    primary.includes("donation") ||
    primary.includes("charity") ||
    primary.includes("religious") ||
    primary.includes("tithe") ||
    primary.includes("offering")
  ) {
    return "giving";
  }

  if (
    primary.includes("food") ||
    primary.includes("restaurant") ||
    primary.includes("groceries") ||
    primary.includes("shopping") ||
    primary.includes("entertainment")
  ) {
    return "allowance";
  }

  return "other";
}

/**
 * Determine cashflow type from Plaid's amount sign convention.
 * Plaid: positive = debit (money out), negative = credit (money in).
 */
export function mapPlaidType(plaidAmount: number): CashflowType {
  return plaidAmount < 0 ? "income" : "outflow";
}
