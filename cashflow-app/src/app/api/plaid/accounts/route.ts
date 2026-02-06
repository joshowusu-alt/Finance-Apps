import { NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

function getPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV || "sandbox";

  if (!clientId || !secret) {
    throw new Error("Missing Plaid credentials");
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

  return new PlaidApi(configuration);
}

function getSQL() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return neon(databaseUrl);
}

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Get all access tokens for this user
    const sql = getSQL();
    const connections = await sql`
      SELECT access_token, item_id
      FROM plaid_connections
      WHERE user_id = ${userId}
    `;

    if (connections.length === 0) {
      return NextResponse.json({ accounts: [] });
    }

    const client = getPlaidClient();
    const allAccounts = [];

    // Fetch accounts for each connected item
    for (const connection of connections) {
      try {
        const response = await client.accountsBalanceGet({
          access_token: connection.access_token,
        });

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
            currency: account.balances.iso_currency_code || "GBP",
          },
          mask: account.mask, // Last 4 digits
        }));

        allAccounts.push(...accounts);
      } catch (error: any) {
        console.error(`Error fetching accounts for item ${connection.item_id}:`, error.message);
      }
    }

    return NextResponse.json({ accounts: allAccounts });
  } catch (error: any) {
    console.error("Error fetching accounts:", error.response?.data || error.message);
    return NextResponse.json(
      { error: "Failed to fetch accounts", details: error.message },
      { status: 500 }
    );
  }
}
