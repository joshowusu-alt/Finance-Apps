import { NextResponse } from "next/server";
import { Products, CountryCode } from "plaid";
import { getPlaidClient } from "@/lib/plaid";
import { resolveAuthWithCookie, badRequest, serverError } from "@/lib/apiHelpers";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";

const checkLinkTokenLimit = createRateLimiter(10, 60_000);

export async function POST(_req: Request) {
  try {
    const auth = await resolveAuthWithCookie();

    if (!auth) {
      return badRequest("Unauthorized");
    }

    if (!(await checkLinkTokenLimit(auth.userId))) {
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
