/**
 * Shared API utilities — DRY extraction of repeated patterns
 * across all API route handlers.
 *
 * Covers: auth resolution, plan loading, error responses, cookie helpers.
 */

import { NextResponse } from "next/server";
import { decrypt, isEncrypted } from "@/lib/encryption";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ensureMainPlan, MAIN_COOKIE_NAME } from "@/lib/mainStore";
import type { Plan } from "@/data/plan";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedAuth {
  /** Effective user ID (Supabase uid or anonymous token). */
  userId: string;
  /** Supabase client (null if unauthenticated / missing env vars). */
  supabase: SupabaseClient | null;
  /** Supabase user object (null if anonymous). */
  user: { id: string } | null;
  /** Auth mode used. */
  mode: "supabase" | "main-token";
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective userId from (in priority order):
 *   1. Supabase session
 *
 * Returns null if no identity can be determined.
 */
export async function resolveAuth(): Promise<ResolvedAuth | null> {
  const supabase = await createClient();
  const user = supabase
    ? (await supabase.auth.getUser()).data.user
    : null;

  if (user && supabase) {
    return { userId: user.id, supabase, user, mode: "supabase" };
  }

  return null;
}

/**
 * Resolve auth, falling back to the main cookie token when no Supabase
 * session exists.
 */
export async function resolveAuthWithCookie(): Promise<ResolvedAuth | null> {
  const result = await resolveAuth();
  if (result) return result;

  const cookieStore = await cookies();
  const token = cookieStore.get(MAIN_COOKIE_NAME)?.value;
  if (token) {
    const supabase = await createClient();
    return { userId: token, supabase, user: null, mode: "main-token" };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Plan loading (Supabase → main-token fallback)
// ---------------------------------------------------------------------------

/**
 * Load the active plan for the current user.
 * Tries Supabase first, falls back to main-token store.
 *
 * Eliminates the 25-line "fetch plan from Supabase" block duplicated
 * in ai/chat, insights, and plaid/sync routes.
 */
export async function loadActivePlan(
  auth: ResolvedAuth,
  fallbackPlan: Plan,
): Promise<{ plan: Plan; prevPlan: Plan | null; scenarioId: string }> {
  if (auth.user && auth.supabase) {
    const { data: scenarioRow } = await auth.supabase
      .from("user_scenarios")
      .select("scenario_id")
      .eq("user_id", auth.userId)
      .eq("active", true)
      .maybeSingle();
    const scenarioId = scenarioRow?.scenario_id ?? "default";

    const { data: planRow } = await auth.supabase
      .from("user_plans")
      .select("plan_json")
      .eq("user_id", auth.userId)
      .eq("scenario_id", scenarioId)
      .maybeSingle();

    if (planRow?.plan_json) {
      const plan =
        typeof planRow.plan_json === "string"
          ? (JSON.parse(planRow.plan_json) as Plan)
          : (planRow.plan_json as Plan);
      return { plan, prevPlan: null, scenarioId };
    }

    return { plan: fallbackPlan, prevPlan: null, scenarioId };
  }

  // Fallback: main-token store
  if (auth.mode === "main-token") {
    const main = await ensureMainPlan(auth.userId);
    return {
      plan: main.plan,
      prevPlan: main.prevPlan ?? null,
      scenarioId: "default",
    };
  }

  return { plan: fallbackPlan, prevPlan: null, scenarioId: "default" };
}

// ---------------------------------------------------------------------------
// Plaid connections
// ---------------------------------------------------------------------------

export type PlaidConnection = { access_token: string; item_id: string };

/**
 * Fetch all Plaid connections for a user.
 * Uses Supabase when authenticated, falls back to Neon.
 *
 * Eliminates the 15-line dual-path block duplicated 3× in accounts,
 * transactions, and sync routes.
 */
export async function fetchPlaidConnections(
  auth: ResolvedAuth,
): Promise<PlaidConnection[]> {
  const decryptToken = (raw: string): string =>
    isEncrypted(raw) ? decrypt(raw) : raw;

  if (auth.user && auth.supabase) {
    const { data } = await auth.supabase
      .from("plaid_connections")
      .select("access_token, item_id")
      .eq("user_id", auth.userId);
    return ((data ?? []) as PlaidConnection[]).map((c) => ({
      ...c,
      access_token: decryptToken(c.access_token),
    }));
  }

  // Neon fallback
  const { getSQL } = await import("@/lib/db");
  const sql = getSQL();
  const rows = (await sql`
    SELECT access_token, item_id
    FROM plaid_connections
    WHERE user_id = ${auth.userId}
  `) as PlaidConnection[];
  return rows.map((c) => ({ ...c, access_token: decryptToken(c.access_token) }));
}

// ---------------------------------------------------------------------------
// Consistent error responses
// ---------------------------------------------------------------------------

/** Standard error envelope: `{ error: string; details?: string }`. */
export function apiError(
  message: string,
  status: number,
  details?: string,
): NextResponse {
  return NextResponse.json(
    details ? { error: message, details } : { error: message },
    { status },
  );
}

/** 400 Bad Request */
export function badRequest(message: string, details?: string) {
  if (details) {
    console.error("[badRequest]", message, details);
  }
  return apiError(message, 400);
}

/** 401 Unauthorized */
export function unauthorized(message = "Not authenticated") {
  return apiError(message, 401);
}

/** 500 Internal Server Error */
export function serverError(message: string, details?: string) {
  if (details) {
    console.error("[serverError]", message, details);
  }
  return apiError(message, 500);  // no details in response body
}

// ---------------------------------------------------------------------------
// Cookie helper
// ---------------------------------------------------------------------------

/** Apply a standard httpOnly auth cookie to a NextResponse. */
export function setAuthCookie(
  response: NextResponse,
  name: string,
  value: string,
  maxAge: number,
): void {
  response.cookies.set({
    name,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  });
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const _rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-memory per-IP rate limiter (10 requests / 60 s by default).
 * Returns a 429 NextResponse when the limit is exceeded, otherwise null.
 */
export function checkRateLimit(
  req: Request,
  limit = 10,
  windowMs = 60_000,
): NextResponse | null {
  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const now = Date.now();
  const entry = _rateLimitStore.get(ip);

  if (!entry || now >= entry.resetAt) {
    _rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count += 1;
  if (entry.count > limit) {
    return apiError("Too many requests", 429);
  }

  return null;
}
