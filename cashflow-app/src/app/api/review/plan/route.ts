import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Plan } from "@/data/plan";
import { REVIEW_COOKIE_NAME, saveReviewPlan, ensureReviewPlan } from "@/lib/reviewStore";

export const runtime = "nodejs";

async function getToken() {
  const cookieStore = await cookies();
  return cookieStore.get(REVIEW_COOKIE_NAME)?.value;
}

export async function GET() {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Missing review token." }, { status: 401 });
  }

  const { plan } = ensureReviewPlan(token);
  return NextResponse.json({ plan });
}

export async function PUT(req: Request) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Missing review token." }, { status: 401 });
  }

  let plan: Plan | null = null;
  try {
    const body = (await req.json()) as Plan;
    if (body && typeof body === "object") {
      plan = body;
    }
  } catch {
    plan = null;
  }

  if (!plan) {
    return NextResponse.json({ error: "Invalid plan payload." }, { status: 400 });
  }

  saveReviewPlan(token, plan);
  return NextResponse.json({ ok: true });
}
