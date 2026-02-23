"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { VelanovoLogo } from "./VelanovoLogo";
import { useEffect, useState } from "react";
import { loadPlan, savePlan, PLAN_UPDATED_EVENT } from "@/lib/storage";
import type { Period } from "@/data/plan";

// Sidebar navigation component

type SidebarNavProps = {
  periodLabel?: string;
  periodStart?: string;
  periodEnd?: string;
};

const items = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  {
    href: "/plan",
    label: "Plan",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    )
  },
  {
    href: "/timeline",
    label: "Timeline",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    href: "/insights",
    label: "Insights",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  {
    href: "/transactions",
    label: "Transactions",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    href: "/bills",
    label: "Bills",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    href: "/income",
    label: "Income",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    )
  },
  {
    href: "/goals",
    label: "Goals",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    href: "/networth",
    label: "Net Worth",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    )
  },
  {
    href: "/envelopes",
    label: "Envelopes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    href: "/year",
    label: "Year Review",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    )
  },
  {
    href: "/import",
    label: "Import",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    )
  },
  {
    href: "/coach",
    label: "Coach",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    )
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
];

export default function SidebarNav({ periodLabel, periodStart, periodEnd }: SidebarNavProps) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname?.startsWith(href));

  // Self-contained period state — loads from storage, syncs with all pages
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number>(0);
  const [displayLabel, setDisplayLabel] = useState(periodLabel || "");
  const [displayStart, setDisplayStart] = useState(periodStart || "");
  const [displayEnd, setDisplayEnd] = useState(periodEnd || "");

  useEffect(() => {
    const refresh = () => {
      try {
        const plan = loadPlan();
        setPeriods(plan.periods);
        setSelectedPeriodId(plan.setup.selectedPeriodId);
        const sel = plan.periods.find(p => p.id === plan.setup.selectedPeriodId);
        if (sel) {
          setDisplayLabel(sel.label);
          setDisplayStart(sel.start);
          setDisplayEnd(sel.end);
        }
      } catch { /* ignore SSR */ }
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(PLAN_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(PLAN_UPDATED_EVENT, refresh);
    };
  }, []);

  function handlePeriodChange(id: number) {
    const plan = loadPlan();
    savePlan({ ...plan, setup: { ...plan.setup, selectedPeriodId: id } });
    setSelectedPeriodId(id);
    const sel = plan.periods.find(p => p.id === id);
    if (sel) {
      setDisplayLabel(sel.label);
      setDisplayStart(sel.start);
      setDisplayEnd(sel.end);
    }
  }

  return (
    <aside
      className="hidden lg:flex flex-col gap-5 self-start sticky top-5 overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #0f172a 0%, #0c1626 60%, #091220 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "20px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)",
        minHeight: "calc(100vh - 40px)",
        position: "relative",
      }}
    >
      {/* Subtle gold glow */}
      <div style={{
        position: "absolute", top: -80, right: -80,
        width: 260, height: 260,
        background: "radial-gradient(circle, rgba(168,115,26,0.18), transparent 65%)",
        pointerEvents: "none", borderRadius: "50%",
      }} />

      {/* Logo */}
      <div className="flex items-center px-6 pt-6 pb-2 relative">
        <VelanovoLogo size={30} showWordmark={true} />
      </div>

      {/* Navigation */}
      <nav className="space-y-0.5 text-sm flex-1 px-3 relative overflow-y-auto" aria-label="Main navigation">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} className="block relative" aria-current={active ? "page" : undefined} aria-label={item.label}>
              <motion.div
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.98 }}
                className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200"
                style={{
                  color: active ? "#d4a843" : "rgba(240,237,232,0.62)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                {active && (
                  <motion.div
                    layoutId="sidebarActiveTab"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: "rgba(212,168,67,0.12)", border: "1px solid rgba(212,168,67,0.18)" }}
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {active && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                    style={{ background: "#d4a843" }}
                  />
                )}
                <motion.span
                  className="relative z-10"
                  animate={{ scale: active ? 1.05 : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  {item.icon}
                </motion.span>
                <span className="relative z-10 text-[13px] tracking-[-0.01em]">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Period Switcher */}
      <div
        className="mx-3 mb-4 px-4 py-3 rounded-xl"
        style={{ background: "rgba(212,168,67,0.08)", border: "1px solid rgba(212,168,67,0.16)" }}
      >
        <div className="flex items-center gap-2 text-xs font-semibold mb-2" style={{ color: "#d4a843" }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Budget Period</span>
        </div>
        {periods.length > 1 ? (
          <select
            value={selectedPeriodId}
            onChange={(e) => handlePeriodChange(Number(e.target.value))}
            className="w-full rounded-lg text-xs font-medium px-2 py-1.5 focus:outline-none"
            style={{ background: "rgba(212,168,67,0.12)", border: "1px solid rgba(212,168,67,0.2)", color: "#d4a843" }}
          >
            {periods.map(p => (
              <option key={p.id} value={p.id} style={{ background: "#0f172a" }}>{p.label}</option>
            ))}
          </select>
        ) : (
          <div className="text-xs font-semibold" style={{ color: "#d4a843" }}>{displayLabel || periodLabel || "Current Period"}</div>
        )}
        {(displayStart || periodStart) && (displayEnd || periodEnd) && (
          <div className="text-[11px] mt-1.5" style={{ color: "rgba(240,237,232,0.4)" }}>
            {(displayStart || periodStart)} → {(displayEnd || periodEnd)}
          </div>
        )}
      </div>
    </aside>
  );
}
