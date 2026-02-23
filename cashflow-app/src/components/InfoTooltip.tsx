"use client";

import { useState, useRef, useEffect } from "react";

interface InfoTooltipProps {
  text: string;
}

export default function InfoTooltip({ text }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center ml-1.5 shrink-0">
      {/* Trigger — gold ring, gold italic "i" to match the brand */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label="More information"
        aria-expanded={open}
        className="inline-flex items-center justify-center w-4.5 h-4.5 rounded-full transition-colors"
        style={{
          border: "1.5px solid var(--gold)",
          color: "var(--gold)",
          background: "var(--gold-soft)",
          fontFamily: "var(--font-jakarta), sans-serif",
          fontSize: "11px",
          fontStyle: "italic",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        i
      </button>

      {/* Tooltip popup — matches vn-card style */}
      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-60 rounded-2xl text-xs leading-relaxed z-50 p-3.5 shadow-lg"
          style={{
            background: "var(--vn-surface)",
            border: "1px solid var(--vn-border)",
            color: "var(--vn-text)",
            fontFamily: "var(--font-jakarta), sans-serif",
            fontWeight: 400,
            boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
          }}
        >
          {text}
          {/* Caret */}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid var(--vn-border)",
            }}
          />
          {/* Inner caret to cover the border line */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: "calc(100% - 1px)",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid var(--vn-surface)",
            }}
          />
        </div>
      )}
    </div>
  );
}
