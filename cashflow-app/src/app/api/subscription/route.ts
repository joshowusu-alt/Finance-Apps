import { NextResponse } from "next/server";
import { resolveAuthWithCookie } from "@/lib/apiHelpers";
import { getUserSubscription } from "@/lib/subscription";

export async function GET() {
  const auth = await resolveAuthWithCookie();
  if (!auth) return NextResponse.json({ status: "free", isPro: false });
  const sub = await getUserSubscription(auth.userId);
  return NextResponse.json({
    status: sub.status,
    isPro: sub.isPro,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  });
}
