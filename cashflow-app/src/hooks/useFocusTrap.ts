import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function getLiveFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
  ).filter((e) => !e.closest("[aria-hidden='true']"));
}

export function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    const el = ref.current;

    // Capture the element that triggered the trap so we can restore focus on close (WCAG 2.4.3)
    const triggerRef = document.activeElement as HTMLElement | null;

    // Wrap initial focus in rAF so the modal animation completes first (mobile UX)
    const rafId = requestAnimationFrame(() => {
      const focusable = getLiveFocusable(el);
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    });

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      // Re-query live on every Tab press to avoid stale closure over snapshot
      const focusable = getLiveFocusable(el);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    el.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("keydown", handleKeyDown);
      // Restore focus to the element that opened the trap (WCAG 2.4.3)
      triggerRef?.focus();
    };
  }, [active]);

  return ref;
}
