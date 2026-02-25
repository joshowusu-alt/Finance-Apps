/**
 * offlineOutbox — localStorage queue for mutations that failed while offline.
 *
 * When a cloud-sync push fails (network error / auth expiry), the payload is
 * written here. On the next successful sync cycle CloudSync replays the queue
 * in chronological order before issuing new pushes.
 */

export const SYNC_RETRY_EVENT = "cashflow_sync_retry";

const OUTBOX_KEY = "cashflow_offline_outbox_v1";

export type OutboxPlanEntry = {
  id: string;
  type: "plan";
  payload: {
    user_id: string;
    scenario_id: string;
    plan_json: unknown;
    prev_plan_json: unknown;
    updated_at: string;
  };
  timestamp: number;
};

export type OutboxEntry = OutboxPlanEntry;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function getOutbox(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export function addToOutbox(entry: Omit<OutboxEntry, "id" | "timestamp">): void {
  try {
    const outbox = getOutbox();
    const newEntry: OutboxEntry = {
      ...entry,
      id: `${entry.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    } as OutboxEntry;
    outbox.push(newEntry);
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  } catch {
    // localStorage may be full; silently skip
  }
}

// ---------------------------------------------------------------------------
// Remove / clear
// ---------------------------------------------------------------------------

export function removeFromOutbox(id: string): void {
  try {
    const outbox = getOutbox().filter((e) => e.id !== id);
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  } catch {
    // ignore
  }
}

export function clearOutbox(): void {
  try {
    localStorage.removeItem(OUTBOX_KEY);
  } catch {
    // ignore
  }
}
