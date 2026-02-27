import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function proxy(request: NextRequest) {
  if (!url || !key) return NextResponse.next();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — do not remove this line
  await supabase.auth.getUser();

  // Restrict CORS to same-origin for API routes.
  // Cron routes are called server-to-server by Vercel (no Origin header) and
  // authenticate via Authorization: Bearer <CRON_SECRET> — exempt them here.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const isCronRoute = request.nextUrl.pathname.startsWith("/api/cron/");
    if (!isCronRoute) {
      const origin = request.headers.get("origin");
      const host = request.headers.get("host");
      if (!origin) {
        // Requests with no Origin header (curl, Postman, server-to-server) are
        // not from a browser page — block them on browser-facing endpoints.
        return new NextResponse(null, { status: 403 });
      }
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return new NextResponse(null, { status: 403 });
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
