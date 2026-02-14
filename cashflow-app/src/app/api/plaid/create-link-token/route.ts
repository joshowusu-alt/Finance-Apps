import { NextResponse } from "next/server";
import { Products, CountryCode } from "plaid";
import { getPlaidClient } from "@/lib/plaid";
import { resolveAuth, badRequest, serverError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    const auth = await resolveAuth(userId);

    if (!auth) {
      return badRequest("Missing userId");
    }

    const client = getPlaidClient();

    const response = await client.linkTokenCreate({
      user: { client_user_id: auth.userId },
      client_name: "Velanovo",
      products: [Products.Transactions, Products.Auth],
      country_codes: [CountryCode.Gb],
      language: "en",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error: any) {
    console.error("Error creating link token:", error.response?.data || error.message);
    return serverError("Failed to create link token", error.message);
  }
}
