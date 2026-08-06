import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { revokeSession } from "@/lib/services/authService";
import { getRefreshCookie, clearAuthCookies } from "@/lib/auth/session";
import { loadConfig } from "@/lib/config";

export async function POST(request: Request) {
  const refreshToken = getRefreshCookie(request);
  await revokeSession(getDb(), refreshToken ?? "");
  const cfg = loadConfig();
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res, cfg.cookieSecure);
  return res;
}
