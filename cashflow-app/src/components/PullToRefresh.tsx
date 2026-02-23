"use client";

import { useEffect, useRef, useState } from "react";
import { PLAN_UPDATED_EVENT } from "@/lib/storage";

/** How many px to pull before a refresh triggers */
const THRESHOLD = 72;

/**
 * PullToRefresh — invisible on desktop, shows a circular indicator on mobile.
 * When the user pulls down from the top (scrollY === 0) by THRESHOLD pixels,
 * dispatches PLAN_UPDATED_EVENT so all pages reload their plan data, and fires
 * a short haptic pulse.
 */
export default function PullToRefresh() {
  const startY = useRef<number | null>(null);
  const [pullPct, setPullPct] = useState(0); // 0 → 1

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        setPullPct(Math.min(dy / THRESHOLD, 1));
      } else {
        startY.current = null;
        setPullPct(0);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (startY.current === null) return;
      const dy = e.changedTouches[0].clientY - startY.current;
      if (dy >= THRESHOLD) {
        window.dispatchEvent(new CustomEvent(PLAN_UPDATED_EVENT));
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try { navigator.vibrate(15); } catch { /* noop */ }
        }
      }
      startY.current = null;
      setPullPct(0);
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  if (pullPct === 0) return null;

  return (
    <div
      aria-hidden
      className="fixed top-0 left-1/2 -translate-x-1/2 z-[9997] flex flex-col items-center pointer-events-none"
      style={{ paddingTop: `${Math.round(pullPct * 52)}px` }}
    >
      <div
        className="w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-md"
        style={{
          borderColor: "var(--vn-primary)",
          background: "var(--vn-surface)",
          opacity: pullPct,
          transform: `rotate(${Math.round(pullPct * 360)}deg)`,
          transition: "opacity 0.1s",
        }}
      >
        {/* Refresh arrow icon */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 2v4m0-4L5 4m2-2 2 2M7 12V8m0 4-2-2m2 2 2-2"
            stroke="var(--vn-primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
