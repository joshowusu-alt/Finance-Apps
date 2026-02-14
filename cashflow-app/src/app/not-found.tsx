"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { VelanovoLogo } from "@/components/VelanovoLogo";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-sm space-y-6"
      >
        <VelanovoLogo size={36} />

        <div>
          <h1
            className="text-3xl font-bold"
            style={{ color: "var(--vn-text)", fontFamily: "var(--font-playfair), serif" }}
          >
            Page not found
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--vn-muted)" }}>
            This page doesn&apos;t exist. Let&apos;s get you back on track.
          </p>
        </div>

        <Link
          href="/"
          className="vn-btn vn-btn-primary inline-block text-sm px-8 py-3"
        >
          Go to Dashboard
        </Link>
      </motion.div>
    </main>
  );
}
