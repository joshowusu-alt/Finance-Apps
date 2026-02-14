import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureReviewPlan, REVIEW_COOKIE_MAX_AGE, REVIEW_COOKIE_NAME } from "@/lib/reviewStore";
import { setAuthCookie } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(REVIEW_COOKIE_NAME)?.value;
  const { token } = await ensureReviewPlan(existingToken);

  const response = NextResponse.json({ token });
  setAuthCookie(response, REVIEW_COOKIE_NAME, token, REVIEW_COOKIE_MAX_AGE);
  return response;
}
