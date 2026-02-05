import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureMainPlan, MAIN_COOKIE_MAX_AGE, MAIN_COOKIE_NAME } from "@/lib/mainStore";

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
  const tokenFromCookie = cookieStore.get(MAIN_COOKIE_NAME)?.value;

  const { token, plan, prevPlan, updatedAt } = await ensureMainPlan(tokenFromBody || tokenFromCookie);
  const response = NextResponse.json({ plan, prevPlan, updatedAt });

  response.cookies.set({
    name: MAIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAIN_COOKIE_MAX_AGE,
    path: "/",
  });

  return response;
}
