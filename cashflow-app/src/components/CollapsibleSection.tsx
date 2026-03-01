"use client";

import { useState, useId, type ReactNode, type KeyboardEvent } from "react";

interface Props {
  /** Optional static id for the collapsible region (used in aria-controls). */
  id?: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Accessible collapsible section card.
 * — aria-expanded on the toggle button
 * — aria-controls / role="region" on the content div
 * — Keyboard: Enter and Space toggle open/closed
 * — Focus ring via --vn-focus-ring token
 */
export default function CollapsibleSection({
  id,
  title,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const autoId = useId();
  const regionId = id ?? `collapsible-${autoId}`;
  const buttonId = `${regionId}-btn`;

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }

  return (
    <section className="vn-card p-6">
      <button
        id={buttonId}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center justify-between gap-4 text-left focus:outline-none focus-visible:rounded"
        style={open ? undefined : undefined}
        aria-expanded={open}
        aria-controls={regionId}
      >
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--vn-text)" }}
        >
          {title}
        </span>
        <span className="text-xs" style={{ color: "var(--vn-muted)" }}>
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <div
          id={regionId}
          role="region"
          aria-labelledby={buttonId}
          className="mt-4"
        >
          {children}
        </div>
      )}
    </section>
  );
}
