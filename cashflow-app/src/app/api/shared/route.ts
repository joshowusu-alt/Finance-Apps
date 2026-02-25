/**
 * POST /api/shared
 * Generates (or retrieves) a share code for the current user's main plan.
 * Authenticated by the cf_main_token cookie.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MAIN_COOKIE_NAME } from "@/lib/mainStore";
import { hashToken } from "@/lib/tokenPlanBase";
import { getOrCreateShareCode, revokeShareCode } from "@/lib/sharingStore";

export const runtime = "nodejs";

async function getTokenHash() {
  const cookieStore = await cookies();
  const token = cookieStore.get(MAIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return hashToken(token);
}

/** Generate or fetch the share code for the current user's plan. */
export async function POST() {
  const tokenHash = await getTokenHash();
  if (!tokenHash) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const shareCode = await getOrCreateShareCode(tokenHash);
    return NextResponse.json({ shareCode });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Revoke the share code and all issued join tokens. */
export async function DELETE() {
  const tokenHash = await getTokenHash();
  if (!tokenHash) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    await revokeShareCode(tokenHash);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
