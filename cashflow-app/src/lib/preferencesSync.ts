"use client";

import { getStorageScope } from "@/lib/storage";

const PREFS_UPDATED_KEY = "cashflow_prefs_updated_at_v1";

export const PREFS_UPDATED_EVENT = "cashflow:prefs-updated";

function scopedKey(base: string, scope = getStorageScope()) {
  return scope === "default" ? base : `${base}::${scope}`;
}

function dispatchBrowserEvent(name: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(name));
}

export function getPreferencesUpdatedAt() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(scopedKey(PREFS_UPDATED_KEY)) ?? "";
}

export function touchPreferencesUpdatedAt(value?: string | number | Date) {
  if (typeof window === "undefined") return "";
  const stamp =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "number"
        ? new Date(value).toISOString()
        : value ?? new Date().toISOString();
  window.localStorage.setItem(scopedKey(PREFS_UPDATED_KEY), stamp);
  dispatchBrowserEvent(PREFS_UPDATED_EVENT);
  return stamp;
}
