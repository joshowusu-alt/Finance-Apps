"use client";

import { useEffect, useState } from "react";

// ──────────────────────────────────────────────────────────────────────────────
// SplashScreen
// Shows once per browser session on first open.
// Animates: V monogram fade-in → wordmark rise → tagline → gold progress sweep
// Then fades the whole overlay out and unmounts.
// ──────────────────────────────────────────────────────────────────────────────
export default function SplashScreen() {
  const [phase, setPhase] = useState<"enter" | "exit" | "gone">("enter");

  useEffect(() => {
    // Only show once per session
    try {
      if (sessionStorage.getItem("vn_splash_shown")) {
        setPhase("gone");
        return;
      }
      sessionStorage.setItem("vn_splash_shown", "1");
    } catch {
      setPhase("gone");
      return;
    }

    // Begin exit after 1900ms (progress bar reaches full at ~1700ms)
    const exitTimer = setTimeout(() => setPhase("exit"), 1900);
    // Fully unmount after fade-out
    const goneTimer = setTimeout(() => setPhase("gone"), 2650);
    return () => { clearTimeout(exitTimer); clearTimeout(goneTimer); };
  }, []);

  if (phase === "gone") return null;

  return (
    <>
      <style>{`
        @keyframes vn-splash-bg {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes vn-monogram-in {
          0%   { opacity: 0; transform: scale(0.82); }
          60%  { opacity: 1; transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes vn-wordmark-in {
          0%   { opacity: 0; transform: translateY(18px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes vn-tagline-in {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 0.55; transform: translateY(0); }
        }
        @keyframes vn-progress {
          0%   { width: 0%; opacity: 0.7; }
          15%  { opacity: 1; }
          100% { width: 100%; opacity: 1; }
        }
        @keyframes vn-divider-in {
          0%   { opacity: 0; width: 0; }
          100% { opacity: 1; width: 48px; }
        }
        .vn-splash-exit {
          animation: vn-splash-bg 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
        }
      `}</style>

      <div
        className={phase === "exit" ? "vn-splash-exit" : ""}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          isolation: "isolate",
        }}
        aria-hidden="true"
      >
        {/* ── Centre content ─────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>

          {/* Monogram circle */}
          <div
            style={{
              animation: "vn-monogram-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both",
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(168,115,26,0.22) 0%, rgba(212,168,67,0.10) 100%)",
              border: "1.5px solid rgba(212,168,67,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 28,
              boxShadow: "0 0 48px rgba(212,168,67,0.08)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-playfair, Georgia, serif)",
                fontSize: 34,
                fontWeight: 700,
                color: "#d4a843",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                userSelect: "none",
              }}
            >
              V
            </span>
          </div>

          {/* Wordmark */}
          <h1
            style={{
              animation: "vn-wordmark-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.55s both",
              fontFamily: "var(--font-playfair, Georgia, serif)",
              fontSize: "clamp(2.6rem, 8vw, 4rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#f0ede8",
              margin: 0,
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            Velanovo
          </h1>

          {/* Divider */}
          <div
            style={{
              animation: "vn-divider-in 0.4s ease 0.95s both",
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(212,168,67,0.6), transparent)",
              margin: "16px 0 14px",
            }}
          />

          {/* Tagline */}
          <p
            style={{
              animation: "vn-tagline-in 0.5s ease 1.05s both",
              fontFamily: "Plus Jakarta Sans, var(--font-jakarta, sans-serif)",
              fontSize: "clamp(0.7rem, 2.2vw, 0.82rem)",
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#f0ede8",
              margin: 0,
              userSelect: "none",
            }}
          >
            Private Wealth &amp; Cashflow
          </p>
        </div>

        {/* ── Gold progress bar ─────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "rgba(212,168,67,0.1)",
          }}
        >
          <div
            style={{
              animation: "vn-progress 1.65s cubic-bezier(0.4, 0, 0.2, 1) 0.25s both",
              height: "100%",
              background: "linear-gradient(90deg, #a8731a 0%, #d4a843 60%, #f0c060 100%)",
              boxShadow: "0 0 12px rgba(212,168,67,0.5)",
            }}
          />
        </div>

        {/* ── Subtle grain texture overlay ─────────────────────────── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E\")",
            backgroundRepeat: "repeat",
            backgroundSize: "128px 128px",
            pointerEvents: "none",
            opacity: 0.4,
          }}
        />
      </div>
    </>
  );
}
