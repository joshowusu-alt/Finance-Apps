"use client";

import { useEffect, useState } from "react";
import { getStorageScope } from "@/lib/storage";

type LinkState = "idle" | "loading" | "copied" | "error";

function buildLink(token: string) {
  const origin = window.location.origin;
  return `${origin}/review?token=${encodeURIComponent(token)}`;
}

export default function ReviewAccessLink() {
  const [isReview, setIsReview] = useState(false);
  const [status, setStatus] = useState<LinkState>("idle");

  useEffect(() => {
    setIsReview(getStorageScope() === "review");
  }, []);

  if (!isReview) return null;

  const label =
    status === "loading"
      ? "Preparing link..."
      : status === "copied"
        ? "Link copied"
        : status === "error"
          ? "Copy failed"
          : "Copy access link";

  async function handleCopy() {
    setStatus("loading");
    try {
      const res = await fetch("/api/review/link", { method: "POST" });
      const data = (await res.json()) as { token?: string };
      if (!data?.token) throw new Error("Missing token");
      const link = buildLink(data.token);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const input = document.createElement("input");
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-6">
      <div className="max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-xs text-white shadow-xl backdrop-blur">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">
          Review mode
        </div>
        <button
          onClick={handleCopy}
          className="mt-2 w-full rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow hover:bg-[var(--accent-deep)]"
        >
          {label}
        </button>
        <div className="mt-2 text-[11px] text-slate-400">
          Share this link to continue on another device.
        </div>
      </div>
    </div>
  );
}
