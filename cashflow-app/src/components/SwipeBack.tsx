"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** px from the left edge to start tracking a back-swipe */
const EDGE_ZONE = 28;
/** px of horizontal travel to trigger navigation */
const THRESHOLD = 72;
/** Maximum vertical drift allowed (to avoid conflicting with scroll) */
const MAX_VERTICAL_DRIFT = 60;

/**
 * SwipeBack — invisible PWA helper.
 * Registers a swipe-right gesture starting from the left edge of the screen.
 * When the user drags far enough, calls router.back() and fires haptic feedback.
 * Only active on touch devices; no-ops on desktop.
 */
export default function SwipeBack() {
  const router = useRouter();
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Build an overlay element for the visual drag indicator
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:100dvh;z-index:9990;" +
      "background:linear-gradient(90deg,rgba(212,168,67,0.18),transparent);" +
      "pointer-events:none;transition:width 0.05s;";
    document.body.appendChild(overlay);
    overlayRef.current = overlay;

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      if (t.clientX <= EDGE_ZONE) {
        startX.current = t.clientX;
        startY.current = t.clientY;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (startX.current === null || startY.current === null) return;
      const t = e.touches[0];
      const dx = t.clientX - startX.current;
      const dy = Math.abs(t.clientY - startY.current);

      // Cancel if scroll dominates
      if (dy > MAX_VERTICAL_DRIFT) {
        startX.current = null;
        startY.current = null;
        overlay.style.width = "0";
        return;
      }

      if (dx > 0) {
        const pct = Math.min(dx / THRESHOLD, 1);
        overlay.style.width = `${Math.round(pct * 32)}px`;
        overlay.style.opacity = String(pct);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (startX.current === null || startY.current === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX.current;
      const dy = Math.abs(t.clientY - startY.current);
      overlay.style.width = "0";
      overlay.style.opacity = "0";
      startX.current = null;
      startY.current = null;

      if (dx >= THRESHOLD && dy <= MAX_VERTICAL_DRIFT) {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try { navigator.vibrate(12); } catch { /* noop */ }
        }
        router.back();
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      overlay.remove();
    };
  }, [router]);

  return null;
}
