import "@testing-library/jest-dom";
import { vi } from "vitest";

// ─── next/font/google ─────────────────────────────────────────────────────────
// Prevent real font loading in jsdom
vi.mock("next/font/google", () => ({
  Playfair_Display: () => ({ className: "mock-playfair", variable: "--font-playfair" }),
  Plus_Jakarta_Sans: () => ({ className: "mock-jakarta", variable: "--font-jakarta" }),
  Inter: () => ({ className: "mock-inter", variable: "--font-inter" }),
  Geist: () => ({ className: "mock-geist", variable: "--font-geist" }),
}));

// ─── framer-motion ────────────────────────────────────────────────────────────
// Replace every motion.X with the plain HTML element so component tests can
// assert on real DOM nodes without animation overhead.
vi.mock("framer-motion", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require("react");

  const SKIP = new Set([
    "initial", "animate", "exit", "variants", "custom", "layout", "layoutId",
    "whileHover", "whileTap", "whileFocus", "whileInView", "whileDrag",
    "transition", "drag", "dragConstraints", "dragElastic", "dragMomentum",
    "onAnimationStart", "onAnimationComplete", "onHoverStart", "onHoverEnd",
    "onTapStart", "onTap", "onTapCancel",
  ]);

  function makeEl(tag: string) {
    return R.forwardRef(function MotionEl(allProps: Record<string, unknown>, ref: unknown) {
      const out: Record<string, unknown> = { ref };
      for (const [k, v] of Object.entries(allProps)) {
        if (!SKIP.has(k)) out[k] = v;
      }
      const { children, ...rest } = out;
      return R.createElement(tag, rest, children);
    });
  }

  return {
    motion: {
      div: makeEl("div"),
      span: makeEl("span"),
      button: makeEl("button"),
      p: makeEl("p"),
      a: makeEl("a"),
      ul: makeEl("ul"),
      li: makeEl("li"),
      nav: makeEl("nav"),
      section: makeEl("section"),
      article: makeEl("article"),
      header: makeEl("header"),
      footer: makeEl("footer"),
      h1: makeEl("h1"),
      h2: makeEl("h2"),
      h3: makeEl("h3"),
    },
    AnimatePresence: ({ children }: { children?: unknown }) => children,
    useReducedMotion: () => false,
    useAnimation: () => ({ start: vi.fn(), stop: vi.fn() }),
    useMotionValue: (v: unknown) => ({ get: () => v, set: vi.fn() }),
    useSpring: (v: unknown) => v,
    LayoutGroup: ({ children }: { children?: unknown }) => children,
    useInView: () => true,
    HTMLMotionProps: {},
  };
});
