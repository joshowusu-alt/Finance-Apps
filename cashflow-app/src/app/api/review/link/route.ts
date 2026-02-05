import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureReviewPlan, REVIEW_COOKIE_MAX_AGE, REVIEW_COOKIE_NAME } from "@/lib/reviewStore";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(REVIEW_COOKIE_NAME)?.value;
  const { token } = await ensureReviewPlan(existingToken);

  const response = NextResponse.json({ token });
  response.cookies.set({
    name: REVIEW_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: REVIEW_COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}
