"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "cashflow_install_prompt_dismissed_v1";

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.localStorage.getItem(DISMISS_KEY));
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isInStandaloneMode() || dismissed) return;

    // iOS Safari: never fires beforeinstallprompt — show manual instructions
    if (isIosDevice()) {
      setShowIosPrompt(true);
      return;
    }

    // Android/Chrome: intercept native prompt
    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed]);

  function handleDismiss() {
    window.localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setDismissed(true);
    setPromptEvent(null);
    setShowIosPrompt(false);
  }

  async function handleAndroidInstall() {
    const evt = promptEvent;
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    setPromptEvent(null);
    setDismissed(true);
  }

  const show = (promptEvent !== null || showIosPrompt) && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="fixed bottom-24 right-4 z-50 w-72 rounded-2xl border bg-white/95 dark:bg-slate-800/95 p-4 shadow-xl"
          style={{ borderColor: "var(--vn-border)" }}
        >
          <div className="text-sm font-semibold" style={{ color: "var(--vn-text)" }}>
            Add Velanovo to Home Screen
          </div>

          {showIosPrompt ? (
            <>
              <div className="mt-2 text-xs leading-relaxed" style={{ color: "var(--vn-muted)" }}>
                Install for the best experience — offline access, push alerts, and Face ID lock.
              </div>
              <ol className="mt-3 space-y-2 text-xs" style={{ color: "var(--vn-muted)" }}>
                <li className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">①</span>
                  <span>
                    Tap the{" "}
                    <svg className="inline w-4 h-4 align-text-bottom" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>{" "}
                    <strong>Share</strong> button in Safari
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">②</span>
                  <span>Scroll down and tap <strong>Add to Home Screen</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">③</span>
                  <span>Tap <strong>Add</strong> to confirm</span>
                </li>
              </ol>
            </>
          ) : (
            <div className="mt-1 text-xs" style={{ color: "var(--vn-muted)" }}>
              Get quick access and a full-screen experience from your home screen.
            </div>
          )}

          <div className="mt-3 flex gap-2">
            {!showIosPrompt && (
              <button
                onClick={handleAndroidInstall}
                className="vn-btn vn-btn-primary text-xs px-3 py-2"
              >
                Install
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="vn-btn vn-btn-ghost text-xs px-3 py-2"
            >
              {showIosPrompt ? "Got it" : "Not now"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
