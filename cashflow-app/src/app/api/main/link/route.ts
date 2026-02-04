import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import os from "os";
import { ensureMainPlan, MAIN_COOKIE_MAX_AGE, MAIN_COOKIE_NAME } from "@/lib/mainStore";

export const runtime = "nodejs";

const DEFAULT_TUNNEL_APIS = [
  "http://127.0.0.1:4040",
  "http://127.0.0.1:4041",
  "http://localhost:4040",
  "http://localhost:4041",
];

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function isPrivateIpv4(address: string) {
  if (address.startsWith("10.")) return true;
  if (address.startsWith("192.168.")) return true;
  if (!address.startsWith("172.")) return false;
  const parts = address.split(".");
  if (parts.length < 2) return false;
  const second = Number(parts[1]);
  return Number.isInteger(second) && second >= 16 && second <= 31;
}

function getLanUrl() {
  if (process.env.NODE_ENV === "production") return null;
  const port = process.env.PORT || "3000";
  const ifaces = os.networkInterfaces();
  for (const entries of Object.values(ifaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (!isPrivateIpv4(entry.address)) continue;
      return `http://${entry.address}:${port}`;
    }
  }
  return null;
}

async function getNgrokPublicUrl() {
  const configured = process.env.NGROK_PUBLIC_URL || process.env.CASHFLOW_PUBLIC_URL;
  if (configured) return normalizeOrigin(configured);

  const apiOverrides = [process.env.NGROK_API_URL].filter(Boolean) as string[];
  const candidates = [...apiOverrides, ...DEFAULT_TUNNEL_APIS];

  for (const base of candidates) {
    try {
      const res = await fetch(`${normalizeOrigin(base)}/api/tunnels`, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as { tunnels?: { public_url?: string }[] };
      const tunnels = Array.isArray(data.tunnels) ? data.tunnels : [];
      const https = tunnels.find((t) => t.public_url?.startsWith("https://"));
      const first = https?.public_url ?? tunnels[0]?.public_url;
      if (first) return normalizeOrigin(first);
    } catch {
      // Keep trying other candidates.
    }
  }

  return null;
}

export async function POST() {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(MAIN_COOKIE_NAME)?.value;
  const { token } = ensureMainPlan(existingToken);
  const publicUrl = await getNgrokPublicUrl();
  const localUrl = publicUrl ? null : getLanUrl();

  const response = NextResponse.json({ token, publicUrl, localUrl });
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
