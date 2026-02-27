/**
 * Shared Plaid client — Single Responsibility: Plaid API configuration.
 *
 * Eliminates 5× duplicate `getPlaidClient()` definitions across API routes.
 */

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import type { Transaction as PlaidTransaction } from "plaid";
import { mapPlaidCategory, mapPlaidType } from "@/lib/plaidCategories";
import type { Transaction } from "@/data/plan";

let _client: PlaidApi | null = null;

/**
 * Returns a configured Plaid API client.
 * Lazily created and reused (same env vars for the process lifetime).
 */
export function getPlaidClient(): PlaidApi {
  if (_client) return _client;

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV || "sandbox";

  if (!clientId || !secret) {
    throw new Error(
      "Missing Plaid credentials. Set PLAID_CLIENT_ID and PLAID_SECRET in .env.local"
    );
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  _client = new PlaidApi(configuration);
  return _client;
}

/**
 * Map a raw Plaid Transaction to the app's internal Transaction format.
 *
 * Returns null if the transaction ID already exists in `existingIds` (dedup).
 * Uses `personal_finance_category.primary` when available (Plaid API ≥ v3),
 * falling back to the legacy `category` array.
 *
 * @param tx          - Raw Plaid transaction object
 * @param existingIds - Set of already-present transaction IDs (for dedup)
 * @param notesTag    - Context label appended to notes, e.g. "Plaid" or "auto-synced"
 */
export function mapPlaidTransaction(
  tx: PlaidTransaction,
  existingIds: Set<string>,
  notesTag = "Plaid",
): Transaction | null {
  const id = `plaid-${tx.transaction_id}`;
  if (existingIds.has(id)) return null;

  const category = mapPlaidCategory(
    tx.personal_finance_category?.primary
      ? [tx.personal_finance_category.primary]
      : (tx.category ?? undefined),
  );

  return {
    id,
    date: tx.date,
    label: tx.merchant_name || tx.name,
    amount: Math.abs(tx.amount),
    type: mapPlaidType(tx.amount),
    category,
    notes: `${tx.name} (${notesTag})`,
  };
}
