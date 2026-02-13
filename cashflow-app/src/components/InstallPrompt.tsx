"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "cashflow_install_prompt_dismissed_v1";

export default function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches;
    if (isStandalone) return;
    if (window.localStorage.getItem(DISMISS_KEY)) {
      setDismissed(true);
      return;
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!promptEvent || dismissed) return null;

  async function handleInstall() {
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
    setDismissed(true);
  }

  function handleDismiss() {
    window.localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setDismissed(true);
    setPromptEvent(null);
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 w-[280px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 p-4 shadow-xl">
      <div className="text-sm font-semibold text-slate-900 dark:text-white">Install this app</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Get quick access and a full-screen experience from your home screen.
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleInstall}
          className="vn-btn vn-btn-primary text-xs px-3 py-2"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="vn-btn vn-btn-ghost text-xs px-3 py-2"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
