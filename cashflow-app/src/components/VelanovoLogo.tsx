"use client";

import * as React from "react";

type Props = { size?: number; showWordmark?: boolean };

export function VelanovoLogo({ size = 36, showWordmark = true }: Props) {
  const iconSize = size;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <VelanovoIcon size={iconSize} />
      {showWordmark && (
        <div style={{ lineHeight: 1 }}>
          <div
            style={{
              fontSize: Math.round(size * 0.95),
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--vn-text)",
            }}
          >
            Velanovo
          </div>
          <div
            style={{
              fontSize: Math.round(size * 0.38),
              color: "var(--vn-muted)",
              marginTop: 2,
            }}
          >
            New sails for a new journey
          </div>
        </div>
      )}
    </div>
  );
}

export function VelanovoIcon({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Velanovo icon"
      role="img"
      style={{ display: "block" }}
    >
      <rect width="512" height="512" rx="112" fill="var(--vn-navy)" />
      <path
        d="M140 350 L256 110 L372 350 C330 332 295 322 256 322 C217 322 182 332 140 350 Z"
        fill="var(--vn-teal)"
      />
      <path
        d="M256 150 L330 330 C304 320 282 314 256 314 C230 314 208 320 182 330 L256 150 Z"
        fill="var(--vn-navy)"
        opacity="0.55"
      />
      <path
        d="M156 372 C205 340 307 340 356 372"
        stroke="var(--vn-gold)"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <circle cx="372" cy="160" r="10" fill="var(--vn-gold)" />
    </svg>
  );
}
