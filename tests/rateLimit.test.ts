import { describe, it, expect } from "vitest";
import { createRateLimiter } from "@/lib/auth/rateLimit";

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
});
