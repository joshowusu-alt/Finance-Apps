import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthWithCookie, apiError } from '@/lib/apiHelpers';
import { getSQL } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * POST /api/push/subscribe
 * Register (or refresh) a push subscription for the authenticated user.
 * Upserts by (user_id, endpoint) so a user can have multiple devices.
 */
export async function POST(req: NextRequest) {
  const auth = await resolveAuthWithCookie();
  if (!auth) return apiError('Unauthorized', 401);

  const subscription = await req.json();
  if (!subscription?.endpoint) return apiError('Invalid subscription', 400);

  const sql = getSQL();
  await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, subscription_json, updated_at)
    VALUES (${auth.userId}, ${subscription.endpoint}, ${JSON.stringify(subscription)}, NOW())
    ON CONFLICT (user_id, endpoint) DO UPDATE SET
      subscription_json = EXCLUDED.subscription_json,
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
