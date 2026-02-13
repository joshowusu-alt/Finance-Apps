"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { VelanovoLogo } from "@/components/VelanovoLogo";
import { useBranding } from "@/hooks/useBranding";

type Mode = "signin" | "signup" | "magic";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState("");
  const router = useRouter();
  const supabase = createClient();
  const brand = useBranding();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOrigin(window.location.origin);
  }, []);

  const callbackUrl = origin ? `${origin}/auth/callback` : "/auth/callback";
  const resetUrl = origin ? `${origin}/auth/reset-password` : "/auth/reset-password";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!supabase) {
      setError("Authentication is not configured.");
      return;
    }
    setLoading(true);

    try {
      if (mode === "magic") {
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (err) throw err;
        setMessage("Check your email for a magic link.");
        return;
      }

      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (err) throw err;
        setMessage("Check your email to confirm your account.");
        return;
      }

      // Sign in
      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) throw err;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    setError(null);
    if (!supabase) { setError("Authentication is not configured."); return; }
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (err) setError(err.message);
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
          {/* Logo */}
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
              {mode === "signup"
                ? "Create your account"
                : mode === "magic"
                  ? "Magic link"
                  : "Welcome back"}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--vn-muted)" }}>
              {mode === "signup"
                ? "Start tracking your cashflow"
                : mode === "magic"
                  ? "We'll email you a link to sign in"
                  : `Sign in to your ${brand.name} account`}
            </p>
          </div>

          {!supabaseConfigured ? (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              <div className="font-semibold uppercase tracking-wide">Authentication not configured</div>
              <div className="mt-1 text-rose-700">
                Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <div className="font-semibold uppercase tracking-wide text-slate-500">Auth configured</div>
              <div className="mt-1">
                Ensure OAuth providers are enabled in Supabase and the redirect URLs include:
              </div>
              <div className="mt-2 space-y-1 font-mono text-[11px] text-slate-500">
                <div>{callbackUrl}</div>
                <div>{resetUrl}</div>
              </div>
              {supabaseUrl ? (
                <div className="mt-2 text-slate-500">
                  Provider callback base: {supabaseUrl}/auth/v1/callback
                </div>
              ) : null}
            </div>
          )}

          {/* OAuth buttons */}
          <div className="space-y-3">
            <button
              onClick={() => handleOAuth("google")}
              className="flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors"
              style={{
                background: "var(--vn-surface)",
                border: "1px solid var(--vn-border)",
                color: "var(--vn-text)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={() => handleOAuth("apple")}
              className="flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors"
              style={{
                background: "var(--vn-text)",
                color: "var(--vn-surface)",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
              </svg>
              Continue with Apple
            </button>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div
              className="h-px flex-1"
              style={{ background: "var(--vn-border)" }}
            />
            <span
              className="text-xs uppercase tracking-wide"
              style={{ color: "var(--vn-muted)" }}
            >
              or
            </span>
            <div
              className="h-px flex-1"
              style={{ background: "var(--vn-border)" }}
            />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
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

            {mode !== "magic" && (
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--vn-muted)" }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="vn-input"
                  placeholder={
                    mode === "signup" ? "Min 6 characters" : "Your password"
                  }
                />
              </div>
            )}

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
              {loading
                ? "Loading..."
                : mode === "signup"
                  ? "Create account"
                  : mode === "magic"
                    ? "Send magic link"
                    : "Sign in"}
            </button>
          </form>

          {/* Mode toggles */}
          <div
            className="mt-6 space-y-2 text-center text-sm"
            style={{ color: "var(--vn-muted)" }}
          >
            {mode === "signin" && (
              <>
                <button
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setMessage(null);
                  }}
                  className="block w-full transition-colors hover:underline"
                  style={{ color: "var(--vn-primary)" }}
                >
                  Don&apos;t have an account? Sign up
                </button>
                <button
                  onClick={() => {
                    setMode("magic");
                    setError(null);
                    setMessage(null);
                  }}
                  className="block w-full transition-colors hover:underline"
                  style={{ color: "var(--vn-muted)" }}
                >
                  Sign in with magic link instead
                </button>
                <a
                  href="/auth/reset-password"
                  className="block transition-colors hover:underline"
                  style={{ color: "var(--vn-muted)" }}
                >
                  Forgot your password?
                </a>
              </>
            )}
            {mode === "signup" && (
              <button
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setMessage(null);
                }}
                className="block w-full transition-colors hover:underline"
                style={{ color: "var(--vn-primary)" }}
              >
                Already have an account? Sign in
              </button>
            )}
            {mode === "magic" && (
              <button
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setMessage(null);
                }}
                className="block w-full transition-colors hover:underline"
                style={{ color: "var(--vn-primary)" }}
              >
                Sign in with password instead
              </button>
            )}
          </div>

          {/* Guest mode link */}
          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-xs transition-colors hover:underline"
              style={{ color: "var(--vn-muted)" }}
            >
              Continue without an account (data stored locally only)
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
