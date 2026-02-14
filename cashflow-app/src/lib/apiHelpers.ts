/**
 * Shared API utilities — DRY extraction of repeated patterns
 * across all API route handlers.
 *
 * Covers: auth resolution, plan loading, error responses, cookie helpers.
 */

import { NextResponse } from "next/server";
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
  mode: "supabase" | "main-token" | "body-userId";
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective userId from (in priority order):
 *   1. Supabase session
 *   2. Request body `userId` field
 *
 * Returns null if no identity can be determined.
 */
export async function resolveAuth(
  bodyUserId?: string,
): Promise<ResolvedAuth | null> {
  const supabase = await createClient();
  const user = supabase
    ? (await supabase.auth.getUser()).data.user
    : null;

  if (user && supabase) {
    return { userId: user.id, supabase, user, mode: "supabase" };
  }

  if (bodyUserId) {
    return { userId: bodyUserId, supabase, user: null, mode: "body-userId" };
  }

  return null;
}

/**
 * Resolve auth, falling back to the main cookie token when no Supabase
 * session and no body userId exist.
 */
export async function resolveAuthWithCookie(
  bodyUserId?: string,
): Promise<ResolvedAuth | null> {
  const result = await resolveAuth(bodyUserId);
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
  if (auth.user && auth.supabase) {
    const { data } = await auth.supabase
      .from("plaid_connections")
      .select("access_token, item_id")
      .eq("user_id", auth.userId);
    return (data ?? []) as PlaidConnection[];
  }

  // Neon fallback
  const { getSQL } = await import("@/lib/db");
  const sql = getSQL();
  return (await sql`
    SELECT access_token, item_id
    FROM plaid_connections
    WHERE user_id = ${auth.userId}
  `) as PlaidConnection[];
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
  return apiError(message, 400, details);
}

/** 401 Unauthorized */
export function unauthorized(message = "Not authenticated") {
  return apiError(message, 401);
}

/** 500 Internal Server Error */
export function serverError(message: string, details?: string) {
  return apiError(message, 500, details);
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
