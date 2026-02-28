/**
 * vapid.ts
 *
 * Server-side VAPID helpers for Web Push Notifications.
 * Requires env vars:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — base64url-encoded VAPID public key
 *   VAPID_PRIVATE_KEY             — base64url-encoded VAPID private key
 *   VAPID_SUBJECT                 — mailto: or https: contact URI
 *
 * Generate a key pair with:
 *   npx web-push generate-vapid-keys
 */

import webpush from 'web-push';

export function getVapidKeys() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:hello@velanovo.com';

  if (!publicKey || !privateKey) {
    throw new Error(
      'VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.'
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { publicKey, privateKey, subject };
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
};

export async function sendPushNotification(
  subscription: PushSubscriptionJSON,
  payload: PushPayload
) {
  try {
    getVapidKeys(); // ensures VAPID details are set before sending
    await webpush.sendNotification(
      subscription as webpush.PushSubscription,
      JSON.stringify({
        ...payload,
        icon: payload.icon ?? '/icons/icon-192.png',
      })
    );
    return { ok: true };
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    // 410 Gone = subscription expired or revoked by the browser
    return { ok: false, expired: status === 410, error: String(err) };
  }
}
