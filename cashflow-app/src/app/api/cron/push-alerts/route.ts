import { NextRequest, NextResponse } from 'next/server';
import { getSQL } from '@/lib/db';
import { sendPushNotification } from '@/lib/vapid';

export const runtime = 'nodejs';

/**
 * GET /api/cron/push-alerts
 *
 * Vercel Cron job (schedule: 0 8 * * * — 08:00 UTC daily).
 * Sends a daily cashflow summary push notification to every subscribed user.
 * Expired subscriptions (HTTP 410) are automatically pruned.
 *
 * Required env vars:
 *   CRON_SECRET                    — shared secret verified via Authorization header
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY   — VAPID public key
 *   VAPID_PRIVATE_KEY              — VAPID private key
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = getSQL();

  const subs = (await sql`
    SELECT user_id, subscription_json FROM push_subscriptions
  `) as { user_id: string; subscription_json: unknown }[];

  let sent = 0;
  let pruned = 0;

  for (const sub of subs) {
    // subscription_json is a JSONB column; cast as needed
    const parsed =
      typeof sub.subscription_json === 'string'
        ? (JSON.parse(sub.subscription_json) as PushSubscriptionJSON)
        : (sub.subscription_json as unknown as PushSubscriptionJSON);

    const result = await sendPushNotification(parsed, {
      title: 'Velanovo — Daily Check',
      body: 'Your cashflow summary is ready.',
      url: '/',
    });

    if (result.ok) {
      sent++;
    } else if (result.expired) {
      // Prune dead subscription so we don't keep hitting a 410
      await sql`
        DELETE FROM push_subscriptions
        WHERE user_id = ${sub.user_id} AND endpoint = ${parsed.endpoint ?? ''}
      `;
      pruned++;
    }
  }

  return NextResponse.json({ ok: true, sent, pruned });
}
