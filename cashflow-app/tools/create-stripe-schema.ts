import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id           TEXT NOT NULL UNIQUE,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      status            TEXT NOT NULL DEFAULT 'free',
      plan_id           TEXT,
      current_period_end TIMESTAMPTZ,
      cancel_at_period_end BOOLEAN DEFAULT false,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_sub_idx ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL`;
  console.log("Stripe schema created");
}

main().catch(console.error);
