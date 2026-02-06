"use client";

import { useEffect } from "react";
import { getTheme, applyTheme } from "@/lib/theme";

export default function ThemeInitializer() {
  useEffect(() => {
    applyTheme(getTheme());
  }, []);

  return null;
}
