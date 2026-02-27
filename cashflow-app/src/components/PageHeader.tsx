"use client";

import { type ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  onSearchOpen?: () => void;
}

export function PageHeader({ eyebrow, title, subtitle, actions, className, onSearchOpen }: PageHeaderProps) {
  return (
    <header className={`vn-masthead ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-xs uppercase tracking-widest font-semibold text-white/45 mb-1">
              {eyebrow}
            </div>
          )}
          <h1
            className="text-2xl font-bold text-white/90 leading-tight"
            style={{ fontFamily: "var(--font-playfair, serif)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-white/50">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {onSearchOpen && (
            <button
              onClick={onSearchOpen}
              className="p-2 rounded-lg text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors"
              aria-label="Search (Cmd+K)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </button>
          )}
          {actions}
        </div>
      </div>
    </header>
  );
}
