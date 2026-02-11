"use client";

import { touchPreferencesUpdatedAt } from "@/lib/preferencesSync";
import { getStorageScope } from "@/lib/storage";

export type Theme = "light" | "dark";

const THEME_KEY = "velanovo-theme";

function themeKey() {
  const scope = getStorageScope();
  return scope === "default" ? THEME_KEY : `${THEME_KEY}::${scope}`;
}

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const stored = localStorage.getItem(themeKey()) || localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;

  // Check system preference
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

export function setTheme(theme: Theme) {
  localStorage.setItem(themeKey(), theme);
  applyTheme(theme);
  touchPreferencesUpdatedAt();
}

export function applyTheme(theme: Theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme", "light");
  }
}

export function toggleTheme(): Theme {
  const current = getTheme();
  const next = current === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}
