/**
 * create-push-schema.ts
 *
 * One-time migration: creates the push_subscriptions table in Neon Postgres.
 *
 * Usage:
 *   npx tsx tools/create-push-schema.ts
 */

import { getSQL } from '../src/lib/db';

async function main() {
  const sql = getSQL();

  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      user_id          TEXT        NOT NULL,
      endpoint         TEXT        NOT NULL,
      subscription_json JSONB      NOT NULL,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, endpoint)
    )
  `;

  console.log('✓ push_subscriptions table ready');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
