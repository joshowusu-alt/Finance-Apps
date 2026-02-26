import { NextResponse } from "next/server";
import { Products, CountryCode } from "plaid";
import { getPlaidClient } from "@/lib/plaid";
import { resolveAuth, badRequest, serverError } from "@/lib/apiHelpers";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";

const checkLinkTokenLimit = createRateLimiter(10, 60_000);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    const auth = await resolveAuth(userId);

    if (!auth) {
      return badRequest("Missing userId");
    }

    if (!checkLinkTokenLimit(auth.userId)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error creating link token:", msg);
    return serverError("Failed to create link token", msg);
  }
}
