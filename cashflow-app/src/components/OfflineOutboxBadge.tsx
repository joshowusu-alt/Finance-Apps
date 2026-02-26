"use client";

import { useEffect, useState } from "react";
import { getOutbox, SYNC_RETRY_EVENT } from "@/lib/offlineOutbox";
import { PLAN_UPDATED_EVENT } from "@/lib/storage";

/**
 * Sticky pill shown at the bottom of the screen when there are queued changes
 * waiting to sync (e.g. the user was offline when they saved).
 * Tapping "Retry" dispatches SYNC_RETRY_EVENT which CloudSync listens to.
 */
export default function OfflineOutboxBadge() {
  const [count, setCount] = useState(() => typeof window !== "undefined" ? getOutbox().length : 0);
  const [retrying, setRetrying] = useState(false);

  function refresh() {
    setCount(getOutbox().length);
  }

  useEffect(() => {

    // Re-check whenever the plan updates (outbox may have flushed)
    window.addEventListener(PLAN_UPDATED_EVENT, refresh);
    // Re-check on storage changes from other tabs
    window.addEventListener("storage", refresh);
    // Re-check every 15s in case CloudSync silently flushed the queue
    const id = window.setInterval(refresh, 15000);

    return () => {
      window.removeEventListener(PLAN_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.clearInterval(id);
    };
  }, []);

  function handleRetry() {
    setRetrying(true);
    window.dispatchEvent(new Event(SYNC_RETRY_EVENT));
    // Optimistically hide the spinner after 3s; the badge will hide itself
    // when getOutbox() returns empty on the next refresh tick
    setTimeout(() => {
      setRetrying(false);
      refresh();
    }, 3500);
  }

  if (count === 0) return null;

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium"
      style={{
        background: "var(--vn-surface)",
        border: "1px solid var(--vn-border)",
        color: "var(--vn-text)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
      }}
    >
      <span
        className="inline-block w-2 h-2 rounded-full animate-pulse"
        style={{ background: "#f59e0b" }}
      />
      <span className="text-xs">
        {count} change{count !== 1 ? "s" : ""} waiting to sync
      </span>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="ml-1 text-xs font-semibold rounded-full px-3 py-0.5 transition-opacity"
        style={{
          background: "var(--vn-primary)",
          color: "#fff",
          opacity: retrying ? 0.6 : 1,
        }}
      >
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
