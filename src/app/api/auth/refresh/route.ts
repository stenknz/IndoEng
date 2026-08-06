import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { refreshSession } from "@/lib/services/authService";
import { getRefreshCookie, setAuthCookies } from "@/lib/auth/session";
import { loadConfig } from "@/lib/config";
import { HttpError } from "@/lib/auth/requireUser";

export async function POST(request: Request) {
  try {
    const refreshToken = getRefreshCookie(request);
    const session = await refreshSession(getDb(), refreshToken ?? "", {});
    const cfg = loadConfig();
    const res = NextResponse.json({ user: session.user });
    setAuthCookies(res, session.accessToken, session.refreshToken, session.refreshMaxAgeSeconds, cfg.cookieSecure);
    return res;
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
