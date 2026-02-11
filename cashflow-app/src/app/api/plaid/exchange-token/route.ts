import { NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { neon } from "@neondatabase/serverless";
import { createClient } from "@/lib/supabase/server";

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

    const supabase = await createClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;
    const effectiveUserId = user?.id ?? userId;

    if (!public_token || !effectiveUserId) {
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

    const nowIso = new Date().toISOString();

    if (user && supabase) {
      await supabase.from("plaid_connections").upsert(
        {
          user_id: effectiveUserId,
          item_id: itemId,
          access_token: accessToken,
          updated_at: nowIso,
        },
        { onConflict: "item_id" }
      );

      const accountRows = accounts.map((account) => ({
        user_id: effectiveUserId,
        item_id: itemId,
        account_id: account.account_id,
        name: account.name,
        official_name: account.official_name || null,
        type: account.type,
        subtype: account.subtype || null,
        created_at: nowIso,
      }));

      if (accountRows.length) {
        await supabase.from("plaid_accounts").upsert(accountRows, {
          onConflict: "account_id",
        });
      }
    } else {
      // Store the connection in the database (fallback: main token / Neon)
      const sql = getSQL();
      const now = new Date();

      await sql`
        INSERT INTO plaid_connections
        (user_id, item_id, access_token, created_at, updated_at)
        VALUES (${effectiveUserId}, ${itemId}, ${accessToken}, ${now}, ${now})
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
            ${effectiveUserId},
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
