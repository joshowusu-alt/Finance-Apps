import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Plan } from "@/data/plan";
import { MAIN_COOKIE_NAME, saveMainPlan, ensureMainPlan } from "@/lib/mainStore";

export const runtime = "nodejs";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get(MAIN_COOKIE_NAME)?.value;
}

export async function GET() {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Missing main token." }, { status: 401 });
  }

  const { plan, prevPlan, updatedAt } = ensureMainPlan(token);
  return NextResponse.json({ plan, prevPlan, updatedAt });
}

type PlanPayload = Plan | { plan?: Plan; prevPlan?: Plan | null };

export async function PUT(req: Request) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Missing main token." }, { status: 401 });
  }

  let plan: Plan | null = null;
  let prevPlan: Plan | null = null;
  try {
    const body = (await req.json()) as PlanPayload;
    if (body && typeof body === "object") {
      if ("plan" in body) {
        if (body.plan && typeof body.plan === "object") {
          plan = body.plan;
        }
        if (body.prevPlan && typeof body.prevPlan === "object") {
          prevPlan = body.prevPlan;
        }
      } else {
        plan = body as Plan;
      }
    }
  } catch {
    plan = null;
  }

  if (!plan) {
    return NextResponse.json({ error: "Invalid plan payload." }, { status: 400 });
  }

  const updatedAt = saveMainPlan(token, plan, prevPlan);
  return NextResponse.json({ ok: true, updatedAt });
}
