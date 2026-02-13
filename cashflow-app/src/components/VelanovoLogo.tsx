"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useBranding } from "@/hooks/useBranding";

type Props = { size?: number; showWordmark?: boolean };

export function VelanovoLogo({ size = 36, showWordmark = true }: Props) {
  const brand = useBranding();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const update = () => {
      const theme = document.documentElement.getAttribute("data-theme");
      setIsDark(theme === "dark");
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const iconSize = size;
  const logoSrc = isDark ? brand.logoUrlDark || brand.logoUrl : brand.logoUrl;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={`${brand.name} logo`}
          style={{
            width: iconSize,
            height: iconSize,
            objectFit: "contain",
            borderRadius: iconSize * 0.2,
          }}
        />
      ) : (
        <VelanovoIcon size={iconSize} />
      )}
      {showWordmark && (
        <div style={{ lineHeight: 1 }}>
          <div
            style={{
              fontSize: Math.round(size * 0.95),
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--vn-text)",
              fontFamily: "var(--font-playfair), serif",
            }}
          >
            {brand.name}
          </div>
          {brand.tagline ? (
            <div
              style={{
                fontSize: Math.round(size * 0.35),
                color: "var(--vn-muted)",
                marginTop: 2,
                fontFamily: "var(--font-inter), sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {brand.tagline}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function VelanovoIcon({ size = 64 }: { size?: number }) {
  // Centurion V - Elite Logo
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: size * 0.25,
        background: "var(--vn-navy)",
        border: "1px solid rgba(251, 191, 36, 0.2)", // Subtle gold border
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        position: "relative",
      }}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        style={{ color: "var(--vn-gold)" }}
      >
        <path d="M12 2L2 22h20L12 2z" fill="currentColor" opacity="0.15" />
        <path d="M7 6L12 16L17 6" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
        <path d="M2 2h20" stroke="currentColor" strokeWidth="1" strokeOpacity="0.4" />
      </svg>
    </div>
  );
}
