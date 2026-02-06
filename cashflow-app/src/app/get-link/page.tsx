"use client";

import { useEffect, useState } from "react";

export default function GetLinkPage() {
    const [link, setLink] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function getLink() {
            try {
                const res = await fetch("/api/main/link", {
                    method: "POST",
                    credentials: "include",
                });

                if (!res.ok) {
                    throw new Error("Failed to get link");
                }

                const data = await res.json() as { token?: string; publicUrl?: string };

                if (!data.token) {
                    throw new Error("No sync token found. Open the app on your phone first.");
                }

                const baseUrl = "https://cashflow-app-eight.vercel.app";
                setLink(`${baseUrl}/main?token=${encodeURIComponent(data.token)}`);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to get link");
            } finally {
                setLoading(false);
            }
        }

        getLink();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
                <h1 className="text-2xl font-bold text-white mb-4">🔗 Your Sync Link</h1>

                {loading && (
                    <div className="flex items-center gap-3 text-slate-300">
                        <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-emerald-400 rounded-full"></div>
                        Getting your link...
                    </div>
                )}

                {error && (
                    <div className="bg-rose-500/20 border border-rose-400/40 rounded-xl p-4 text-rose-300">
                        {error}
                    </div>
                )}

                {link && (
                    <div className="space-y-4">
                        <p className="text-slate-300 text-sm">
                            Copy this link and open it on your laptop to sync your data:
                        </p>

                        <div className="bg-slate-900/50 rounded-xl p-4 break-all text-sm text-amber-400 font-mono">
                            {link}
                        </div>

                        <button
                            onClick={() => {
                                navigator.clipboard?.writeText(link);
                                alert("Link copied!");
                            }}
                            className="w-full py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg hover:from-emerald-600 hover:to-teal-600 transition-all"
                        >
                            📋 Copy Link
                        </button>

                        <p className="text-slate-400 text-xs text-center">
                            You can also share this link via email or messaging app.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
