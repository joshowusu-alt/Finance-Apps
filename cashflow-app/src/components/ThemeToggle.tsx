"use client";

import { useEffect, useState } from "react";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(getTheme());
  }, []);

  const handleToggle = () => {
    const newTheme = toggleTheme();
    setTheme(newTheme);
  };

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <button
        className="rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
        aria-label="Toggle theme"
      >
        <span className="text-xl">🌙</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className="rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <span className="text-xl">{theme === "light" ? "🌙" : "☀️"}</span>
    </button>
  );
}
