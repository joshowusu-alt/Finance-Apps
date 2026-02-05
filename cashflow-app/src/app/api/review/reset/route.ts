import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resetReviewPlan, REVIEW_COOKIE_NAME } from "@/lib/reviewStore";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(REVIEW_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Missing review token." }, { status: 401 });
  }

  const plan = await resetReviewPlan(token);
  return NextResponse.json({ plan });
}
