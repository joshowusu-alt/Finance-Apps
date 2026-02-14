import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ensureMainPlan, MAIN_COOKIE_MAX_AGE, MAIN_COOKIE_NAME } from "@/lib/mainStore";
import { setAuthCookie } from "@/lib/apiHelpers";

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
  setAuthCookie(response, MAIN_COOKIE_NAME, token, MAIN_COOKIE_MAX_AGE);
  return response;
}
