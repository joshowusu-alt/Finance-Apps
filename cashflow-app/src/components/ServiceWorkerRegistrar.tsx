"use client";

import { useEffect } from "react";

export const SW_UPDATE_EVENT = "sw:update-available";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Check for updates every 60 minutes
        const interval = setInterval(() => registration.update(), 60 * 60 * 1000);

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            // A new SW is installed and waiting — tell the UI
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(
                new CustomEvent(SW_UPDATE_EVENT, { detail: { registration } })
              );
            }
          });
        });

        // Also check if there's already a waiting SW from a previous visit
        if (registration.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(
            new CustomEvent(SW_UPDATE_EVENT, { detail: { registration } })
          );
        }

        return () => clearInterval(interval);
      })
      .catch((err) => {
        console.warn("SW registration failed:", err);
      });
  }, []);

  return null;
}
