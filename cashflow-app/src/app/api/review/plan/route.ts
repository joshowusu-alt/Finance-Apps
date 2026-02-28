import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Plan } from "@/data/plan";
import { REVIEW_COOKIE_NAME, saveReviewPlan, ensureReviewPlan } from "@/lib/reviewStore";
import { apiError } from "@/lib/apiHelpers";
import { validatePlan } from "@/lib/planSchema";

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

  const { plan } = await ensureReviewPlan(token);
  return NextResponse.json({ plan });
}

export async function PUT(req: Request) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Missing review token." }, { status: 401 });
  }

  // 1. Size check — read raw text first
  const rawBody = await req.text();
  if (rawBody.length > 1_048_576) {
    return apiError("Plan payload too large (max 1 MB)", 413);
  }
  // 2. Parse JSON
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return apiError("Invalid JSON", 400);
  }
  // 3. Validate schema
  const validation = validatePlan(body);
  if (!validation.ok) {
    return apiError(`Invalid plan: ${validation.error}`, 400);
  }
  const plan: Plan = validation.plan;

  await saveReviewPlan(token, plan);
  return NextResponse.json({ ok: true });
}
