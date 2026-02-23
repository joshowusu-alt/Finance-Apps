"use client";

import { useEffect, useState } from "react";

// ──────────────────────────────────────────────────────────────────────────────
// SplashScreen
// Shows once per browser session on first open.
// Animates:
//   • V monogram springs in with bounce → persistent glow pulse
//   • "Velanovo" letters stagger in one-by-one
//   • Divider expands, tagline rises
//   • Floating gold dust particles drift upward
//   • Gold shimmer progress bar sweeps across the bottom
//   • Entire overlay fades + scales out
// ──────────────────────────────────────────────────────────────────────────────

const LETTERS = "Velanovo".split("");

// Particles: {left offset from centre, delay, size (px), duration}
const PARTICLES: { left: string; delay: string; size: number; dur: string }[] = [
  { left: "calc(50% - 38px)", delay: "0.9s",  size: 2.5, dur: "2.3s" },
  { left: "calc(50% + 14px)", delay: "1.3s",  size: 2,   dur: "2.0s" },
  { left: "calc(50% - 10px)", delay: "0.6s",  size: 3,   dur: "2.6s" },
  { left: "calc(50% + 36px)", delay: "1.6s",  size: 2,   dur: "1.9s" },
  { left: "calc(50% - 22px)", delay: "1.1s",  size: 2,   dur: "2.4s" },
  { left: "calc(50% + 24px)", delay: "0.4s",  size: 3,   dur: "2.1s" },
  { left: "calc(50% -  2px)", delay: "1.9s",  size: 1.5, dur: "1.8s" },
];

