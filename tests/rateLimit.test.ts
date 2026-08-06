import { describe, it, expect } from "vitest";
import { createRateLimiter, clientIp } from "@/lib/auth/rateLimit";

describe("rateLimit", () => {
  it("allows up to max then blocks", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(limiter("a").allowed).toBe(true);
    expect(limiter("a").allowed).toBe(true);
    expect(limiter("a").allowed).toBe(true);
    const blocked = limiter("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });
  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter("x").allowed).toBe(true);
    expect(limiter("y").allowed).toBe(true);
    expect(limiter("x").allowed).toBe(false);
  });
  it("ignores a spoofed X-Forwarded-For when trustProxy is false", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientIp(req, false, "9.9.9.9")).toBe("9.9.9.9");
    expect(clientIp(req, false)).toBe("unknown");
  });
  it("prefers X-Forwarded-For when trustProxy is true", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientIp(req, true, "9.9.9.9")).toBe("1.2.3.4");
    expect(clientIp(req, true)).toBe("1.2.3.4");
  });
});
