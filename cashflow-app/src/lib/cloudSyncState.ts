"use client";

import { getStorageScope } from "@/lib/storage";

const CLOUD_SYNC_AT_KEY = "cashflow_cloud_sync_at_v1";
const CLOUD_SERVER_UPDATED_KEY = "cashflow_cloud_server_updated_at_v1";
const CLOUD_SERVER_SYNCED_KEY = "cashflow_cloud_server_synced_at_v1";
const CLOUD_PLAN_HASH_KEY = "cashflow_cloud_plan_hash_v1";
const CLOUD_PREFS_HASH_KEY = "cashflow_cloud_prefs_hash_v1";
const CLOUD_PREFS_SERVER_UPDATED_KEY = "cashflow_cloud_prefs_server_updated_at_v1";
const CLOUD_PREFS_SYNCED_KEY = "cashflow_cloud_prefs_synced_at_v1";

function scopedKey(base: string, scope = getStorageScope()) {
  return scope === "default" ? base : `${base}::${scope}`;
}

function scenarioKey(base: string, scenarioId: string, scope = getStorageScope()) {
  const scoped = scopedKey(base, scope);
  return scenarioId ? `${scoped}::${scenarioId}` : scoped;
}

function parseStamp(value?: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const asDate = new Date(value).getTime();
  return Number.isFinite(asDate) && asDate > 0 ? asDate : null;
}

export function getCloudSyncAt() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(scopedKey(CLOUD_SYNC_AT_KEY)) ?? "";
}

export function setCloudSyncAt(value?: string | number | Date) {
  if (typeof window === "undefined") return "";
  const stamp =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "number"
        ? new Date(value).toISOString()
        : value ?? new Date().toISOString();
  window.localStorage.setItem(scopedKey(CLOUD_SYNC_AT_KEY), stamp);
  return stamp;
}

export function getCloudServerUpdatedAt(scenarioId: string) {
  if (typeof window === "undefined") return null;
  return parseStamp(window.localStorage.getItem(scenarioKey(CLOUD_SERVER_UPDATED_KEY, scenarioId)));
}

export function setCloudServerUpdatedAt(scenarioId: string, value: number | string | null) {
  if (typeof window === "undefined") return null;
  const key = scenarioKey(CLOUD_SERVER_UPDATED_KEY, scenarioId);
  if (!value) {
    window.localStorage.removeItem(key);
    return null;
  }
  const stamp = typeof value === "number" ? String(value) : value;
  window.localStorage.setItem(key, stamp);
  return parseStamp(stamp);
}

export function getCloudServerSyncedAt(scenarioId: string) {
  if (typeof window === "undefined") return null;
  return parseStamp(window.localStorage.getItem(scenarioKey(CLOUD_SERVER_SYNCED_KEY, scenarioId)));
}

export function setCloudServerSyncedAt(scenarioId: string, value: number | string | null) {
  if (typeof window === "undefined") return null;
  const key = scenarioKey(CLOUD_SERVER_SYNCED_KEY, scenarioId);
  if (!value) {
    window.localStorage.removeItem(key);
    return null;
  }
  const stamp = typeof value === "number" ? String(value) : value;
  window.localStorage.setItem(key, stamp);
  return parseStamp(stamp);
}

export function getCloudPlanHash(scenarioId: string) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(scenarioKey(CLOUD_PLAN_HASH_KEY, scenarioId)) ?? "";
}

export function setCloudPlanHash(scenarioId: string, hash: string) {
  if (typeof window === "undefined") return "";
  const value = hash ?? "";
  window.localStorage.setItem(scenarioKey(CLOUD_PLAN_HASH_KEY, scenarioId), value);
  return value;
}

export function getCloudPrefsHash() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(scopedKey(CLOUD_PREFS_HASH_KEY)) ?? "";
}

export function setCloudPrefsHash(hash: string) {
  if (typeof window === "undefined") return "";
  const value = hash ?? "";
  window.localStorage.setItem(scopedKey(CLOUD_PREFS_HASH_KEY), value);
  return value;
}

export function getCloudPrefsServerUpdatedAt() {
  if (typeof window === "undefined") return null;
  return parseStamp(window.localStorage.getItem(scopedKey(CLOUD_PREFS_SERVER_UPDATED_KEY)));
}

export function setCloudPrefsServerUpdatedAt(value: number | string | null) {
  if (typeof window === "undefined") return null;
  const key = scopedKey(CLOUD_PREFS_SERVER_UPDATED_KEY);
  if (!value) {
    window.localStorage.removeItem(key);
    return null;
  }
  const stamp = typeof value === "number" ? String(value) : value;
  window.localStorage.setItem(key, stamp);
  return parseStamp(stamp);
}

export function getCloudPrefsSyncedAt() {
  if (typeof window === "undefined") return null;
  return parseStamp(window.localStorage.getItem(scopedKey(CLOUD_PREFS_SYNCED_KEY)));
}

export function setCloudPrefsSyncedAt(value: number | string | null) {
  if (typeof window === "undefined") return null;
  const key = scopedKey(CLOUD_PREFS_SYNCED_KEY);
  if (!value) {
    window.localStorage.removeItem(key);
    return null;
  }
  const stamp = typeof value === "number" ? String(value) : value;
  window.localStorage.setItem(key, stamp);
  return parseStamp(stamp);
}
