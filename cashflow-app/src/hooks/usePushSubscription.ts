'use client';

import { useEffect, useState } from 'react';

/**
 * usePushSubscription
 *
 * Manages the Web Push subscription lifecycle from the client side.
 *
 * - Checks browser support on mount
 * - `subscribe()` prompts the user, registers the SW push subscription,
 *   and persists it server-side via POST /api/push/subscribe
 * - `unsubscribe()` removes the subscription from the browser and server
 */
export function usePushSubscription() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsSupported('serviceWorker' in navigator && 'PushManager' in window);
  }, []);

  async function subscribe() {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setIsSubscribed(true);
    } catch (e) {
      console.error('Push subscribe failed', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe() {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
        setIsSubscribed(false);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe };
}
