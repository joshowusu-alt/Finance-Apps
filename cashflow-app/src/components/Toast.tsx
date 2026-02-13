"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

const toasts: Toast[] = [];
const listeners: Array<(toasts: Toast[]) => void> = [];

function notifyListeners() {
  listeners.forEach((listener) => listener([...toasts]));
}

export function showToast(message: string, type: ToastType = "info", duration = 4000) {
  const id = `toast-${Date.now()}-${Math.random()}`;
  const toast: Toast = { id, message, type, duration };

  toasts.push(toast);
  notifyListeners();

  if (duration > 0) {
    setTimeout(() => {
      const index = toasts.findIndex((t) => t.id === id);
      if (index !== -1) {
        toasts.splice(index, 1);
        notifyListeners();
      }
    }, duration);
  }

  return id;
}

export function dismissToast(id: string) {
  const index = toasts.findIndex((t) => t.id === id);
  if (index !== -1) {
    toasts.splice(index, 1);
    notifyListeners();
  }
}

const toastIcons = {
  success: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const toastStyles = {
  success: "bg-success-soft border-success/30 text-success",
  error: "bg-error-soft border-error/30 text-error",
  warning: "bg-warning-soft border-warning/30 text-warning",
  info: "bg-info-soft border-info/30 text-info",
};

export default function ToastContainer() {
  const [displayToasts, setDisplayToasts] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.push(setDisplayToasts);
    return () => {
      const index = listeners.indexOf(setDisplayToasts);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return (
    <div
      className="fixed bottom-24 right-6 z-50 flex flex-col gap-3 max-w-sm pointer-events-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {displayToasts.map((toast, index) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{
              opacity: 0,
              x: 100,
              scale: 0.8,
              transition: { duration: 0.2 }
            }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 25,
            }}
            className={`
              pointer-events-auto
              rounded-xl px-4 py-3.5 shadow-lg border backdrop-blur-xl
              flex items-start gap-3
              ${toastStyles[toast.type]}
            `}
            role="alert"
          >
            {/* Icon with animation */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                delay: 0.1,
                type: "spring",
                stiffness: 300,
                damping: 15
              }}
              className="shrink-0 mt-0.5"
            >
              {toastIcons[toast.type]}
            </motion.div>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-sm font-medium flex-1 leading-snug"
            >
              {toast.message}
            </motion.p>

            {/* Dismiss button */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              whileHover={{ opacity: 1, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              aria-label="Dismiss notification"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </motion.button>

            {/* Progress bar */}
            {toast.duration && toast.duration > 0 && (
              <motion.div
                className="absolute bottom-0 left-0 h-1 bg-current rounded-b-xl"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{
                  duration: toast.duration / 1000,
                  ease: "linear"
                }}
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Utility functions for common toast patterns
export const toast = {
  success: (message: string, duration?: number) => showToast(message, "success", duration),
  error: (message: string, duration?: number) => showToast(message, "error", duration),
  warning: (message: string, duration?: number) => showToast(message, "warning", duration),
  info: (message: string, duration?: number) => showToast(message, "info", duration),
};
