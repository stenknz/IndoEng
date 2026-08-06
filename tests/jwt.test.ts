import { describe, it, expect } from "vitest";
import { signAccessToken, verifyAccessToken, JwtError } from "@/lib/auth/jwt";

describe("jwt", () => {
  it("round-trips a payload", async () => {
    const t = await signAccessToken({ userId: "u1", role: "student" });
    const p = await verifyAccessToken(t);
    expect(p.userId).toBe("u1");
    expect(p.role).toBe("student");
  });
  it("rejects a garbage token", async () => {
    await expect(verifyAccessToken("not-a-token")).rejects.toBeInstanceOf(JwtError);
  });
});
