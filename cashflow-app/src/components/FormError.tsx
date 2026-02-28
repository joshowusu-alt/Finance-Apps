"use client";

import { motion, AnimatePresence } from "framer-motion";

export function FormError({ message }: { message?: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          key={message}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="text-xs mt-1"
          style={{ color: "var(--vn-error, #ef4444)" }}
          role="alert"
          aria-live="polite"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
