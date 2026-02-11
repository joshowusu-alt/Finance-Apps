"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { VelanovoLogo } from "@/components/VelanovoLogo";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"request" | "update">("request");
  const supabase = createClient();

  // Check if we arrived via a recovery link (hash fragment with access_token)
  useState(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
      setStep("update");
    }
  });

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/auth/reset-password`,
      });
      if (err) throw err;
      setMessage("Check your email for a password reset link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: err } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (err) throw err;
      setMessage("Password updated. Redirecting...");
      setTimeout(() => (window.location.href = "/"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full max-w-md"
      >
        <div className="vn-card p-8">
          <div className="mb-8 text-center">
            <div className="mb-4 flex justify-center">
              <VelanovoLogo size={36} />
            </div>
            <h1
              className="text-2xl font-bold"
              style={{
                color: "var(--vn-text)",
                fontFamily: "var(--font-playfair), serif",
              }}
            >
              {step === "update" ? "Set new password" : "Reset password"}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--vn-muted)" }}>
              {step === "update"
                ? "Choose a new password for your account"
                : "Enter your email and we'll send a reset link"}
            </p>
          </div>

          {step === "request" ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--vn-muted)" }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="vn-input"
                  placeholder="you@example.com"
                />
              </div>

              {error && (
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: "var(--error-soft)",
                    color: "var(--vn-error)",
                  }}
                >
                  {error}
                </div>
              )}

              {message && (
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: "var(--success-soft)",
                    color: "var(--vn-success)",
                  }}
                >
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="vn-btn vn-btn-primary w-full text-sm"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--vn-muted)" }}
                >
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="vn-input"
                  placeholder="Min 6 characters"
                />
              </div>

              {error && (
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: "var(--error-soft)",
                    color: "var(--vn-error)",
                  }}
                >
                  {error}
                </div>
              )}

              {message && (
                <div
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: "var(--success-soft)",
                    color: "var(--vn-success)",
                  }}
                >
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="vn-btn vn-btn-primary w-full text-sm"
              >
                {loading ? "Updating..." : "Update password"}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <a
              href="/auth"
              className="text-sm transition-colors hover:underline"
              style={{ color: "var(--vn-primary)" }}
            >
              Back to sign in
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
