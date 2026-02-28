"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";
import { loadPlan, savePlan, PLAN_UPDATED_EVENT } from "@/lib/storage";
import { detectRecurringBills } from "@/lib/billDetection";
import type { Period } from "@/data/plan";

type NavItem = {
  href: string;
  label: string;
  desc?: string;
  icon: (active: boolean) => React.ReactElement;
};

function IconHome(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  );
}

function IconPlan(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconTimeline(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 3v3M17 3v3M4 8h16M6 12h6M6 16h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  );
}

function IconInsights(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 3v15a3 3 0 0 0 3 3h15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 17V12M13 17V8M18 17V14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  );
}

function IconMore(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="5" r="1.5" fill="currentColor" opacity={active ? 1 : 0.7} />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity={active ? 1 : 0.7} />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" opacity={active ? 1 : 0.7} />
    </svg>
  );
}

function IconTransactions(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 10h18M3 6h18M3 14h10M17 17l3 3m0 0l-3 3m3-3H14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  );
}

function IconBills(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 5H7a2 2 0 0 0-2 2v14l3-2 3 2 3-2 3 2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 7h6m-6 4h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  );
}

function IconIncome(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  );
}

function IconGoals(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm0-6a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  );
}

function IconNetWorth(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  );
}

function IconEnvelopes(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  );
}

function IconImport(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  );
}

function IconYearReview(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 0 0 .95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 0 0-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 0 0-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 0 0-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 0 0 .951-.69l1.519-4.674z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  );
}

function IconCoach(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-5 5v-5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  );
}

