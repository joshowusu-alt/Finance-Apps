/**
 * auditLog.ts
 *
 * Canonical home for the plan-change audit trail:
 * types, localStorage I/O, and the append helper that
 * storage.ts calls after building an audit entry.
 *
 * Intentionally self-contained — no imports from storage.ts or currency.ts —
 * to avoid circular dependencies.
 */

// ── Storage keys (mirrored from storage.ts; must stay in sync) ───────────────
const AUDIT_KEY = "cashflow_audit_v1";
const AUDIT_ACTOR_KEY = "cashflow_audit_actor_v1";
const SCOPE_KEY = "cashflow_scope_v1";
const DEFAULT_SCOPE = "default";

// ── Local utility helpers ─────────────────────────────────────────────────────

function getScope(): string {
  if (typeof window === "undefined") return DEFAULT_SCOPE;
  const scope = window.localStorage.getItem(SCOPE_KEY);
  return scope && scope.trim() ? scope : DEFAULT_SCOPE;
}

function scopedKey(baseKey: string, scope = getScope()): string {
  return scope === DEFAULT_SCOPE ? baseKey : `${baseKey}::${scope}`;
}

function dispatchBrowserEvent(name: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(name));
}

function auditKey(scope = getScope()): string {
  return scopedKey(AUDIT_KEY, scope);
}

function auditActorKey(scope = getScope()): string {
  return scopedKey(AUDIT_ACTOR_KEY, scope);
}

// ── Types & Events ────────────────────────────────────────────────────────────

export const AUDIT_UPDATED_EVENT = "cashflow:audit-updated";

export type AuditEntry = {
  id: string;
  timestamp: string;
  actor: string;
  action: "edit" | "import" | "reset" | "sync" | "undo" | "scenario" | "unknown";
  summary: string;
  changes: string[];
};

// ── Public API ────────────────────────────────────────────────────────────────

export function loadAuditTrail(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(auditKey());
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearAuditTrail(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(auditKey());
  dispatchBrowserEvent(AUDIT_UPDATED_EVENT);
}

export function getAuditActor(): string {
  if (typeof window === "undefined") return "Local user";
  return window.localStorage.getItem(auditActorKey()) || "Local user";
}

export function setAuditActor(name: string): string {
  if (typeof window === "undefined") return "Local user";
  const value = name?.trim() || "Local user";
  window.localStorage.setItem(auditActorKey(), value);
  return value;
}

/**
 * Prepend `entry` to the stored audit trail (max 200 entries) and
 * fire the AUDIT_UPDATED_EVENT browser event.
 *
 * Called by storage.ts after constructing the entry from a plan diff.
 */
export function appendAuditEntry(entry: AuditEntry): void {
  if (typeof window === "undefined") return;
  const nextTrail = [entry, ...loadAuditTrail()].slice(0, 200);
  window.localStorage.setItem(auditKey(), JSON.stringify(nextTrail));
  dispatchBrowserEvent(AUDIT_UPDATED_EVENT);
}
