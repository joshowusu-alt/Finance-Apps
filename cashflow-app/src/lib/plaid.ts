/**
 * Shared Plaid client — Single Responsibility: Plaid API configuration.
 *
 * Eliminates 5× duplicate `getPlaidClient()` definitions across API routes.
 */

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

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
