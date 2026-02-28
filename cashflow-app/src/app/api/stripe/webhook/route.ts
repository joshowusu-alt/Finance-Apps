import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

function getPeriodEnd(sub: Stripe.Subscription): string {
  const item = sub.items?.data?.[0];
  if (item && "current_period_end" in item) {
    return new Date((item as Stripe.SubscriptionItem & { current_period_end: number }).current_period_end * 1000).toISOString();
  }
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL!);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      if (userId && subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await sql`
          INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, updated_at)
          VALUES (
            ${userId}, ${customerId}, ${subscriptionId}, 'pro',
            ${getPeriodEnd(sub)},
            NOW()
          )
          ON CONFLICT (user_id) DO UPDATE SET
            stripe_customer_id = EXCLUDED.stripe_customer_id,
            stripe_subscription_id = EXCLUDED.stripe_subscription_id,
            status = 'pro',
            current_period_end = EXCLUDED.current_period_end,
            updated_at = NOW()
        `;
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) {
        const status =
          sub.status === "active" ? "pro" :
          sub.status === "trialing" ? "trialing" :
          sub.status === "past_due" ? "past_due" : "canceled";
        await sql`
          UPDATE subscriptions SET
            status = ${status},
            current_period_end = ${getPeriodEnd(sub)},
            cancel_at_period_end = ${sub.cancel_at_period_end},
            updated_at = NOW()
          WHERE stripe_subscription_id = ${sub.id}
        `;
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
