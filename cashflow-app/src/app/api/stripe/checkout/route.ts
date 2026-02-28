import { NextResponse } from "next/server";
import Stripe from "stripe";
import { resolveAuthWithCookie } from "@/lib/apiHelpers";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

export async function POST() {
  const auth = await resolveAuthWithCookie();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://cashflow-app-eight.vercel.app";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{
      price: process.env.STRIPE_PRO_PRICE_ID!,
      quantity: 1,
    }],
    success_url: `${origin}/settings?upgrade=success`,
    cancel_url: `${origin}/settings?upgrade=canceled`,
    metadata: { userId: auth.userId },
    subscription_data: {
      metadata: { userId: auth.userId },
    },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
