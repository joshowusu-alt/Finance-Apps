import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Plan } from "@/data/plan";
import { MAIN_COOKIE_NAME, saveMainPlan, saveMainPlanByHash, ensureMainPlan } from "@/lib/mainStore";
import { createRateLimiter } from "@/lib/rateLimit";
import { resolvePlanHashFromJoinToken } from "@/lib/sharingStore";
import { getSQL } from "@/lib/db";
import { parsePlan } from "@/lib/tokenPlanBase";
import { apiError } from "@/lib/apiHelpers";
import { validatePlan } from "@/lib/planSchema";

export const runtime = "nodejs";

const checkPlanLimit = createRateLimiter(30, 60_000);

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get(MAIN_COOKIE_NAME)?.value;
}

/** Try to resolve plan via join token header (household sharing). */
async function getPlanByJoinToken(req: Request) {
  const joinToken = req.headers.get("x-join-token");
  if (!joinToken) return null;

  const planHash = await resolvePlanHashFromJoinToken(joinToken);
  if (!planHash) return null;

  const sql = getSQL();
  const rows = await sql`
    SELECT plan_json, prev_plan_json, updated_at
    FROM main_plans WHERE token_hash = ${planHash} LIMIT 1
  `;
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    planHash,
    plan: parsePlan(row.plan_json),
    prevPlan: row.prev_plan_json ? parsePlan(row.prev_plan_json) : null,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function GET(req: Request) {
  // Try join token first (household partner)
  const joinData = await getPlanByJoinToken(req);
  if (joinData) {
    return NextResponse.json({
      plan: joinData.plan,
      prevPlan: joinData.prevPlan,
      updatedAt: joinData.updatedAt,
    });
  }

  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Missing main token." }, { status: 401 });
  }

  const { plan, prevPlan, updatedAt } = await ensureMainPlan(token);
  return NextResponse.json({ plan, prevPlan, updatedAt });
}

type PlanPayload = Plan | { plan?: Plan; prevPlan?: Plan | null };

export async function PUT(req: Request) {
  // 1. Size check — read raw text first
  const rawBody = await req.text();
  if (rawBody.length > 1_048_576) {
    return apiError("Plan payload too large (max 1 MB)", 413);
  }
  // 2. Parse JSON
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return apiError("Invalid JSON", 400);
  }

  // Try join token first (household partner)
  const joinData = await getPlanByJoinToken(req);
  if (joinData) {
    let planRaw: unknown = null;
    let prevPlan: Plan | null = null;
    const body = parsedBody as PlanPayload;
    if (body && typeof body === "object") {
      if ("plan" in body) {
        planRaw = body.plan ?? null;
        prevPlan = body.prevPlan ?? null;
      } else {
        planRaw = body;
      }
    }
    if (!planRaw) return NextResponse.json({ error: "Invalid plan payload." }, { status: 400 });
    // 3. Validate schema
    const validation = validatePlan(planRaw);
    if (!validation.ok) {
      return apiError(`Invalid plan: ${validation.error}`, 400);
    }
    const plan = validation.plan;
    const updatedAt = await saveMainPlanByHash(joinData.planHash, plan, prevPlan);
    return NextResponse.json({ ok: true, updatedAt });
  }

  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Missing main token." }, { status: 401 });
  }

  if (!(await checkPlanLimit(token))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let planRaw: unknown = null;
  let prevPlan: Plan | null = null;
  const body = parsedBody as PlanPayload;
  if (body && typeof body === "object") {
    if ("plan" in body) {
      if (body.plan && typeof body.plan === "object") {
        planRaw = body.plan;
      }
      if (body.prevPlan && typeof body.prevPlan === "object") {
        prevPlan = body.prevPlan;
      }
    } else {
      planRaw = body;
    }
  }

  if (!planRaw) {
    return NextResponse.json({ error: "Invalid plan payload." }, { status: 400 });
  }
  // 3. Validate schema
  const validation = validatePlan(planRaw);
  if (!validation.ok) {
    return apiError(`Invalid plan: ${validation.error}`, 400);
  }
  const plan = validation.plan;

  const updatedAt = await saveMainPlan(token, plan, prevPlan);
  return NextResponse.json({ ok: true, updatedAt });
}
