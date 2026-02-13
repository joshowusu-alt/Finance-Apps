"use client";

import { useEffect, useState } from "react";
import { loadBranding, subscribeToBranding, type BrandingSettings } from "@/lib/branding";

export function useBranding(): BrandingSettings {
  const [brand, setBrand] = useState<BrandingSettings>(() => loadBranding());

  useEffect(() => {
    const unsubscribe = subscribeToBranding(() => setBrand(loadBranding()));
    return () => unsubscribe();
  }, []);

  return brand;
}
