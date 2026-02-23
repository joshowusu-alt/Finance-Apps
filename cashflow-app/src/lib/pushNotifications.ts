/**
 * pushNotifications.ts
 *
 * Local (browser) push notifications — no server required.
 * Fires when the user has the app open or re-focuses the tab.
 * Uses the Web Notifications API + a cooldown log in localStorage.
 */

const NOTIF_STATE_KEY = "cashflow_notif_state_v1";

/** 4-hour cooldown per alert so we don't spam the user */
const DEFAULT_COOLDOWN_MS = 4 * 60 * 60 * 1000;

type NotifState = {
  enabled: boolean;
  lastFired: Record<string, number>; // alertId → timestamp (ms)
};

function loadState(): NotifState {
  if (typeof window === "undefined") return { enabled: false, lastFired: {} };
  try {
    const raw = localStorage.getItem(NOTIF_STATE_KEY);
    if (!raw) return { enabled: false, lastFired: {} };
    return { enabled: false, lastFired: {}, ...JSON.parse(raw) };
  } catch {
    return { enabled: false, lastFired: {} };
  }
}

function saveState(state: NotifState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIF_STATE_KEY, JSON.stringify(state));
}

// ─── Public API ────────────────────────────────────────────────────────────

export function isNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationsSupported()) return "unsupported";
  return Notification.permission;
}

/** True only when permission is granted AND the user has opted in */
export function isNotificationsEnabled(): boolean {
  if (!isNotificationsSupported()) return false;
  if (Notification.permission !== "granted") return false;
  return loadState().enabled;
}

/** Ask the OS for notification permission and, if granted, mark as enabled */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  const result = await Notification.requestPermission();
  if (result === "granted") {
    const state = loadState();
    saveState({ ...state, enabled: true });
    return true;
  }
  return false;
}

export function enableNotifications() {
  const state = loadState();
  saveState({ ...state, enabled: true });
}

export function disableNotifications() {
  const state = loadState();
  saveState({ ...state, enabled: false });
}

/**
 * Fire a notification for the given alertId.
 * Silently drops it if notifications are disabled, permission is missing,
 * or the same alertId fired within the cooldown window.
 *
 * @returns true if the notification was actually fired
 */
export function fireAlertNotification(
  alertId: string,
  title: string,
  body: string,
  href?: string,
  cooldownMs = DEFAULT_COOLDOWN_MS
): boolean {
  if (!isNotificationsEnabled()) return false;

  const state = loadState();
  const now = Date.now();
  const lastFired = state.lastFired[alertId] ?? 0;

  if (now - lastFired < cooldownMs) return false;

  try {
    const n = new Notification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: `cashflow-${alertId}`, // collapses duplicate notifications
      requireInteraction: false,
    });

    n.onclick = () => {
      window.focus();
      if (href) window.location.href = href;
      n.close();
    };

    state.lastFired[alertId] = now;
    saveState(state);
    return true;
  } catch {
    return false;
  }
}

/** Reset the cooldown for all alerts (useful after plan changes) */
export function resetNotificationCooldowns() {
  const state = loadState();
  saveState({ ...state, lastFired: {} });
}
