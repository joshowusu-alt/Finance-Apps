"use client";
import { useEffect } from "react";

/**
 * Listens to the Visual Viewport API to detect the on-screen keyboard height.
 * Sets --keyboard-height CSS custom property on <html> so components can
 * shift their content above the keyboard.
 *
 * On iOS, window.innerHeight does NOT shrink when the keyboard opens.
 * visualViewport.height does. This hook bridges that gap.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function update() {
      const keyboardHeight = (window.innerHeight - (vv!.height + vv!.offsetTop));
      const safeHeight = Math.max(0, keyboardHeight);
      document.documentElement.style.setProperty(
        "--keyboard-height",
        `${safeHeight}px`
      );
    }

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.documentElement.style.setProperty("--keyboard-height", "0px");
    };
  }, []);
}
