import { NextRequest, NextResponse } from 'next/server';
import { getSQL } from '@/lib/db';
import { sendPushNotification } from '@/lib/vapid';

export const runtime = 'nodejs';

/**
 * GET /api/cron/push-alerts
 *
 * Vercel Cron job (schedule: 0 8 * * * — 08:00 UTC daily).
 * Sends a personalised daily push notification to every subscribed user.
 * Personalisation is derived from the user's saved plan in main_plans;
 * if no plan is found the message falls back to a generic summary.
 * Expired subscriptions (HTTP 410) are automatically pruned.
 *
 * Required env vars:
 *   CRON_SECRET                    — shared secret verified via Authorization header
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY   — VAPID public key
 *   VAPID_PRIVATE_KEY              — VAPID private key
 */

// ---------------------------------------------------------------------------
// Alert message builder
// ---------------------------------------------------------------------------

type AlertPayload = { title: string; body: string; url: string };

function buildAlertMessage(planJson: string): AlertPayload | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plan: Record<string, any> = JSON.parse(planJson);

    // Find the most recent/active period (plans store periods sorted oldest→newest)
    const periods: Array<Record<string, unknown>> = plan.periods ?? [];
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Prefer the period whose start ≤ today ≤ end; otherwise use the last one.
    const period: Record<string, unknown> =
      periods.find(
        (p) =>
          typeof p.start === 'string' &&
          typeof p.end === 'string' &&
          p.start <= todayStr &&
          p.end >= todayStr,
      ) ??
      periods[periods.length - 1] ??
      {};

    // ── 1. Bills due in the next 2 days ──────────────────────────────────
    type BillLike = { dueDay?: number; label?: string; paid?: boolean };
    const billTemplates: BillLike[] = (plan.bills ?? []) as BillLike[];
    const dueSoon = billTemplates.filter((b) => {
      if (!b.dueDay || b.paid) return false;
      const dueDate = new Date(today.getFullYear(), today.getMonth(), b.dueDay);
      if (dueDate < today) dueDate.setMonth(dueDate.getMonth() + 1);
      const diffDays = Math.ceil(
        (dueDate.getTime() - today.getTime()) / 86_400_000,
      );
      return diffDays >= 0 && diffDays <= 2;
    });

    if (dueSoon.length > 0) {
      const bill = dueSoon[0];
      return {
        title: `Bill due soon — ${bill.label ?? 'upcoming'}`,
        body:
          dueSoon.length > 1
            ? `${dueSoon.length} bills are due in the next 2 days. Don't forget to mark them paid.`
            : `${bill.label ?? 'A bill'} is due in 1–2 days. Don't forget to mark it paid.`,
        url: '/bills',
      };
    }

    // ── 2. Low running balance ────────────────────────────────────────────
    type TxnLike = { type?: string; amount?: number };
    const transactions: TxnLike[] =
      (period.transactions as TxnLike[] | undefined) ??
      (plan.transactions as TxnLike[] | undefined) ??
      [];
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + (t.amount ?? 0), 0);
    const expenses = transactions
      .filter((t) => t.type !== 'income')
      .reduce((s, t) => s + (t.amount ?? 0), 0);
    const setup = (plan.setup ?? {}) as Record<string, unknown>;
    const openingBalance =
      (setup.openingBalance as number | undefined) ??
      (setup.startingBalance as number | undefined) ??
      0;
    const runningBalance = openingBalance + income - expenses;

    if (runningBalance < 100) {
      return {
        title: 'Low balance alert',
        body:
          runningBalance < 0
            ? 'Your running balance is negative. Review your spending.'
            : `Your running balance is only £${Math.round(runningBalance)}. Review your spending.`,
        url: '/',
      };
    }

    // ── 3. Default daily summary ──────────────────────────────────────────
    const periodEnd = period.end as string | undefined;
    const daysLeft = periodEnd
      ? Math.max(
          0,
          Math.ceil(
            (new Date(periodEnd).getTime() - today.getTime()) / 86_400_000,
          ),
        )
      : 0;

    if (daysLeft > 0) {
      type RuleLike = { amount?: number };
      const outflowBudget = (
        (plan.outflowRules as RuleLike[] | undefined) ?? []
      ).reduce((s, r) => s + (r.amount ?? 0), 0);
      const spent = transactions
        .filter((t) => t.type !== 'income')
        .reduce((s, t) => s + (t.amount ?? 0), 0);
      const remaining = outflowBudget - spent;
      const dailyBudget = remaining > 0 ? Math.round(remaining / daysLeft) : 0;

      return {
        title: 'Velanovo · Daily check-in',
        body:
          dailyBudget > 0
            ? `You have £${dailyBudget}/day to spend with ${daysLeft} days left this period.`
            : 'Check your cashflow summary.',
        url: '/',
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cron handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = getSQL();

  let sent = 0;
  let pruned = 0;

  // Process in batches to avoid memory issues at scale
  const BATCH_SIZE = 500;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // LEFT JOIN main_plans so we can build personalised messages.
    // plan_token_hash is written by POST /api/push/subscribe for
    // anonymous-token users; Supabase users will have NULL plan_json.
    const subs = (await sql`
      SELECT
        ps.user_id,
        ps.subscription_json,
        mp.plan_json
      FROM push_subscriptions ps
      LEFT JOIN main_plans mp ON mp.token_hash = ps.plan_token_hash
      LIMIT ${BATCH_SIZE} OFFSET ${offset}
    `) as {
      user_id: string;
      subscription_json: unknown;
      plan_json: unknown;
    }[];

    if (subs.length < BATCH_SIZE) hasMore = false;
    offset += BATCH_SIZE;

    for (const sub of subs) {
      // subscription_json is a JSONB column; normalise to an object.
      const parsed =
        typeof sub.subscription_json === 'string'
          ? (JSON.parse(sub.subscription_json) as PushSubscriptionJSON)
          : (sub.subscription_json as unknown as PushSubscriptionJSON);

      // Resolve plan JSON to a string if the DB returned a JSONB object.
      const planJsonStr: string | null =
        typeof sub.plan_json === 'string'
          ? sub.plan_json
          : sub.plan_json != null
          ? JSON.stringify(sub.plan_json)
          : null;

      // Build personalised payload; fall back to generic summary.
      const alert = planJsonStr ? buildAlertMessage(planJsonStr) : null;
      const payload: AlertPayload = alert ?? {
        title: 'Velanovo — Daily Check',
        body: 'Your cashflow summary is ready.',
        url: '/',
      };

      const result = await sendPushNotification(parsed, payload);

      if (result.ok) {
        sent++;
      } else if (result.expired) {
        // Prune dead subscription so we don't keep hitting a 410.
        await sql`
          DELETE FROM push_subscriptions
          WHERE user_id = ${sub.user_id} AND endpoint = ${parsed.endpoint ?? ''}
        `;
        pruned++;
      }
    }
  }

  return NextResponse.json({ ok: true, sent, pruned });
}
