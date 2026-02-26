"use client";


import { useState } from "react";

function ThemeCard({
    title,
    description,
    colors,
    font,
    isActive,
    onClick,
}: {
    title: string;
    description: string;
    colors: { bg: string; text: string; accent: string; panel: string };
    font: string;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`relative overflow-hidden rounded-2xl border text-left transition-all duration-300 ${isActive ? "ring-2 ring-offset-2 scale-105 shadow-xl" : "hover:scale-[1.02] opacity-80 hover:opacity-100"
                }`}
            style={{
                backgroundColor: colors.bg,
                color: colors.text,
                borderColor: isActive ? colors.accent : "transparent",
                fontFamily: font,
            }}
        >
            <div className="p-6">
                <div className="mb-2 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colors.accent }} />
                    <h3 className="text-xl font-bold">{title}</h3>
                </div>
                <p className="mb-6 opacity-70 text-sm">{description}</p>

                {/* Mini UI Preview */}
                <div
                    className="rounded-xl p-4 shadow-sm"
                    style={{ backgroundColor: colors.panel }}
                >
                    <div className="mb-3 flex justify-between">
                        <div className="h-2 w-16 rounded-full opacity-20" style={{ backgroundColor: colors.text }} />
                        <div className="h-2 w-8 rounded-full opacity-20" style={{ backgroundColor: colors.text }} />
                    </div>
                    <div className="mb-1 text-2xl font-semibold">£4,850.00</div>
                    <div className="text-xs opacity-60">+12% vs last month</div>

                    <div className="mt-4 flex gap-2">
                        <div className="h-8 flex-1 rounded-lg opacity-90" style={{ backgroundColor: colors.accent }} />
                        <div className="h-8 w-8 rounded-lg border opacity-20" style={{ borderColor: colors.text }} />
                    </div>
                </div>
            </div>
        </button>
    );
}

export default function DesignOptionsPage() {
    const [activeTheme, setActiveTheme] = useState("onyx");

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 text-slate-900 dark:text-slate-100">
            <div className="mx-auto max-w-5xl">
                <h1 className="mb-2 text-3xl font-bold">Design Studio</h1>
                <p className="mb-8 text-slate-500 dark:text-slate-400">Select a theme to preview the premium feel.</p>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* Option 1: Onyx & Gold */}
                    <ThemeCard
                        title="Onyx & Gold"
                        description="Ultra-premium luxury. Matte dark surfaces with striking gold accents. Inspired by AMEX Centurion."
                        colors={{
                            bg: "#0f172a", // Slate 900
                            text: "#f8fafc", // Slate 50
                            accent: "#fbbf24", // Gold
                            panel: "#1e293b", // Slate 800
                        }}
                        font="serif"
                        isActive={activeTheme === "onyx"}
                        onClick={() => setActiveTheme("onyx")}
                    />

                    {/* Option 2: Sapphire Trust */}
                    <ThemeCard
                        title="Sapphire Trust"
                        description="Deep, rich confidence. Sophisticated navy gradients with silver details. Trustworthy & professional."
                        colors={{
                            bg: "#f0f9ff", // Sky 50
                            text: "#0c4a6e", // Sky 900
                            accent: "#0284c7", // Sky 600
                            panel: "#ffffff",
                        }}
                        font="sans-serif"
                        isActive={activeTheme === "sapphire"}
                        onClick={() => setActiveTheme("sapphire")}
                    />

                    {/* Option 3: Platinum Minimal */}
                    <ThemeCard
                        title="Platinum Minimal"
                        description="Clean, high-key aesthetics. White marble textures, subtle shadows, and metallic typography. Modern wealth."
                        colors={{
                            bg: "#ffffff",
                            text: "#171717", // Neutral 900
                            accent: "#525252", // Neutral 600
                            panel: "#f5f5f5", // Neutral 100
                        }}
                        font="sans-serif"
                        isActive={activeTheme === "platinum"}
                        onClick={() => setActiveTheme("platinum")}
                    />
                </div>

                {/* Large Preview */}
                <div className="mt-12 rounded-3xl border shadow-2xl overflow-hidden transition-colors duration-500"
                    style={{
                        backgroundColor: activeTheme === "onyx" ? "#0f172a" : activeTheme === "sapphire" ? "#f0f9ff" : "#ffffff",
                        color: activeTheme === "onyx" ? "#f8fafc" : activeTheme === "sapphire" ? "#0c4a6e" : "#171717",
                        fontFamily: activeTheme === "onyx" ? "Times New Roman, serif" : "inherit"
                    }}
                >
                    <div className="border-b p-6 flex justify-between items-center" style={{ borderColor: activeTheme === "onyx" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }}>
                        <div className="font-bold tracking-tight">Velanovo <span style={{ opacity: 0.5 }}>Premium</span></div>
                        <div className="text-sm opacity-60">Connected</div>
                    </div>

                    <div className="p-8 grid gap-8 md:grid-cols-2">
                        <div>
                            <div className="text-sm opacity-60 mb-1">Total Net Worth</div>
                            <div className="text-5xl font-bold mb-6" style={{
                                background: activeTheme === "onyx"
                                    ? "linear-gradient(to right, #fbbf24, #d97706)"
                                    : activeTheme === "sapphire"
                                        ? "linear-gradient(to right, #0284c7, #0369a1)"
                                        : "linear-gradient(to right, #404040, #171717)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent"
                            }}>£142,850.00</div>

                            <div className="p-6 rounded-2xl mb-4" style={{ backgroundColor: activeTheme === "onyx" ? "#1e293b" : "#ffffff", boxShadow: "0 4px 20px -2px rgba(0,0,0,0.1)" }}>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold">Monthly Spending</h3>
                                    <button className="text-xs px-3 py-1 rounded-full border" style={{ borderColor: "currentColor", opacity: 0.5 }}>Filter</button>
                                </div>
                                <div className="h-32 flex items-end gap-2 opacity-80">
                                    {[40, 65, 30, 85, 50, 60, 90].map((h, i) => (
                                        <div key={i} className="flex-1 rounded-t-sm transition-all hover:opacity-80" style={{
                                            height: `${h}%`,
                                            backgroundColor: activeTheme === "onyx" ? "#fbbf24" : activeTheme === "sapphire" ? "#0284c7" : "#171717"
                                        }} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Transaction Item */}
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="p-4 rounded-xl flex items-center justify-between" style={{ backgroundColor: activeTheme === "onyx" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" }}>
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: activeTheme === "onyx" ? "rgba(251, 191, 36, 0.2)" : "rgba(0,0,0,0.05)", color: activeTheme === "onyx" ? "#fbbf24" : "currentColor" }}>
                                            {i === 1 ? "W" : i === 2 ? "A" : "S"}
                                        </div>
                                        <div>
                                            <div className="font-medium">Premium Merchant {i}</div>
                                            <div className="text-xs opacity-50">Today, 12:4{i} PM</div>
                                        </div>
                                    </div>
                                    <div className="font-mono font-semibold">-£{i * 24}.50</div>
                                </div>
                            ))}

                            <button className="w-full py-4 rounded-xl font-bold mt-4 transition-transform hover:scale-[1.01] active:scale-[0.99]" style={{
                                backgroundColor: activeTheme === "onyx" ? "#fbbf24" : activeTheme === "sapphire" ? "#0284c7" : "#171717",
                                color: activeTheme === "onyx" ? "#1e293b" : "#ffffff"
                            }}>
                                View All Activity
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
