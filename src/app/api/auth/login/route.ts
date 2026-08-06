import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { login } from "@/lib/services/authService";
import { setAuthCookies } from "@/lib/auth/session";
import { loadConfig } from "@/lib/config";
import { HttpError } from "@/lib/auth/requireUser";
import { loginSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.parse(body);
    const session = await login(getDb(), parsed);
    const cfg = loadConfig();
    const res = NextResponse.json({ user: session.user });
    setAuthCookies(res, session.accessToken, session.refreshToken, session.refreshMaxAgeSeconds, cfg.cookieSecure);
    return res;
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
