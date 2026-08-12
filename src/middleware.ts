import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken, JwtError } from "@/lib/auth/jwt";
import { shouldGate, isSafeMutation } from "@/lib/middlewareLogic";
import { clientIp } from "@/lib/auth/rateLimit";
import { createRateLimiter } from "@/lib/auth/rateLimit";
import { loadConfig } from "@/lib/config";

const authLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
});

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/register")) {
    // Next v15 removed request.ip, so the Edge middleware has no trusted
    // direct client IP; when trustProxy=false we must not trust client-supplied
    // forwarding headers, so clientIp keys on a shared "unknown" bucket.
    const ip = clientIp(request, loadConfig().trustProxy);
    const r = authLimiter(ip);
    if (!r.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "retry-after": String(Math.ceil(r.retryAfterMs / 1000)) } });
    }
  }

  if (!isSafeMutation(request)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  if (!shouldGate(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("kak_access")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const payload = await verifyAccessToken(token);
    // Rewrite the REQUEST headers the route handler will see — this overwrites
    // any client-supplied x-user-id/x-user-role, closing the spoofing hole.
    // (Setting headers on the returned NextResponse sets RESPONSE headers,
    // which the route's `request` object would never see.)
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.userId);
    requestHeaders.set("x-user-role", payload.role);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (e) {
    if (e instanceof JwtError) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    throw e;
  }
}

export const config = { matcher: ["/api/:path*"] };
