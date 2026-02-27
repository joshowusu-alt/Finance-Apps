"use client";

import { useEffect, useState } from "react";

export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState<boolean>(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme") === "dark"
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(
        document.documentElement.getAttribute("data-theme") === "dark"
      );
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return isDark;
}
