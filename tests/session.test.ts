import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { setAuthCookies, clearAuthCookies, getRefreshCookie, hashToken } from "@/lib/auth/session";

describe("session cookies", () => {
  it("sets both cookies with attributes", () => {
    const res = NextResponse.next();
    setAuthCookies(res, "access-token", "refresh-token", 3600);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("kak_access=access-token");
    expect(setCookie).toContain("kak_refresh=refresh-token");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });
  it("clears both cookies", () => {
    const res = NextResponse.next();
    clearAuthCookies(res);
    expect(res.headers.get("set-cookie")).toContain("kak_access=;");
    expect(res.headers.get("set-cookie")).toContain("kak_refresh=;");
  });
  it("reads the refresh cookie from a request", () => {
    const req = new Request("http://x/", { headers: { cookie: "kak_refresh=abc" } });
    expect(getRefreshCookie(req)).toBe("abc");
  });
  it("hashes tokens deterministically", () => {
    const h1 = hashToken("tok123");
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("tok123")).toBe(h1);
    expect(hashToken("tok123")).not.toBe(hashToken("tok124"));
  });
});
