"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactElement;
};

function IconHome(active: boolean) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity={active ? 1 : 0.75}
      />
    </svg>
  );
}

function IconTimeline(active: boolean) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 3v3M17 3v3M4 8h16M6 12h6M6 16h10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={active ? 1 : 0.75}
      />
      <path
        d="M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity={active ? 1 : 0.75}
      />
    </svg>
  );
}

function IconSettings(active: boolean) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity={active ? 1 : 0.75}
      />
      <path
        d="M19.4 15a8.7 8.7 0 0 0 .05-1l1.6-1.2-1.6-2.8-1.9.5a7.6 7.6 0 0 0-.86-.5l-.3-2H9.6l-.3 2c-.3.14-.58.31-.86.5l-1.9-.5-1.6 2.8L6.6 14a8.7 8.7 0 0 0 0 1l-1.6 1.2 1.6 2.8 1.9-.5c.27.2.56.36.86.5l.3 2h4.8l.3-2c.3-.14.58-.31.86-.5l1.9.5 1.6-2.8L19.4 15Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity={active ? 1 : 0.75}
      />
    </svg>
  );
}

function IconTransactions(active: boolean) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2v20M2 12h20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={active ? 1 : 0.75}
      />
      <path
        d="M18 6l-6 6m0 0l-6 6m6-6l6 6m-6-6l-6-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={active ? 1 : 0.75}
      />
    </svg>
  );
}

function IconBills(active: boolean) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 3h12a2 2 0 0 1 2 2v14l-3-1.5-3 1.5-3-1.5-3 1.5-3-1.5V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity={active ? 1 : 0.75}
      />
      <path
        d="M8 7h8M8 11h8M8 15h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={active ? 1 : 0.75}
      />
    </svg>
  );
}

function IconIncome(active: boolean) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 4v16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={active ? 1 : 0.75}
      />
      <path
        d="M7 9l5-5 5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={active ? 1 : 0.75}
      />
      <path
        d="M4 19h16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={active ? 1 : 0.75}
      />
    </svg>
  );
}

function IconInsights(active: boolean) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 19V5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={active ? 1 : 0.75}
      />
      <path
        d="M8 19V11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={active ? 1 : 0.75}
      />
      <path
        d="M12 19V7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={active ? 1 : 0.75}
      />
      <path
        d="M16 19V9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={active ? 1 : 0.75}
      />
      <path
        d="M20 19V13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={active ? 1 : 0.75}
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
  { href: "/settings", label: "Settings", icon: IconSettings },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-slate-950/70 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex items-center justify-around py-2">
          {items.map((it) => {
            const active = isActive(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs",
                  active ? "text-white" : "text-zinc-400 hover:text-zinc-200",
                ].join(" ")}
              >
                <span className="text-zinc-200">{it.icon(active)}</span>
                <span className={active ? "font-semibold" : ""}>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
