import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Lightweight cron endpoint that pings Supabase to prevent
 * the free-tier project from being paused due to inactivity.
 * Triggered daily by Vercel Cron.
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  // Verify the request comes from Vercel Cron (not public callers)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  // Create a minimal Supabase client (no cookies needed for a simple ping)
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });

  // A lightweight query that generates API activity on the Supabase project
  const { error } = await supabase.auth.getSession();

  return NextResponse.json({
    ok: !error,
    timestamp: new Date().toISOString(),
    ...(error && { error: error.message }),
  });
}
