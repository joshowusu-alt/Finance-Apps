"use client";
import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  /** Duration in ms. Default 600 */
  duration?: number;
  /** Format the final value. Default: toLocaleString with 2 decimal places */
  format?: (n: number) => string;
  className?: string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates a number from its previous value to a new value using
 * requestAnimationFrame. Useful for balance totals, net worth, etc.
 */
export function AnimatedNumber({
  value,
  duration = 600,
  format,
  className,
}: AnimatedNumberProps) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setDisplayed(from + (to - from) * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayed(to);
        prevRef.current = to;
      }
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const defaultFormat = (n: number) =>
    n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <span className={className}>{(format ?? defaultFormat)(displayed)}</span>
  );
}
