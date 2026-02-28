"use client";

import { useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { motion } from "framer-motion";

interface ProGateProps {
  feature: string;
  description?: string;
  children: React.ReactNode;
}

export default function ProGate({ feature, description, children }: ProGateProps) {
  const { isPro, isLoading } = useSubscription();

  if (isLoading) return <>{children}</>;
  if (isPro) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40 blur-[2px]" aria-hidden="true">
        {children}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
        style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(4px)" }}
      >
        <div className="text-center px-6 max-w-xs">
          <div className="text-2xl mb-2">⭐</div>
          <div className="text-sm font-semibold mb-1" style={{ color: "var(--vn-gold)" }}>
            {feature}
          </div>
          <div className="text-xs mb-4" style={{ color: "rgba(240,237,232,0.7)" }}>
            {description ?? "Upgrade to Pro to unlock this feature."}
          </div>
          <UpgradeButton size="sm" />
        </div>
      </motion.div>
    </div>
  );
}

export function UpgradeButton({ size = "md" }: { size?: "sm" | "md" }) {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleUpgrade}
      disabled={loading}
      className={`vn-btn ${size === "sm" ? "text-xs px-3 py-1.5" : "px-4 py-2"} font-semibold`}
      style={{ background: "linear-gradient(135deg, #C5A046, #D4AF5A)", color: "#111318" }}
    >
      {loading ? "Loading…" : "Upgrade to Pro — £9.99/mo"}
    </button>
  );
}
