"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useBranding } from "@/hooks/useBranding";
import { requestNotificationPermission, isNotificationsEnabled } from "@/lib/pushNotifications";

export function InsightsStep() {
  const brand = useBranding();
  const [notifState, setNotifState] = useState<"idle" | "granted" | "denied">("idle");

  useState(() => {
    if (typeof window !== "undefined" && isNotificationsEnabled()) setNotifState("granted");
    return true;
  });

  async function enableNotifications() {
    const granted = await requestNotificationPermission();
    setNotifState(granted ? "granted" : "denied");
  }
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <div
          className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "color-mix(in srgb, var(--vn-info) 12%, transparent)" }}
        >
          <svg
            className="h-7 w-7"
            style={{ color: "var(--vn-info)" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <h2
          className="text-xl md:text-2xl font-bold"
          style={{ color: "var(--vn-text)", fontFamily: "var(--font-playfair), serif" }}
        >
          See Your Financial Future
        </h2>
        <p className="mt-2 text-sm leading-relaxed max-w-md mx-auto" style={{ color: "var(--vn-muted)" }}>
          {brand.name} forecasts your balance day by day. See where you might dip below your safe minimum,
          track spending pace, and get smart alerts.
        </p>
      </motion.div>

      {/* Animated chart illustration */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="rounded-3xl p-5 overflow-hidden"
        style={{
          background: "var(--vn-bg)",
          border: "1px solid var(--vn-border)",
        }}
      >
        <svg viewBox="0 0 400 160" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {[40, 80, 120].map((y) => (
            <line
              key={y}
              x1="40" y1={y} x2="380" y2={y}
              stroke="var(--vn-border)" strokeWidth="1" strokeDasharray="4 4"
            />
          ))}

          {/* Safe minimum line */}
          <line
            x1="40" y1="110" x2="380" y2="110"
            stroke="var(--vn-error)" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.6"
          />
          <text x="42" y="107" fontSize="8" fill="var(--vn-error)" opacity="0.7">Safe minimum</text>

          {/* Animated balance line */}
          <motion.path
            d="M40,60 C80,55 100,50 140,65 C180,80 200,100 220,95 C260,85 300,45 340,40 C360,38 380,42 380,42"
            fill="none"
            stroke="var(--vn-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.5, duration: 1.5, ease: "easeOut" }}
          />

          {/* Gradient fill under the line */}
          <motion.path
            d="M40,60 C80,55 100,50 140,65 C180,80 200,100 220,95 C260,85 300,45 340,40 C360,38 380,42 380,42 L380,140 L40,140 Z"
            fill="var(--vn-primary)"
            opacity="0.08"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.08 }}
            transition={{ delay: 1.2, duration: 0.5 }}
          />

          {/* Dip point indicator */}
          <motion.circle
            cx="200" cy="100" r="4"
            fill="var(--vn-warning)"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.4, type: "spring", stiffness: 300, damping: 15 }}
          />
          <motion.text
            x="208" y="98" fontSize="8" fill="var(--vn-warning)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6 }}
          >
            Dip warning
          </motion.text>

          {/* Y-axis labels */}
          <text x="2" y="44" fontSize="8" fill="var(--vn-muted)">High</text>
          <text x="2" y="124" fontSize="8" fill="var(--vn-muted)">Low</text>

          {/* X-axis labels */}
          <text x="40" y="155" fontSize="8" fill="var(--vn-muted)">Day 1</text>
          <text x="350" y="155" fontSize="8" fill="var(--vn-muted)">Day 30</text>
        </svg>
      </motion.div>

      {/* Insight examples */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        className="grid grid-cols-3 gap-3"
      >
        {[
          { label: "Pace", desc: "Ahead or behind?", icon: "M13 10V3L4 14h7v7l9-11h-7z", color: "var(--vn-success)" },
          { label: "Alerts", desc: "Overspend warnings", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9", color: "var(--vn-warning)" },
          { label: "Forecast", desc: "Balance timeline", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", color: "var(--vn-info)" },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 + i * 0.1 }}
            className="rounded-2xl p-3 text-center"
            style={{ background: "var(--vn-bg)" }}
          >
            <svg
              className="mx-auto h-5 w-5 mb-1.5"
              style={{ color: item.color }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={item.icon} />
            </svg>
            <div className="text-xs font-semibold" style={{ color: "var(--vn-text)" }}>{item.label}</div>
            <div className="text-[10px]" style={{ color: "var(--vn-muted)" }}>{item.desc}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Notifications opt-in */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: "var(--vn-bg)", border: "1px solid var(--vn-border)" }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "color-mix(in srgb, var(--vn-warning) 12%, transparent)" }}
        >
          <svg className="h-5 w-5" style={{ color: "var(--vn-warning)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>
            {notifState === "granted" ? "Alerts enabled ✓" : "Get bill & balance alerts"}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--vn-muted)" }}>
            {notifState === "granted"
              ? "You'll be notified before bills are due and when balances dip."
              : "\"Rent due tomorrow\", \"Balance running low\" — straight to your phone."}
          </div>
        </div>
        {notifState !== "granted" && (
          <button
            onClick={enableNotifications}
            className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Enable
          </button>
        )}
      </motion.div>
    </div>
  );
}
