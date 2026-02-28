import { neon } from "@neondatabase/serverless";

export type SubscriptionStatus = "free" | "pro" | "trialing" | "past_due" | "canceled";

export interface UserSubscription {
  status: SubscriptionStatus;
  isPro: boolean;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

const FREE_SUB: UserSubscription = { status: "free", isPro: false };

export async function getUserSubscription(userId: string): Promise<UserSubscription> {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`
      SELECT status, current_period_end, cancel_at_period_end,
             stripe_customer_id, stripe_subscription_id
      FROM subscriptions WHERE user_id = ${userId} LIMIT 1
    `;
    if (!rows.length) return FREE_SUB;
    const row = rows[0];
    const status = row.status as SubscriptionStatus;
    return {
      status,
      isPro: status === "pro" || status === "trialing",
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
    };
  } catch {
    return FREE_SUB;
  }
}

export async function upsertSubscription(
  userId: string,
  data: Partial<Omit<UserSubscription, "isPro">> & {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  }
): Promise<void> {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    INSERT INTO subscriptions (user_id, status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end, updated_at)
    VALUES (
      ${userId},
      ${data.status ?? "free"},
      ${data.stripeCustomerId ?? null},
      ${data.stripeSubscriptionId ?? null},
      ${data.currentPeriodEnd ?? null},
      ${data.cancelAtPeriodEnd ?? false},
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      status = EXCLUDED.status,
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
      stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
      current_period_end = EXCLUDED.current_period_end,
      cancel_at_period_end = EXCLUDED.cancel_at_period_end,
      updated_at = NOW()
  `;
}
