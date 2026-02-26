"use client";

import { useState } from "react";
import { Playfair_Display, Outfit, Space_Grotesk, Inter } from "next/font/google";

// Font loaders
const playfair = Playfair_Display({ subsets: ["latin"] });
const outfit = Outfit({ subsets: ["latin"] });
const space = Space_Grotesk({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

// --- LOGO COMPONENTS ---

function LogoOption1({ className }: { className?: string }) {
    // Centurion V: Stately, Editorial, Serif
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-amber-500/20 shadow-lg shadow-amber-500/10">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-amber-400">
                    <path d="M12 2L2 22h20L12 2z" fill="currentColor" opacity="0.2" />
                    <path d="M7 6L12 16L17 6" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                    <path d="M2 2h20" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
                </svg>
            </div>
            <div>
                <div className={`${playfair.className} text-xl font-bold tracking-tight text-slate-900 dark:text-white`}>
                    Velanovo
                </div>
                <div className={`${inter.className} text-[10px] tracking-widest uppercase text-slate-500 dark:text-slate-400`}>
                    Private Wealth
                </div>
            </div>
        </div>
    );
}

function LogoOption2({ className }: { className?: string }) {
    // North Star: Modern, Geometric, Tech
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <div className="relative flex h-10 w-10 items-center justify-center bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor" />
                </svg>
            </div>
            <div>
                <div className={`${outfit.className} text-xl font-bold tracking-tight text-slate-900 dark:text-white`}>
                    velanovo
                </div>
                <div className={`${outfit.className} text-[10px] font-medium text-slate-500 dark:text-slate-400`}>
                    Future Finance
                </div>
            </div>
        </div>
    );
}

function LogoOption3({ className }: { className?: string }) {
    // Abstract Monogram: Contemporary, Minimal
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 border dark:border-slate-700">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-slate-900 dark:text-white">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 8l8 8" stroke="currentColor" strokeWidth="2" />
                    <path d="M16 8l-8 8" stroke="currentColor" strokeWidth="2" />
                </svg>
            </div>
            <div className={`${space.className}`}>
                <div className="text-xl font-bold uppercase tracking-widest text-slate-900 dark:text-white">
                    VN
                </div>
            </div>
        </div>
    );
}

