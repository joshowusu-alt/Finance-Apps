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
    const { public_token, userId } = await req.json();

    if (!public_token || !userId) {
      return NextResponse.json(
        { error: "Missing public_token or userId" },
        { status: 400 }
      );
    }

    const client = getPlaidClient();

    // Exchange public token for access token
    const exchangeResponse = await client.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get account information
    const accountsResponse = await client.accountsGet({
      access_token: accessToken,
    });

    const accounts = accountsResponse.data.accounts;

    // Store the connection in the database
    const sql = getSQL();
    const now = new Date();

    await sql`
      INSERT INTO plaid_connections
      (user_id, item_id, access_token, created_at, updated_at)
      VALUES (${userId}, ${itemId}, ${accessToken}, ${now}, ${now})
      ON CONFLICT (item_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        updated_at = EXCLUDED.updated_at
    `;

    // Store accounts
    for (const account of accounts) {
      await sql`
        INSERT INTO plaid_accounts
        (user_id, item_id, account_id, name, official_name, type, subtype, created_at)
        VALUES (
          ${userId},
          ${itemId},
          ${account.account_id},
          ${account.name},
          ${account.official_name || null},
          ${account.type},
          ${account.subtype || null},
          ${now}
        )
        ON CONFLICT (account_id) DO UPDATE SET
          name = EXCLUDED.name,
          official_name = EXCLUDED.official_name
      `;
    }

    return NextResponse.json({
      success: true,
      accounts: accounts.map((a) => ({
        id: a.account_id,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
      })),
    });
  } catch (error: any) {
    console.error("Error exchanging token:", error.response?.data || error.message);
    return NextResponse.json(
      { error: "Failed to exchange token", details: error.message },
      { status: 500 }
    );
  }
}