export default function SplashScreen() {
  // Initialise phase without a synchronous setState-in-effect — reads
  // sessionStorage once during first client render via lazy initializer.
  const [phase, setPhase] = useState<"enter" | "exit" | "gone">(() => {
    if (typeof window === "undefined") return "enter";
    try {
      return sessionStorage.getItem("vn_splash_shown") ? "gone" : "enter";
    } catch {
      return "gone";
    }
  });

  useEffect(() => {
    if (phase === "gone") return; // lazy initializer already decided
    try { sessionStorage.setItem("vn_splash_shown", "1"); } catch { /* ignore */ }

    // Allow all letter-stagger + particles to finish before exit
    const exitTimer = setTimeout(() => setPhase("exit"), 2300);
    const goneTimer = setTimeout(() => setPhase("gone"), 3100);
    return () => { clearTimeout(exitTimer); clearTimeout(goneTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "gone") return null;

  return (
    <>
      <style>{`
        /* ── Exit ───────────────────────────── */
        @keyframes vn-exit {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(1.04); }
        }
        .vn-splash-exit {
          animation: vn-exit 0.65s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
        }

        /* ── Monogram ────────────────────────── */
        @keyframes vn-monogram-in {
          0%   { opacity: 0; transform: scale(0.6) rotate(-6deg); }
          55%  { transform: scale(1.1) rotate(2deg); }
          75%  { transform: scale(0.96) rotate(-1deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes vn-glow-pulse {
          0%, 100% { box-shadow: 0 0 28px rgba(212,168,67,0.10), 0 0 0 0   rgba(197,160,70,0.22); }
          50%       { box-shadow: 0 0 52px rgba(212,168,67,0.22), 0 0 0 10px rgba(197,160,70,0.00); }
        }

        /* ── Letters ─────────────────────────── */
        @keyframes vn-letter-in {
          0%   { opacity: 0; transform: translateY(18px) scaleY(0.75); }
          60%  { transform: translateY(-3px) scaleY(1.04); }
          100% { opacity: 1; transform: translateY(0) scaleY(1); }
        }

        /* ── Divider ─────────────────────────── */
        @keyframes vn-divider-in {
          0%   { opacity: 0; width: 0px; }
          100% { opacity: 1; width: 48px; }
        }

        /* ── Tagline ─────────────────────────── */
        @keyframes vn-tagline-in {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 0.55; transform: translateY(0); }
        }

        /* ── Particles ───────────────────────── */
        @keyframes vn-particle {
          0%   { opacity: 0; transform: translateY(0px) scale(0); }
          18%  { opacity: 0.9; }
          100% { opacity: 0; transform: translateY(-90px) scale(1.3); }
        }

        /* ── Progress bar ────────────────────── */
        @keyframes vn-progress {
          0%   { width: 0%; opacity: 0.6; }
          12%  { opacity: 1; }
          100% { width: 100%; opacity: 1; }
        }
        @keyframes vn-progress-shimmer {
          0%   { background-position: -300% center; }
          100% { background-position: 300% center; }
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
          background: "radial-gradient(ellipse 80% 60% at 50% 38%, #161c24 0%, #0D1117 70%)",
          isolation: "isolate",
        }}
        aria-hidden="true"
      >

        {/* ── Floating gold dust particles ──────────────────────── */}
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              bottom: "calc(50% + 10px)",
              left: p.left,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: "radial-gradient(circle, #e8c870 0%, #C5A046 100%)",
              animation: `vn-particle ${p.dur} ease-out ${p.delay} both`,
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
        ))}

        {/* ── Centre content ────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, zIndex: 2 }}>

          {/* Monogram circle */}
          <div
            style={{
              animation: "vn-monogram-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both, vn-glow-pulse 2.2s ease-in-out 0.9s infinite",
              width: 76,
              height: 76,
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(197,160,70,0.20) 0%, rgba(212,175,90,0.07) 100%)",
              border: "1.5px solid rgba(197,160,70,0.32)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 28,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-playfair, Georgia, serif)",
                fontSize: 34,
                fontWeight: 600,
                color: "#C5A046",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                userSelect: "none",
              }}
            >
              V
            </span>
          </div>

          {/* Wordmark — letter-by-letter stagger */}
          <h1
            style={{
              fontFamily: "var(--font-playfair, Georgia, 'Times New Roman', serif)",
              fontSize: "clamp(2.4rem, 7vw, 3.6rem)",
              fontWeight: 600,
              letterSpacing: "-0.025em",
              color: "#E6E8EB",
              margin: 0,
              lineHeight: 1,
              userSelect: "none",
              display: "flex",
            }}
          >
            {LETTERS.map((letter, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  animation: `vn-letter-in 0.42s cubic-bezier(0.34, 1.3, 0.64, 1) ${(0.52 + i * 0.06).toFixed(3)}s both`,
                }}
              >
                {letter}
              </span>
            ))}
          </h1>

          {/* Divider */}
          <div
            style={{
              animation: "vn-divider-in 0.4s ease 1.2s both",
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(197,160,70,0.55), transparent)",
              margin: "16px 0 14px",
            }}
          />

          {/* Tagline */}
          <p
            style={{
              animation: "vn-tagline-in 0.5s ease 1.35s both",
              fontFamily: "var(--font-jakarta, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif)",
              fontSize: "clamp(0.68rem, 2vw, 0.78rem)",
              fontWeight: 500,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#AAB2BD",
              margin: 0,
              userSelect: "none",
            }}
          >
            Private Wealth &amp; Cashflow
          </p>
        </div>

        {/* ── Gold shimmer progress bar ──────────────────────────── */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "rgba(212,168,67,0.10)",
          }}
        >
          <div
            style={{
              animation: "vn-progress 2.0s cubic-bezier(0.4, 0, 0.2, 1) 0.3s both, vn-progress-shimmer 1.4s linear 0.8s infinite",
              height: "100%",
              background: "linear-gradient(90deg, #C5A046 0%, #D4AF5A 40%, #f0d070 55%, #D4AF5A 70%, #C5A046 100%)",
              backgroundSize: "300% 100%",
              boxShadow: "0 0 10px rgba(197,160,70,0.45), 0 0 22px rgba(197,160,70,0.18)",
            }}
          />
        </div>

        {/* ── Subtle grain texture overlay ──────────────────────── */}
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
