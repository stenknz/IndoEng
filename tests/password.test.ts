import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

describe("password", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct-horse-1");
    expect(hash).not.toContain("correct-horse-1");
    expect(await verifyPassword("correct-horse-1", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
  it("produces different hashes for the same password", async () => {
    const a = await hashPassword("same-pass");
    const b = await hashPassword("same-pass");
    expect(a).not.toBe(b);
  });
  it("exposes the minimum length constant", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
});
