"use client";

import { useEffect, useState } from "react";
import { SW_UPDATE_EVENT } from "@/components/ServiceWorkerRegistrar";

export default function UpdateBanner() {
    const [waiting, setWaiting] = useState<ServiceWorkerRegistration | null>(null);
    const [updating, setUpdating] = useState(false);
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        function handleUpdate(e: Event) {
            const reg = (e as CustomEvent).detail?.registration as
                | ServiceWorkerRegistration
                | undefined;
            if (reg) setWaiting(reg);
        }

        window.addEventListener(SW_UPDATE_EVENT, handleUpdate);
        return () => window.removeEventListener(SW_UPDATE_EVENT, handleUpdate);
    }, []);

    // Auto-apply after countdown reaches 0
    useEffect(() => {
        if (!waiting) return;
        if (countdown <= 0) {
            handleApply();
            return;
        }
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [waiting, countdown]);

    if (!waiting) return null;

    function handleApply() {
        if (!waiting?.waiting) return;
        setUpdating(true);

        // Tell the waiting SW to skip waiting and activate
        waiting.waiting.postMessage({ type: "SKIP_WAITING" });

        // Reload once the new SW takes control
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            window.location.reload();
        });

        // Safety timeout — reload anyway after 3 seconds
        setTimeout(() => window.location.reload(), 3000);
    }

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                padding: "0.625rem 1rem",
                background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
                borderBottom: "1px solid rgba(197,160,70,0.25)",
                color: "#f0ede8",
                fontSize: "0.8125rem",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
        >
            <span>✨ A new version of Velanovo is available</span>
            <button
                onClick={handleApply}
                disabled={updating}
                style={{
                    padding: "0.25rem 0.875rem",
                    borderRadius: "0.5rem",
                    border: "none",
                    background: "linear-gradient(135deg, #C5A046, #D4AF5A)",
                    color: "#111318",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: updating ? "wait" : "pointer",
                    opacity: updating ? 0.7 : 1,
                }}
            >
                {updating ? "Updating…" : countdown > 0 ? `Update Now (${countdown})` : "Updating…"}
            </button>
            <button
                onClick={() => setWaiting(null)}
                aria-label="Dismiss"
                style={{
                    padding: "0.25rem",
                    border: "none",
                    background: "transparent",
                    color: "rgba(240,237,232,0.5)",
                    cursor: "pointer",
                    fontSize: "1rem",
                    lineHeight: 1,
                }}
            >
                ✕
            </button>
        </div>
    );
}
