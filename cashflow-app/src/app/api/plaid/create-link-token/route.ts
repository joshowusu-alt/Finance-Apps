import { NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV || "sandbox";

  if (!clientId || !secret) {
    throw new Error("Missing Plaid credentials. Check PLAID_CLIENT_ID and PLAID_SECRET in .env.local");
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

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    let effectiveUserId = userId as string | undefined;

    if (!effectiveUserId) {
      const supabase = await createClient();
      const user = supabase ? (await supabase.auth.getUser()).data.user : null;
      if (user) effectiveUserId = user.id;
    }

    if (!effectiveUserId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const client = getPlaidClient();

    const response = await client.linkTokenCreate({
      user: {
        client_user_id: effectiveUserId,
      },
      client_name: "Velanovo",
      products: [Products.Transactions, Products.Auth],
      country_codes: [CountryCode.Gb],
      language: "en",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error: any) {
    console.error("Error creating link token:", error.response?.data || error.message);
    return NextResponse.json(
      { error: "Failed to create link token", details: error.message },
      { status: 500 }
    );
  }
}