function IconHousehold(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSettings(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      <path
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const primaryItems: NavItem[] = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/plan", label: "Budget", icon: IconPlan },
  { href: "/transactions", label: "Transactions", icon: IconTransactions },
  { href: "/insights", label: "Insights", icon: IconInsights },
];

const moreItems: NavItem[] = [
  { href: "/timeline", label: "Calendar", desc: "Cashflow timeline", icon: IconTimeline },
  { href: "/bills", label: "Bills", desc: "Recurring bills", icon: IconBills },
  { href: "/income", label: "Income", desc: "Income rules", icon: IconIncome },
  { href: "/goals", label: "Goals", desc: "Save targets", icon: IconGoals },
  { href: "/networth", label: "Net Worth", desc: "Financial position", icon: IconNetWorth },
  { href: "/envelopes", label: "Envelopes", desc: "Zero-based budgets", icon: IconEnvelopes },
  { href: "/import", label: "Import", desc: "Upload data", icon: IconImport },
  { href: "/year", label: "Year Review", desc: "Annual summary", icon: IconYearReview },
  { href: "/coach", label: "Coach", desc: "AI advisor", icon: IconCoach },
  { href: "/household", label: "Household", desc: "Shared finances", icon: IconHousehold },
  { href: "/settings", label: "Settings", desc: "Preferences", icon: IconSettings },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));
  const isMoreActive = moreItems.some((it) => isActive(it.href));

  // Period switcher state
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number>(0);
  const [isOverspending, setIsOverspending] = useState(false);
  const [billSuggestionCount, setBillSuggestionCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try {
        const plan = loadPlan();
        setPeriods(plan.periods);
        setSelectedPeriodId(plan.setup.selectedPeriodId);
        // Lightweight overspend check
        const txns = plan.transactions ?? [];
        const income = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const outflows = txns.filter((t) => t.type === "outflow").reduce((s, t) => s + t.amount, 0);
        setIsOverspending(income > 0 && outflows > income * 0.9);
        try {
          const dismissed = new Set<string>(
            JSON.parse(localStorage.getItem("cashflow_dismissed_bill_suggestions") ?? "[]") as string[]
          );
          const detected = detectRecurringBills(plan.transactions ?? [], plan.bills ?? []);
          setBillSuggestionCount(detected.filter((b) => !dismissed.has(b.id)).length);
        } catch { /* ignore */ }
      } catch { /* ignore */ }
    };
    refresh();
    window.addEventListener(PLAN_UPDATED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(PLAN_UPDATED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const handlePeriodChange = (id: number) => {
    try {
      const plan = loadPlan();
      savePlan({ ...plan, setup: { ...plan.setup, selectedPeriodId: id } });
      setSelectedPeriodId(id);
      window.dispatchEvent(new Event(PLAN_UPDATED_EVENT));
    } catch { /* ignore */ }
  };

  return (
    <>
      {/* More sheet */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              key="more-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setShowMore(false)}
            />
            <motion.div
              key="more-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.28, ease: [0.4, 0.0, 0.2, 1] }}
              className="fixed bottom-0 left-0 right-0 z-40 rounded-t-3xl md:hidden"
              style={{ background: "var(--vn-surface)", border: "1px solid var(--vn-border)", maxHeight: "85dvh", overflowY: "auto" }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 1 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 300) setShowMore(false);
              }}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="h-1 w-10 rounded-full bg-(--vn-border)" />
              </div>
              {/* Scrollable content with safe area bottom padding */}
              <div className="px-6 py-2 pb-28">{/* pb-28 clears the tab bar */}
                <p className="text-[11px] uppercase tracking-widest font-semibold mb-3" style={{ color: "var(--vn-muted)" }}>All features</p>
                <div className="grid grid-cols-4 gap-3">
                  {moreItems.map((it) => (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={() => setShowMore(false)}
                      className="flex flex-col items-center gap-1 rounded-2xl py-3 px-1 transition-colors hover:bg-(--vn-bg)"
                    >
                      <div className="relative">
                        {it.icon(isActive(it.href))}
                        {it.href === "/bills" && billSuggestionCount > 0 && (
                          <span
                            className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2"
                            style={{ background: "#d4a843", borderColor: "var(--vn-surface)" }}
                          >
                            {billSuggestionCount}
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] font-semibold leading-tight text-center ${isActive(it.href) ? "text-(--vn-primary)" : "text-(--vn-text)"}`}>
                        {it.label}
                      </span>
                      {it.desc && (
                        <span className="text-[9px] leading-tight text-center" style={{ color: "var(--vn-muted)" }}>{it.desc}</span>
                      )}
                    </Link>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {periods.length > 1 && (
                    <div className="rounded-2xl px-4 py-3 bg-(--vn-bg)">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-(--vn-text) shrink-0">Period</span>
                        {periods.length <= 4 ? (
                          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                            {periods.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => handlePeriodChange(p.id)}
                                className="shrink-0 min-h-8 rounded-full px-3 py-1 text-xs font-medium transition-colors"
                                style={
                                  p.id === selectedPeriodId
                                    ? { background: "var(--vn-primary)", color: "#fff" }
                                    : { background: "var(--vn-surface)", color: "var(--vn-muted)", border: "1px solid var(--vn-border)" }
                                }
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                const idx = periods.findIndex(p => p.id === selectedPeriodId);
                                if (idx > 0) handlePeriodChange(periods[idx - 1].id);
                              }}
                              className="flex items-center justify-center w-7 h-7 rounded-full transition-colors hover:bg-(--vn-border)"
                              style={{ color: "var(--vn-muted)" }}
                              aria-label="Previous period"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                            </button>
                            <span className="text-xs font-semibold min-w-20 text-center" style={{ color: "var(--vn-primary)" }}>
                              {periods.find(p => p.id === selectedPeriodId)?.label ?? ""}
                            </span>
                            <button
                              onClick={() => {
                                const idx = periods.findIndex(p => p.id === selectedPeriodId);
                                if (idx < periods.length - 1) handlePeriodChange(periods[idx + 1].id);
                              }}
                              className="flex items-center justify-center w-7 h-7 rounded-full transition-colors hover:bg-(--vn-border)"
                              style={{ color: "var(--vn-muted)" }}
                              aria-label="Next period"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between rounded-2xl px-4 py-3 bg-(--vn-bg)">
                    <span className="text-sm font-medium text-(--vn-text)">Theme</span>
                    <ThemeToggle />
                  </div>
                  <Link
                    href="/insights"
                    onClick={() => setShowMore(false)}
                    className="flex w-full items-center justify-between rounded-2xl px-4 py-3 bg-(--vn-bg) hover:bg-(--vn-border) transition-colors"
                  >
                    <span className="text-sm font-medium text-(--vn-text)">Export (PDF / CSV)</span>
                    <span className="text-xs text-(--vn-muted)">via Insights</span>
                  </Link>
                  <div className="flex items-center justify-between rounded-2xl px-4 py-3 bg-(--vn-bg) opacity-50">
                    <span className="text-sm font-medium text-(--vn-text)">Connected Accounts</span>
                    <span className="text-xs text-(--vn-muted)">Coming soon</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl md:hidden"
        style={{ background: "var(--vn-surface)", borderTopColor: "var(--vn-border)", boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.08)" }}
        aria-label="Primary"
      >
        <div className="mx-auto max-w-5xl px-2">
          <div className="flex items-center justify-around py-1">
            {primaryItems.map((it) => {
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className="relative"
                  onClick={() => setShowMore(false)}
                >
                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    className="relative flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 text-xs"
                  >
                    {active && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 rounded-2xl"
                        style={{ background: "var(--gold-soft)" }}
                        transition={{ duration: 0.2, ease: [0.4, 0.0, 0.2, 1] }}
                      />
                    )}
                    <motion.span
                      className="relative"
                      style={{ color: active ? "var(--gold)" : "var(--text-tertiary)" }}
                      animate={{ scale: active ? 1.04 : 1, y: active ? -1 : 0 }}
                      transition={{ duration: 0.2, ease: [0.4, 0.0, 0.2, 1] }}
                    >
                      {it.icon(active)}
                      {it.href === "/insights" && isOverspending && !active && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 border border-(--vn-surface)" />
                      )}
                    </motion.span>
                    <span
                      className={`relative text-[11px] ${active ? "font-medium" : "font-normal"}`}
                      style={{ color: active ? "var(--gold)" : "var(--text-tertiary)" }}
                    >
                      {it.label}
                    </span>
                  </motion.div>
                </Link>
              );
            })}

            {/* More button */}
            <button
              onClick={() => setShowMore((v) => !v)}
              className="relative"
            >
              <motion.div
                whileTap={{ scale: 0.98 }}
                className="relative flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 text-xs"
              >
                {(showMore || isMoreActive) && (
                  <motion.div
                    layoutId={showMore ? undefined : "activeTab"}
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: "var(--gold-soft)" }}
                    transition={{ duration: 0.2, ease: [0.4, 0.0, 0.2, 1] }}
                  />
                )}
                <motion.span
                  className="relative"
                  style={{ color: showMore || isMoreActive ? "var(--gold)" : "var(--text-tertiary)" }}
                  animate={{ scale: showMore ? 1.04 : 1, y: showMore ? -1 : 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0.0, 0.2, 1] }}
                >
                  {IconMore(showMore || isMoreActive)}
                </motion.span>
                <span
                  className={`relative text-[11px] ${showMore || isMoreActive ? "font-medium" : "font-normal"}`}
                  style={{ color: showMore || isMoreActive ? "var(--gold)" : "var(--text-tertiary)" }}
                >
                  More
                </span>
              </motion.div>
            </button>
          </div>
        </div>

        {/* Bottom safe area for notched devices */}
        <div className="h-[env(safe-area-inset-bottom)]" style={{ background: "var(--vn-surface)" }} />
      </nav>
    </>
  );
}
