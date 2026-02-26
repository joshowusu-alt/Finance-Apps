import { NextResponse } from "next/server";
import { getPlaidClient } from "@/lib/plaid";
import {
  resolveAuth,
  fetchPlaidConnections,
  badRequest,
  serverError,
} from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    const auth = await resolveAuth(userId);

    if (!auth) {
      return badRequest("Missing userId");
    }

    const connections = await fetchPlaidConnections(auth);
    if (connections.length === 0) {
      return NextResponse.json({ accounts: [] });
    }

    const client = getPlaidClient();
    const allAccounts = [];

    for (const connection of connections) {
      try {
        const response = await client.accountsBalanceGet({
          access_token: connection.access_token,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accounts = response.data.accounts.map((account: any) => ({
          id: account.account_id,
          itemId: connection.item_id,
          name: account.name,
          officialName: account.official_name,
          type: account.type,
          subtype: account.subtype,
          balance: {
            current: account.balances.current,
            available: account.balances.available,
            limit: account.balances.limit,
            currency: account.balances.iso_currency_code || "USD",
          },
          mask: account.mask,
        }));

        allAccounts.push(...accounts);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Error fetching accounts for item ${connection.item_id}:`, msg);
      }
    }

    return NextResponse.json({ accounts: allAccounts });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error fetching accounts:", msg);
    return serverError("Failed to fetch accounts", msg);
  }
}
