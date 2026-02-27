"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    async function handleReset() {
        try {
            // Unregister all service workers
            if ("serviceWorker" in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map((r) => r.unregister()));
            }
            // Clear all caches
            if ("caches" in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
            }
        } catch {
            // Best-effort cleanup
        }
        window.location.reload();
    }

    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#0f172a",
                    color: "#f0ede8",
                    fontFamily:
                        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                }}
            >
                <div
                    style={{
                        maxWidth: 400,
                        width: "100%",
                        padding: "2.5rem 1.5rem",
                        textAlign: "center",
                    }}
                >
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
                    <h1
                        style={{
                            fontSize: "1.5rem",
                            fontWeight: 700,
                            marginBottom: "0.5rem",
                        }}
                    >
                        Something went wrong
                    </h1>
                    <p
                        style={{
                            fontSize: "0.875rem",
                            color: "rgba(240,237,232,0.55)",
                            lineHeight: 1.6,
                            marginBottom: "2rem",
                        }}
                    >
                        Velanovo encountered an unexpected error. Your data is safe — try
                        resetting below.
                    </p>

                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                        }}
                    >
                        <button
                            onClick={handleReset}
                            style={{
                                padding: "0.75rem 1.5rem",
                                borderRadius: "0.75rem",
                                border: "none",
                                background: "linear-gradient(135deg, #C5A046, #D4AF5A)",
                                color: "#111318",
                                fontSize: "0.875rem",
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            Reset &amp; Reload
                        </button>
                        <button
                            onClick={() => reset()}
                            style={{
                                padding: "0.75rem 1.5rem",
                                borderRadius: "0.75rem",
                                border: "1px solid rgba(255,255,255,0.15)",
                                background: "transparent",
                                color: "#f0ede8",
                                fontSize: "0.875rem",
                                fontWeight: 500,
                                cursor: "pointer",
                            }}
                        >
                            Try Again
                        </button>
                    </div>

                    {process.env.NODE_ENV === "development" && (
                        <details
                            style={{
                                marginTop: "2rem",
                                textAlign: "left",
                                fontSize: "0.75rem",
                            }}
                        >
                            <summary
                                style={{
                                    cursor: "pointer",
                                    color: "rgba(240,237,232,0.4)",
                                    marginBottom: "0.5rem",
                                }}
                            >
                                Error Details
                            </summary>
                            <pre
                                style={{
                                    background: "rgba(255,255,255,0.05)",
                                    padding: "1rem",
                                    borderRadius: "0.5rem",
                                    overflow: "auto",
                                    maxHeight: "12rem",
                                    color: "#f87171",
                                    fontSize: "0.7rem",
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {error.message}
                                {"\n\n"}
                                {error.stack}
                            </pre>
                        </details>
                    )}
                </div>
            </body>
        </html>
    );
}
