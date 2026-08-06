import "server-only";
import { createHash } from "crypto";
import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "kak_access";
export const REFRESH_COOKIE = "kak_refresh";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function baseAttrs(secure: boolean): string {
  return `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function setAuthCookies(res: NextResponse, access: string, refresh: string, maxAgeSeconds: number, secure: boolean = true): void {
  res.headers.append("set-cookie", `${ACCESS_COOKIE}=${access}; ${baseAttrs(secure)}; Max-Age=${15 * 60}`);
  res.headers.append("set-cookie", `${REFRESH_COOKIE}=${refresh}; ${baseAttrs(secure)}; Max-Age=${maxAgeSeconds}`);
}

export function clearAuthCookies(res: NextResponse, secure: boolean = true): void {
  const attrs = baseAttrs(secure);
  res.headers.append("set-cookie", `${ACCESS_COOKIE}=; ${attrs}; Max-Age=0`);
  res.headers.append("set-cookie", `${REFRESH_COOKIE}=; ${attrs}; Max-Age=0`);
}

export function getRefreshCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === REFRESH_COOKIE && v) return v;
  }
  return null;
}
