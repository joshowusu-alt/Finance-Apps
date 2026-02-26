"use client";

import { useEffect, useState } from "react";
import { loadPlan, loadPreviousPlan, setStorageScope } from "@/lib/storage";

type MigrationStatus = "idle" | "loading" | "success" | "error";

export default function MigratePage() {
    const [status, setStatus] = useState<MigrationStatus>("idle");
    const [message, setMessage] = useState("");
    const [vercelLink, setVercelLink] = useState("");
    const [planSummary, setPlanSummary] = useState<string | null>(null);

    useEffect(() => {
        // Show a summary of what's in localStorage
        try {
            const plan = loadPlan();
            const txCount = plan.transactions?.length || 0;
            const billCount = plan.bills?.length || 0;
            const overrideCount = plan.overrides?.length || 0;
            setPlanSummary(`${txCount} transactions, ${billCount} bills, ${overrideCount} overrides`);
        } catch {
            setPlanSummary("No data found in this browser");
        }
    }, []);

    async function handleMigrate() {
        setStatus("loading");
        setMessage("Preparing your data...");

        try {
            // Load current localStorage data
            const plan = loadPlan();
            const prevPlan = loadPreviousPlan();

            setMessage("Creating sync session...");

            // Bootstrap or connect to main sync
            const bootstrapRes = await fetch("/api/main/bootstrap", {
                method: "POST",
                credentials: "include",
            });

            if (!bootstrapRes.ok) {
                throw new Error("Failed to create sync session");
            }

            setMessage("Pushing data to database...");

            // Push localStorage data to database
            const syncRes = await fetch("/api/main/plan", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan, prevPlan }),
                credentials: "include",
            });

            if (!syncRes.ok) {
                throw new Error("Failed to sync data");
            }

            // Get the link
            const linkRes = await fetch("/api/main/link", {
                method: "POST",
                credentials: "include",
            });
            const linkData = await linkRes.json() as { token?: string; publicUrl?: string };

            if (!linkData.token) {
                throw new Error("Failed to get sync token");
            }

            // Switch to main scope for future use
            setStorageScope("main");

            // Build the Vercel link
            const baseUrl = "https://cashflow-app-eight.vercel.app";
            const link = `${baseUrl}/main?token=${encodeURIComponent(linkData.token)}`;
            setVercelLink(link);

            setStatus("success");
            setMessage("Data migrated successfully!");
        } catch (error) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Migration failed");
        }
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
                <h1 className="text-2xl font-bold text-white mb-2">📦 Migrate Your Data</h1>
                <p className="text-slate-300 text-sm mb-6">
                    Transfer your cashflow data from this browser to the cloud database for access anywhere.
                </p>

                {planSummary && (
                    <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
                        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Data in this browser</div>
                        <div className="text-white font-semibold">{planSummary}</div>
                    </div>
                )}

                {status === "idle" && (
                    <button
                        onClick={handleMigrate}
                        className="w-full py-4 px-6 bg-linear-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-2xl shadow-lg hover:from-emerald-600 hover:to-teal-600 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        🚀 Migrate to Cloud
                    </button>
                )}

                {status === "loading" && (
                    <div className="text-center py-8">
                        <div className="animate-spin w-12 h-12 border-4 border-white/20 border-t-emerald-400 rounded-full mx-auto mb-4"></div>
                        <div className="text-slate-300">{message}</div>
                    </div>
                )}

                {status === "success" && (
                    <div className="space-y-4">
                        <div className="bg-amber-400/20 border border-amber-400/40 rounded-xl p-4">
                            <div className="text-amber-400 font-semibold mb-1">✅ {message}</div>
                            <div className="text-amber-300/80 text-sm">Your data is now in the cloud.</div>
                        </div>

                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Your Vercel Link</div>
                            <div className="bg-slate-900/50 rounded-lg p-3 text-sm text-white break-all font-mono">
                                {vercelLink}
                            </div>
                            <button
                                onClick={() => {
                                    if (navigator.clipboard?.writeText) {
                                        navigator.clipboard.writeText(vercelLink);
                                    }
                                    window.open(vercelLink, "_blank");
                                }}
                                className="mt-3 w-full py-2 px-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors"
                            >
                                📋 Copy & Open Link
                            </button>
                        </div>

                        <p className="text-slate-400 text-xs text-center">
                            Bookmark the Vercel link for future access from any device!
                        </p>
                    </div>
                )}

                {status === "error" && (
                    <div className="space-y-4">
                        <div className="bg-rose-500/20 border border-rose-400/40 rounded-xl p-4">
                            <div className="text-rose-300 font-semibold">❌ {message}</div>
                        </div>
                        <button
                            onClick={() => setStatus("idle")}
                            className="w-full py-3 px-6 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
