"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LOCK_ENABLED_KEY = "vn_lock_enabled";
const PIN_HASH_KEY = "vn_pin_hash";
const CRED_ID_KEY = "vn_cred_id";
const SESSION_KEY = "vn_unlocked";

// ── crypto helpers ────────────────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBuffer(s: string): ArrayBuffer {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const buf = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) buf[i] = b.charCodeAt(i);
  return buf.buffer;
}

// ── public API — used by settings ────────────────────────────────────────────

export function isLockEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LOCK_ENABLED_KEY) === "1";
}

export async function enableLock(pin: string): Promise<void> {
  const hash = await sha256(pin);
  localStorage.setItem(LOCK_ENABLED_KEY, "1");
  localStorage.setItem(PIN_HASH_KEY, hash);
  sessionStorage.setItem(SESSION_KEY, "1"); // current session stays unlocked
}

export function disableLock(): void {
  localStorage.removeItem(LOCK_ENABLED_KEY);
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(CRED_ID_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export async function registerBiometric(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { id: window.location.hostname, name: "Velanovo" },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: "vn_user",
          displayName: "Velanovo User",
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem(CRED_ID_KEY, b64url(cred.rawId));
    return true;
  } catch {
    return false;
  }
}

async function verifyBiometric(): Promise<boolean> {
  const credId = localStorage.getItem(CRED_ID_KEY);
  if (!credId || !window.PublicKeyCredential) return false;
  try {
    const cred = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ id: b64urlToBuffer(credId), type: "public-key" }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!cred;
  } catch {
    return false;
  }
}

async function verifyPin(input: string): Promise<boolean> {
  const stored = localStorage.getItem(PIN_HASH_KEY);
  if (!stored) return false;
  const hash = await sha256(input);
  return hash === stored;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function BiometricLock() {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!isLockEnabled()) return false;
    if (sessionStorage.getItem(SESSION_KEY)) return false;
    return true;
  });
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(CRED_ID_KEY) && !!window.PublicKeyCredential;
  });

  function unlock() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setShow(false);
  }

  async function handleBiometric() {
    setError("");
    const ok = await verifyBiometric();
    if (ok) {
      unlock();
    } else {
      setError("Biometric failed — enter your PIN");
      setBiometricAvailable(false);
    }
  }

  async function handleDigit(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError("");
    if (next.length === 4) {
      const ok = await verifyPin(next);
      if (ok) {
        unlock();
      } else {
        setShake(true);
        setError("Incorrect PIN");
        setTimeout(() => { setPin(""); setShake(false); }, 600);
      }
    }
  }

  function handleDelete() {
    setPin((p) => p.slice(0, -1));
    setError("");
  }

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="lock-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99999] flex flex-col items-center justify-center"
        style={{ background: "var(--vn-bg)" }}
      >
        {/* Logo / brand */}
        <div className="mb-8 text-center">
          <div className="text-3xl mb-2">🔒</div>
          <div className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "var(--vn-text)" }}>
            Velanovo
          </div>
          <div className="text-xs text-[var(--vn-muted)] mt-1">Enter your PIN to continue</div>
        </div>

        {/* PIN dots */}
        <motion.div
          animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex gap-4 mb-6"
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full border-2 transition-all"
              style={{
                borderColor: "var(--vn-primary, var(--gold))",
                background: i < pin.length ? "var(--vn-primary, var(--gold))" : "transparent",
              }}
            />
          ))}
        </motion.div>

        {/* Error */}
        <div className="h-5 mb-3 text-xs text-rose-500 text-center">{error}</div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="w-16 h-16 rounded-2xl text-xl font-semibold transition-transform active:scale-90 flex items-center justify-center"
              style={{ background: "var(--vn-surface)", color: "var(--vn-text)" }}
            >
              {d}
            </button>
          ))}
          <div /> {/* spacer */}
          <button
            onClick={() => handleDigit("0")}
            className="w-16 h-16 rounded-2xl text-xl font-semibold transition-transform active:scale-90 flex items-center justify-center"
            style={{ background: "var(--vn-surface)", color: "var(--vn-text)" }}
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="w-16 h-16 rounded-2xl text-lg transition-transform active:scale-90 flex items-center justify-center"
            style={{ background: "var(--vn-surface)", color: "var(--vn-muted)" }}
          >
            ⌫
          </button>
        </div>

        {/* Biometric button */}
        {biometricAvailable && (
          <button
            onClick={handleBiometric}
            className="mt-2 flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl transition-opacity active:opacity-70"
            style={{ color: "var(--vn-primary, var(--gold))" }}
          >
            <span className="text-lg">🪪</span>
            Use Face ID / Touch ID
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
