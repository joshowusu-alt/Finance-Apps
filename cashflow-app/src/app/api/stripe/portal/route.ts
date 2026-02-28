import { NextResponse } from "next/server";
import Stripe from "stripe";
import { resolveAuthWithCookie } from "@/lib/apiHelpers";
import { getUserSubscription } from "@/lib/subscription";

export async function POST() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
  const auth = await resolveAuthWithCookie();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = await getUserSubscription(auth.userId);
  if (!sub.stripeCustomerId) {
    return NextResponse.json({ error: "No subscription found" }, { status: 404 });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://cashflow-app-eight.vercel.app";
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${origin}/settings`,
  });

  return NextResponse.json({ url: session.url });
}
