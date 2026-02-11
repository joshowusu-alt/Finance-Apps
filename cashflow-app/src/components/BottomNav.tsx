"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import ThemeToggle from "./ThemeToggle";

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

function IconSettings(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      <path
        d="M19.4 15a8.7 8.7 0 0 0 .05-1l1.6-1.2-1.6-2.8-1.9.5a7.6 7.6 0 0 0-.86-.5l-.3-2H9.6l-.3 2c-.3.14-.58.31-.86.5l-1.9-.5-1.6 2.8L6.6 14a8.7 8.7 0 0 0 0 1l-1.6 1.2 1.6 2.8 1.9-.5c.27.2.56.36.86.5l.3 2h4.8l.3-2c.3-.14.58-.31.86-.5l1.9.5 1.6-2.8L19.4 15Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTransactions(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      <path
        d="M8 10h8M8 14h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBills(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 3h12a2 2 0 0 1 2 2v14l-3-1.5-3 1.5-3-1.5-3 1.5-3-1.5V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      <path
        d="M8 7h8M8 11h8M8 15h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconIncome(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.8"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      <path
        d="M12 8v8M8 12l4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
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


function IconGoals(active: boolean) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
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

const items: NavItem[] = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/timeline", label: "Timeline", icon: IconTimeline },
  { href: "/insights", label: "Insights", icon: IconInsights },
  { href: "/transactions", label: "Transactions", icon: IconTransactions },
  { href: "/bills", label: "Bills", icon: IconBills },
  { href: "/income", label: "Income", icon: IconIncome },
  { href: "/goals", label: "Goals", icon: IconGoals },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-(--border) bg-surface-elevated/95 backdrop-blur-xl md:hidden"
      style={{
        boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.05)",
      }}
      aria-label="Primary"
    >
      <div className="mx-auto max-w-5xl px-2">
        <div className="flex items-center justify-around py-1">
          {items.map((it) => {
            const active = isActive(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                className="relative"
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className="relative flex flex-col items-center gap-1 rounded-2xl px-3 py-2.5 text-xs"
                >
                  {/* Active indicator background */}
                  {active && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-2xl bg-accent/15"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}

                  {/* Icon with animation */}
                  <motion.span
                    className={`relative ${active ? "text-accent" : "text-(--text-secondary)"}`}
                    animate={{
                      scale: active ? 1.05 : 1,
                      y: active ? -1 : 0,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    {it.icon(active)}
                  </motion.span>

                  {/* Label */}
                  <span
                    className={`relative text-[11px] ${active
                      ? "text-accent font-bold"
                      : "text-(--text-tertiary) font-medium"
                      }`}
                  >
                    {it.label}
                  </span>
                </motion.div>
              </Link>
            );
          })}

          {/* Theme Toggle */}
          <div className="px-1">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Bottom safe area for notched devices */}
      <div className="h-[env(safe-area-inset-bottom)] bg-surface-elevated/95" />
    </motion.nav>
  );
}
