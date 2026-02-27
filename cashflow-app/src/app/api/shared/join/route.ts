/**
 * POST /api/shared/join
 * Body: { code: string }
 * Returns { joinToken } — the caller must store this in localStorage
 * under CF_JOIN_TOKEN_KEY and include it as an X-Join-Token header
 * on subsequent /api/main/plan requests.
 */
import { NextResponse } from "next/server";
import { joinByShareCode } from "@/lib/sharingStore";
import { createRateLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Strict limit: share-code join is rarely retried legitimately, but the short
// code space makes it trivially brute-forceable without a rate limit.
const checkJoinLimit = createRateLimiter(10, 60_000);

export async function POST(req: Request) {
  // Rate-limit by IP to prevent share-code brute force.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkJoinLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  let code: string | undefined;
  try {
    const body = (await req.json()) as { code?: string };
    code = typeof body?.code === "string" ? body.code.trim() : undefined;
  } catch {
    code = undefined;
  }

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const joinToken = await joinByShareCode(code);
  if (!joinToken) {
    return NextResponse.json({ error: "Invalid or expired share code" }, { status: 404 });
  }

  return NextResponse.json({ joinToken });
}
