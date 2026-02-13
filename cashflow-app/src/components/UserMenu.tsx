"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function UserMenu() {
  const { user, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div
        className="h-10 w-10 animate-pulse rounded-full"
        style={{ background: "var(--vn-border)" }}
      />
    );
  }

  if (!user) {
    return (
      <Link
        href="/auth"
        className="rounded-full px-4 py-2 text-xs font-semibold transition-colors"
        style={{
          background: "var(--vn-primary)",
          color: "var(--vn-primary-contrast)",
        }}
      >
        Sign in
      </Link>
    );
  }

  const initial = (user.email?.[0] ?? "U").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold transition-transform hover:scale-105"
        style={{
          background: "var(--vn-primary)",
          color: "var(--vn-primary-contrast)",
        }}
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initial}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl p-2 shadow-lg"
          style={{
            background: "var(--vn-surface)",
            border: "1px solid var(--vn-border)",
          }}
        >
          <div className="px-3 py-2">
            <div
              className="truncate text-sm font-semibold"
              style={{ color: "var(--vn-text)" }}
            >
              {user.email}
            </div>
            <div className="text-xs" style={{ color: "var(--vn-muted)" }}>
              Signed in
            </div>
          </div>

          <div
            className="my-1 h-px"
            style={{ background: "var(--vn-border)" }}
          />

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm transition-colors"
            style={{ color: "var(--vn-text)" }}
          >
            Settings
          </Link>

          <button
            onClick={async () => {
              setOpen(false);
              await signOut();
              window.location.href = "/auth";
            }}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm transition-colors"
            style={{ color: "var(--vn-error)" }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