export default function BrandOptionsPage() {
    const [selected, setSelected] = useState<number | null>(null);

    return (
        <main className="min-h-screen bg-white dark:bg-slate-950 p-8 md:p-12 transition-colors duration-300">
            <div className="mx-auto max-w-4xl">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Brand Identity Studio</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-12">Select visual direction for Velanovo.</p>

                <div className="grid gap-12">

                    {/* OPTION 1: THE ELITE */}
                    <section className="group cursor-pointer" onClick={() => setSelected(1)}>
                        <div className={`relative overflow-hidden rounded-3xl border-2 transition-all duration-300 ${selected === 1 ? "border-amber-400 bg-slate-50 dark:bg-slate-900/50" : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"}`}>
                            <div className="absolute top-0 right-0 p-4">
                                <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${selected === 1 ? "border-amber-500 bg-amber-500 text-white" : "border-slate-300"}`}>
                                    {selected === 1 && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}
                                </div>
                            </div>

                            <div className="p-8 md:p-12">
                                <div className="mb-8">
                                    <span className="inline-block px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-4">Option 1: The Elite</span>
                                    <h2 className={`${playfair.className} text-4xl font-bold text-slate-900 dark:text-white mb-2`}>Timeless Luxury</h2>
                                    <p className="text-slate-500 dark:text-slate-400 max-w-lg">
                                        Editorial typography paired with deep sapphire and gold.
                                        Uses <strong>Playfair Display</strong> for headlines to evoke heritage and prestige, suitable for high-net-worth branding.
                                    </p>
                                </div>

                                <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
                                    <LogoOption1 className="scale-125 origin-left" />

                                    <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                                        <div className="h-12 w-24 rounded-lg bg-slate-900" />
                                        <div className="h-12 w-24 rounded-lg bg-amber-400" />
                                    </div>
                                </div>

                                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8 font-serif">
                                    <div className={`${playfair.className} p-6 rounded-xl bg-slate-50 dark:bg-slate-800`}>
                                        <div className="text-2xl font-bold mb-2">£1,250,000</div>
                                        <div className="text-sm opacity-60 italic">Total Net Worth</div>
                                    </div>
                                    <div className={`${playfair.className} p-6 rounded-xl bg-slate-50 dark:bg-slate-800`}>
                                        <div className="text-2xl font-bold mb-2">+12.5%</div>
                                        <div className="text-sm opacity-60 italic">Annual Growth</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* OPTION 2: THE MODERNIST */}
                    <section className="group cursor-pointer" onClick={() => setSelected(2)}>
                        <div className={`relative overflow-hidden rounded-3xl border-2 transition-all duration-300 ${selected === 2 ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10" : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"}`}>
                            <div className="absolute top-0 right-0 p-4">
                                <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${selected === 2 ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300"}`}>
                                    {selected === 2 && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}
                                </div>
                            </div>

                            <div className="p-8 md:p-12">
                                <div className="mb-8">
                                    <span className="inline-block px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-4">Option 2: The Modernist</span>
                                    <h2 className={`${outfit.className} text-4xl font-bold text-slate-900 dark:text-white mb-2`}>Geometric Clarity</h2>
                                    <p className="text-slate-500 dark:text-slate-400 max-w-lg">
                                        Clean, approachable, and tech-forward.
                                        Uses <strong>Outfit</strong> for a friendly yet professional vibe.
                                        Focuses on clarity and data visualization.
                                    </p>
                                </div>

                                <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
                                    <LogoOption2 className="scale-125 origin-left" />

                                    <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                                        <div className="h-12 w-24 rounded-lg bg-blue-600" />
                                        <div className="h-12 w-24 rounded-lg bg-slate-200 dark:bg-slate-700" />
                                    </div>
                                </div>

                                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className={`${outfit.className} p-6 rounded-xl bg-slate-50 dark:bg-slate-800`}>
                                        <div className="text-3xl font-bold mb-2 tracking-tight">£1.25M</div>
                                        <div className="text-xs font-semibold uppercase tracking-wider opacity-60">Total Net Worth</div>
                                    </div>
                                    <div className={`${outfit.className} p-6 rounded-xl bg-slate-50 dark:bg-slate-800`}>
                                        <div className="text-3xl font-bold mb-2 tracking-tight text-green-500">▲ 12.5%</div>
                                        <div className="text-xs font-semibold uppercase tracking-wider opacity-60">Annual Growth</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* OPTION 3: THE FUTURIST */}
                    <section className="group cursor-pointer" onClick={() => setSelected(3)}>
                        <div className={`relative overflow-hidden rounded-3xl border-2 transition-all duration-300 ${selected === 3 ? "border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800/50" : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"}`}>
                            <div className="absolute top-0 right-0 p-4">
                                <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${selected === 3 ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-black" : "border-slate-300"}`}>
                                    {selected === 3 && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}
                                </div>
                            </div>

                            <div className="p-8 md:p-12">
                                <div className="mb-8">
                                    <span className="inline-block px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider mb-4">Option 3: The Futurist</span>
                                    <h2 className={`${space.className} text-4xl font-bold text-slate-900 dark:text-white mb-2`}>High-Fashion Tech</h2>
                                    <p className="text-slate-500 dark:text-slate-400 max-w-lg">
                                        Bold, monospaced-inspired, and brutalist.
                                        Uses <strong>Space Grotesk</strong> for a stark, confident statement.
                                        Minimalist monochromatic palette.
                                    </p>
                                </div>

                                <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
                                    <LogoOption3 className="scale-125 origin-left" />

                                    <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                                        <div className="h-12 w-24 rounded-full border border-slate-900 dark:border-white" />
                                        <div className="h-12 w-24 rounded-full bg-slate-900 dark:bg-white" />
                                    </div>
                                </div>

                                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className={`${space.className} p-6 rounded-xl border border-slate-200 dark:border-slate-700`}>
                                        <div className="text-4xl font-medium mb-2">1.2M</div>
                                        <div className="text-xs uppercase tracking-widest opacity-60">Net Worth</div>
                                    </div>
                                    <div className={`${space.className} p-6 rounded-xl border border-slate-200 dark:border-slate-700`}>
                                        <div className="text-4xl font-medium mb-2">+12%</div>
                                        <div className="text-xs uppercase tracking-widest opacity-60">Growth</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                </div>
            </div>
        </main>
    );
}
