"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";
import { showToast } from "./Toast";

type NavItem = {
  href: string;
  label: string;
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
  { href: "/plan", label: "Plan", icon: IconPlan },
  { href: "/timeline", label: "Timeline", icon: IconTimeline },
  { href: "/insights", label: "Insights", icon: IconInsights },
];

const moreItems: NavItem[] = [
  { href: "/transactions", label: "Transactions", icon: () => <span className="text-lg">💳</span> },
  { href: "/bills", label: "Bills", icon: () => <span className="text-lg">📄</span> },
  { href: "/income", label: "Income", icon: () => <span className="text-lg">💰</span> },
  { href: "/goals", label: "Goals", icon: () => <span className="text-lg">🎯</span> },
  { href: "/coach", label: "Coach", icon: () => <span className="text-lg">🤖</span> },
  { href: "/settings", label: "Settings", icon: () => <span className="text-lg">⚙️</span> },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));
  const isMoreActive = moreItems.some((it) => isActive(it.href));

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
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-40 rounded-t-3xl pb-28 md:hidden"
              style={{ background: "var(--vn-surface)", border: "1px solid var(--vn-border)" }}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="h-1 w-10 rounded-full bg-[var(--vn-border)]" />
              </div>
              <div className="px-6 py-2">
                <div className="grid grid-cols-4 gap-4">
                  {moreItems.map((it) => (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={() => setShowMore(false)}
                      className="flex flex-col items-center gap-2 rounded-2xl py-4 transition-colors hover:bg-[var(--vn-bg)]"
                    >
                      {it.icon(isActive(it.href))}
                      <span className={`text-xs font-medium ${isActive(it.href) ? "text-[var(--vn-primary)]" : "text-[var(--vn-muted)]"}`}>
                        {it.label}
                      </span>
                    </Link>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
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
      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-(--border) bg-surface-elevated/95 backdrop-blur-xl md:hidden"
        style={{ boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.05)" }}
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
                    whileTap={{ scale: 0.9 }}
                    className="relative flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 text-xs"
                  >
                    {active && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 rounded-2xl bg-accent/15"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <motion.span
                      className={`relative ${active ? "text-accent" : "text-(--text-secondary)"}`}
                      animate={{ scale: active ? 1.05 : 1, y: active ? -1 : 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                      {it.icon(active)}
                    </motion.span>
                    <span className={`relative text-[11px] ${active ? "text-accent font-bold" : "text-(--text-tertiary) font-medium"}`}>
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
                whileTap={{ scale: 0.9 }}
                className="relative flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 text-xs"
              >
                {(showMore || isMoreActive) && (
                  <motion.div
                    layoutId={showMore ? undefined : "activeTab"}
                    className="absolute inset-0 rounded-2xl bg-accent/15"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <motion.span
                  className={`relative ${showMore || isMoreActive ? "text-accent" : "text-(--text-secondary)"}`}
                  animate={{ scale: showMore ? 1.05 : 1, y: showMore ? -1 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  {IconMore(showMore || isMoreActive)}
                </motion.span>
                <span className={`relative text-[11px] ${showMore || isMoreActive ? "text-accent font-bold" : "text-(--text-tertiary) font-medium"}`}>
                  More
                </span>
              </motion.div>
            </button>
          </div>
        </div>

        {/* Bottom safe area for notched devices */}
        <div className="h-[env(safe-area-inset-bottom)] bg-surface-elevated/95" />
      </motion.nav>
    </>
  );
}
