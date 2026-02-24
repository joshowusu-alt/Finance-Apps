"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";
import { loadPlan, savePlan, PLAN_UPDATED_EVENT } from "@/lib/storage";
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

const primaryItems: NavItem[] = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/plan", label: "Budget", icon: IconPlan },
  { href: "/timeline", label: "Calendar", icon: IconTimeline },
  { href: "/insights", label: "Insights", icon: IconInsights },
];

const moreItems: NavItem[] = [
  { href: "/transactions", label: "Transactions", desc: "Log expenses", icon: () => <span className="text-lg">💳</span> },
  { href: "/bills", label: "Bills", desc: "Recurring bills", icon: () => <span className="text-lg">📄</span> },
  { href: "/income", label: "Income", desc: "Income rules", icon: () => <span className="text-lg">💰</span> },
  { href: "/goals", label: "Goals", desc: "Save targets", icon: () => <span className="text-lg">🎯</span> },
  { href: "/networth", label: "Net Worth", desc: "Financial position", icon: () => <span className="text-lg">📊</span> },
  { href: "/import", label: "Import", desc: "Upload data", icon: () => <span className="text-lg">📂</span> },
  { href: "/coach", label: "Coach", desc: "AI advisor", icon: () => <span className="text-lg">🤖</span> },
  { href: "/settings", label: "Settings", desc: "Preferences", icon: () => <span className="text-lg">⚙️</span> },
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
                <div className="h-1 w-10 rounded-full bg-[var(--vn-border)]" />
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
                      className="flex flex-col items-center gap-1 rounded-2xl py-3 px-1 transition-colors hover:bg-[var(--vn-bg)]"
                    >
                      {it.icon(isActive(it.href))}
                      <span className={`text-[11px] font-semibold leading-tight text-center ${isActive(it.href) ? "text-[var(--vn-primary)]" : "text-[var(--vn-text)]"}`}>
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
                    <div className="flex items-center justify-between rounded-2xl px-4 py-3 bg-(--vn-bg)">
                      <span className="text-sm font-medium text-(--vn-text)">Period</span>
                      <select
                        value={selectedPeriodId}
                        onChange={(e) => handlePeriodChange(Number(e.target.value))}
                        className="text-xs font-semibold text-(--vn-primary) bg-transparent border-none outline-none cursor-pointer"
                      >
                        {periods.map((p) => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
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
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 border border-[var(--vn-surface)]" />
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
