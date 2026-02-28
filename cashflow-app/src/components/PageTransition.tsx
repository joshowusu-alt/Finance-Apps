"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * PageTransition — wraps page content with a subtle slide+fade animation
 * on every route change. Uses framer-motion AnimatePresence with mode="wait".
 * Keep the animation fast (220ms) so it feels snappy, not decorative.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        style={{ width: "100%", minHeight: "inherit" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
