import { describe, it, expect } from "vitest";
import { shouldGate, isSafeMutation } from "@/lib/middlewareLogic";

describe("middleware logic", () => {
  it("does not gate public auth endpoints", () => {
    expect(shouldGate("/api/auth/login")).toBe(false);
    expect(shouldGate("/api/auth/refresh")).toBe(false);
    expect(shouldGate("/api/tutor")).toBe(true);
    expect(shouldGate("/api/state")).toBe(true);
  });
  it("checks CSRF header on non-GET", async () => {
    const req = new Request("http://x/api/state", { method: "POST", headers: {} });
    expect(await isSafeMutation(req)).toBe(false);
    const ok = new Request("http://x/api/state", { method: "POST", headers: { "x-kak-request": "1" } });
    expect(await isSafeMutation(ok)).toBe(true);
  });
});
