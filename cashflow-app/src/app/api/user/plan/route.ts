/**
 * GET /api/user/plan
 * Returns the most recently updated plan for the authenticated Supabase user.
 * Reads from the `user_plans` table keyed by user_id and scenario_id.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: rows, error: dbError } = await supabase
    .from("user_plans")
    .select("plan_json, prev_plan_json, updated_at, scenario_id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ plan: null });
  }

  const row = rows[0];

  return NextResponse.json({
    plan: row.plan_json ?? null,
    prevPlan: row.prev_plan_json ?? null,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    scenarioId: row.scenario_id ?? null,
  });
}
