import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthWithCookie, apiError } from '@/lib/apiHelpers';
import { getSQL } from '@/lib/db';
import { hashToken } from '@/lib/tokenPlanBase';

export const runtime = 'nodejs';

/**
 * POST /api/push/subscribe
 * Register (or refresh) a push subscription for the authenticated user.
 * Upserts by (user_id, endpoint) so a user can have multiple devices.
 *
 * Also stores plan_token_hash so the daily cron can JOIN main_plans to
 * build personalised push alerts for anonymous-token users.
 */
export async function POST(req: NextRequest) {
  const auth = await resolveAuthWithCookie();
  if (!auth) return apiError('Unauthorized', 401);

  const subscription = await req.json();
  if (!subscription?.endpoint) return apiError('Invalid subscription', 400);

  const sql = getSQL();

  // Idempotent schema migration — safe to run on every subscribe call.
  await sql`
    ALTER TABLE push_subscriptions
    ADD COLUMN IF NOT EXISTS plan_token_hash TEXT
  `;

  // For anonymous-token users store the hashed token so the cron can
  // JOIN main_plans.  Supabase users leave this null (plan is in Supabase).
  const planTokenHash =
    auth.mode === 'main-token' ? hashToken(auth.userId) : null;

  await sql`
    INSERT INTO push_subscriptions
      (user_id, endpoint, subscription_json, plan_token_hash, updated_at)
    VALUES
      (${auth.userId}, ${subscription.endpoint}, ${JSON.stringify(subscription)}, ${planTokenHash}, NOW())
    ON CONFLICT (user_id, endpoint) DO UPDATE SET
      subscription_json = EXCLUDED.subscription_json,
      plan_token_hash   = EXCLUDED.plan_token_hash,
      updated_at        = NOW()
  `;

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/push/subscribe
 * Remove a push subscription for the authenticated user.
 */
export async function DELETE(req: NextRequest) {
  const auth = await resolveAuthWithCookie();
  if (!auth) return apiError('Unauthorized', 401);

  const body = await req.json();
  const endpoint: string | undefined = body?.endpoint;
  if (!endpoint) return apiError('Missing endpoint', 400);

  const sql = getSQL();
  await sql`
    DELETE FROM push_subscriptions
    WHERE user_id = ${auth.userId} AND endpoint = ${endpoint}
  `;

  return NextResponse.json({ ok: true });
}
