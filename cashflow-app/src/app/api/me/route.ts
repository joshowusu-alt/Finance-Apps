import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MAIN_COOKIE_NAME } from "@/lib/mainStore";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(MAIN_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Return the token as the userId (it's already hashed on the server)
  return NextResponse.json({ userId: token });
}
