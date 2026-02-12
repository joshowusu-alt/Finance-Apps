"use client";

import { useEffect } from "react";
import { getTheme, applyTheme } from "@/lib/theme";
import { PREFS_UPDATED_EVENT } from "@/lib/preferencesSync";
import { SCOPE_UPDATED_EVENT } from "@/lib/storage";

export default function ThemeInitializer() {
  useEffect(() => {
    const syncTheme = () => applyTheme(getTheme());
    syncTheme();
    window.addEventListener(PREFS_UPDATED_EVENT, syncTheme);
    window.addEventListener(SCOPE_UPDATED_EVENT, syncTheme);
    window.addEventListener("focus", syncTheme);
    return () => {
      window.removeEventListener(PREFS_UPDATED_EVENT, syncTheme);
      window.removeEventListener(SCOPE_UPDATED_EVENT, syncTheme);
      window.removeEventListener("focus", syncTheme);
    };
  }, []);

  return null;
}
