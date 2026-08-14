import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { register } from "@/lib/services/authService";
import { setAuthCookies } from "@/lib/auth/session";
import { loadConfig } from "@/lib/config";
import { HttpError } from "@/lib/auth/requireUser";
import { registerSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.parse(body);
    const session = await register(getDb(), parsed);
    const cfg = loadConfig();
    const res = NextResponse.json({ user: session.user });
    setAuthCookies(res, session.accessToken, session.refreshToken, session.refreshMaxAgeSeconds, cfg.cookieSecure);
    return res;
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/auth/register]", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
