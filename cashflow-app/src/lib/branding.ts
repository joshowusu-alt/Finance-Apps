"use client";

import { getStorageScope, SCOPE_UPDATED_EVENT } from "@/lib/storage";

export type BrandingSettings = {
  name: string;
  tagline?: string;
  logoUrl?: string;
  logoUrlDark?: string;
  reportAccent?: string;
  reportFooter?: string;
};

export const DEFAULT_BRAND: BrandingSettings = {
  name: "Velanovo",
  tagline: "Private Wealth",
  logoUrl: "",
  logoUrlDark: "",
  reportAccent: "#142732",
  reportFooter: "",
};

const BRANDING_KEY = "cashflow_branding_v1";
export const BRAND_UPDATED_EVENT = "cashflow:brand-updated";

function brandKey(scope = getStorageScope()) {
  return scope === "default" ? BRANDING_KEY : `${BRANDING_KEY}::${scope}`;
}

function dispatchBrandEvent() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BRAND_UPDATED_EVENT));
}

function normalizeBranding(raw?: Partial<BrandingSettings> | null): BrandingSettings {
  const next = { ...DEFAULT_BRAND, ...(raw ?? {}) };
  next.name = next.name?.trim() || DEFAULT_BRAND.name;
  next.tagline = next.tagline?.trim() || "";
  next.logoUrl = next.logoUrl?.trim() || "";
  next.logoUrlDark = next.logoUrlDark?.trim() || "";
  next.reportAccent = next.reportAccent?.trim() || DEFAULT_BRAND.reportAccent;
  next.reportFooter = next.reportFooter?.trim() || "";
  return next;
}

export function loadBranding(): BrandingSettings {
  if (typeof window === "undefined") return DEFAULT_BRAND;
  const raw = window.localStorage.getItem(brandKey());
  if (!raw) return DEFAULT_BRAND;
  try {
    return normalizeBranding(JSON.parse(raw) as Partial<BrandingSettings>);
  } catch {
    return DEFAULT_BRAND;
  }
}

export function saveBranding(next: Partial<BrandingSettings>) {
  if (typeof window === "undefined") return DEFAULT_BRAND;
  const merged = normalizeBranding({ ...loadBranding(), ...next });
  window.localStorage.setItem(brandKey(), JSON.stringify(merged));
  dispatchBrandEvent();
  return merged;
}

export function resetBranding() {
  if (typeof window === "undefined") return DEFAULT_BRAND;
  window.localStorage.removeItem(brandKey());
  dispatchBrandEvent();
  return DEFAULT_BRAND;
}

export function applyBranding(brand: BrandingSettings) {
  if (typeof document === "undefined") return;
  if (brand?.name) {
    document.title = brand.name;
  }
  if (brand?.reportAccent) {
    document.documentElement.style.setProperty("--brand-report-accent", brand.reportAccent);
  } else {
    document.documentElement.style.removeProperty("--brand-report-accent");
  }
}

function normalizeHexColor(input?: string | null) {
  if (!input) return null;
  const value = input.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{3}$/.test(value) && !/^[0-9a-fA-F]{6}$/.test(value)) return null;
  const hex = value.length === 3 ? value.split("").map((c) => `${c}${c}`).join("") : value;
  const num = Number.parseInt(hex, 16);
  if (!Number.isFinite(num)) return null;
  return {
    hex: `#${hex.toLowerCase()}`,
    rgb: [
      (num >> 16) & 255,
      (num >> 8) & 255,
      num & 255,
    ] as [number, number, number],
  };
}

export function getReportBranding() {
  const brand = loadBranding();
  const accent = normalizeHexColor(brand.reportAccent) ?? normalizeHexColor(DEFAULT_BRAND.reportAccent);
  const nameSlug = (brand.name || DEFAULT_BRAND.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "velanovo";
  return {
    brand,
    accentRgb: accent?.rgb ?? [20, 39, 50],
    filenamePrefix: nameSlug,
  };
}

export function subscribeToBranding(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => callback();
  window.addEventListener(BRAND_UPDATED_EVENT, handler);
  window.addEventListener(SCOPE_UPDATED_EVENT, handler);
  window.addEventListener("focus", handler);
  return () => {
    window.removeEventListener(BRAND_UPDATED_EVENT, handler);
    window.removeEventListener(SCOPE_UPDATED_EVENT, handler);
    window.removeEventListener("focus", handler);
  };
}
