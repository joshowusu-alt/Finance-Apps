"use client";

import { useEffect } from "react";
import { applyBranding, loadBranding, subscribeToBranding } from "@/lib/branding";

export default function BrandInitializer() {
  useEffect(() => {
    const sync = () => applyBranding(loadBranding());
    sync();
    const unsubscribe = subscribeToBranding(sync);
    return () => unsubscribe();
  }, []);

  return null;
}
