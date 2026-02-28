import { NextResponse } from "next/server";
import { getPlaidClient } from "@/lib/plaid";
import { getSQL } from "@/lib/db";
import { resolveAuthWithCookie, badRequest, serverError } from "@/lib/apiHelpers";
import { createRateLimiter } from "@/lib/rateLimit";
import { encrypt } from "@/lib/encryption";

export const runtime = "nodejs";

const checkExchangeTokenLimit = createRateLimiter(10, 60_000);

export async function POST(req: Request) {
  try {
    const auth = await resolveAuthWithCookie();

    if (!auth) {
      return badRequest("Unauthorized");
    }

    const { public_token } = await req.json();

    if (!public_token) {
      return badRequest("Missing public_token");
    }

    if (!(await checkExchangeTokenLimit(auth.userId))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const client = getPlaidClient();

    // Exchange public token for access token
    const exchangeResponse = await client.itemPublicTokenExchange({ public_token });
    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get account information
    const accountsResponse = await client.accountsGet({ access_token: accessToken });
    const accounts = accountsResponse.data.accounts;
    const nowIso = new Date().toISOString();

    if (auth.user && auth.supabase) {
      await auth.supabase.from("plaid_connections").upsert(
        {
          user_id: auth.userId,
          item_id: itemId,
          access_token: encrypt(accessToken),
          updated_at: nowIso,
        },
        { onConflict: "item_id" },
      );

      const accountRows = accounts.map((account) => ({
        user_id: auth.userId,
        item_id: itemId,
        account_id: account.account_id,
        name: account.name,
        official_name: account.official_name || null,
        type: account.type,
        subtype: account.subtype || null,
        created_at: nowIso,
      }));

      if (accountRows.length) {
        await auth.supabase.from("plaid_accounts").upsert(accountRows, {
          onConflict: "account_id",
        });
      }
    } else {
      const sql = getSQL();
      const now = new Date();

      await sql`
        INSERT INTO plaid_connections
        (user_id, item_id, access_token, created_at, updated_at)
        VALUES (${auth.userId}, ${itemId}, ${encrypt(accessToken)}, ${now}, ${now})
        ON CONFLICT (item_id) DO UPDATE SET
          access_token = EXCLUDED.access_token,
          updated_at = EXCLUDED.updated_at
      `;

      for (const account of accounts) {
        await sql`
          INSERT INTO plaid_accounts
          (user_id, item_id, account_id, name, official_name, type, subtype, created_at)
          VALUES (
            ${auth.userId}, ${itemId}, ${account.account_id},
            ${account.name}, ${account.official_name || null},
            ${account.type}, ${account.subtype || null}, ${now}
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error exchanging token:", msg);
    return serverError("Failed to exchange token", msg);
  }
}
