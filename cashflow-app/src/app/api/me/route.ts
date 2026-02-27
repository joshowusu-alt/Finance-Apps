import { NextResponse } from "next/server";
import { resolveAuthWithCookie, unauthorized } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function GET() {
  const auth = await resolveAuthWithCookie();

  if (!auth) {
    return unauthorized("Not authenticated");
  }

  // Map internal mode names to the external API shape (backward-compat)
  const mode = auth.mode === "supabase" ? "supabase" : "main";
  return NextResponse.json({ userId: auth.userId, mode });
}
