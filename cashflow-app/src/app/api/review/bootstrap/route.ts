import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureReviewPlan, REVIEW_COOKIE_MAX_AGE, REVIEW_COOKIE_NAME } from "@/lib/reviewStore";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let tokenFromBody: string | undefined;
  try {
    const body = (await req.json()) as { token?: string };
    if (typeof body?.token === "string") {
      tokenFromBody = body.token;
    }
  } catch {
    tokenFromBody = undefined;
  }

  const cookieStore = await cookies();
  const tokenFromCookie = cookieStore.get(REVIEW_COOKIE_NAME)?.value;

  const { token, plan } = ensureReviewPlan(tokenFromBody || tokenFromCookie);
  const response = NextResponse.json({ plan });

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
