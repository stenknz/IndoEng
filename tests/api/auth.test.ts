import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb } from "@/tests/helpers/testDb";
import { register, login, refreshSession, revokeSession, changePassword, getPublicUser } from "@/lib/services/authService";

describe("authService", () => {
  let db: any;
  beforeEach(async () => { db = await createTestDb(); });
  afterEach(async () => { await dropTestDb(db); });

  it("registers and logs in", async () => {
    const s = await register(db, { email: "A@B.c", name: "Ana", password: "password123" });
    expect(s.user.email).toBe("a@b.c");
    expect(s.user.role).toBe("student");
    const s2 = await login(db, { email: "a@b.c", password: "password123", remember: true });
    expect(s2.user.id).toBe(s.user.id);
    expect(s2.refreshMaxAgeSeconds).toBeGreaterThan(7 * 24 * 3600); // remember
  });
  it("rejects wrong password and unknown email", async () => {
    await register(db, { email: "a@b.c", name: "A", password: "password123" });
    await expect(login(db, { email: "a@b.c", password: "nope", remember: false })).rejects.toMatchObject({ status: 401 });
    await expect(login(db, { email: "z@b.c", password: "password123", remember: false })).rejects.toMatchObject({ status: 401 });
  });
  it("rotates refresh tokens and rejects reused tokens", async () => {
    const s = await register(db, { email: "a@b.c", name: "A", password: "password123" });
    const s2 = await refreshSession(db, s.refreshToken, {});
    expect(s2.accessToken).not.toBe(s.accessToken);
    expect(s2.refreshToken).not.toBe(s.refreshToken);
    await expect(refreshSession(db, s.refreshToken, {})).rejects.toMatchObject({ status: 401 });
  });
  it("rejects an expired refresh token", async () => {
    const s = await register(db, { email: "a@b.c", name: "A", password: "password123" });
    // force-expire by updating the row in the DB
    const { refreshTokens } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(refreshTokens).set({ expiresAt: Date.now() - 1000 }).where(eq(refreshTokens.userId, s.user.id));
    await expect(refreshSession(db, s.refreshToken, {})).rejects.toMatchObject({ status: 401 });
  });
  it("changes password and logs out", async () => {
    const s = await register(db, { email: "a@b.c", name: "A", password: "password123" });
    await changePassword(db, s.user.id, "password123", "new-password-1");
    await expect(login(db, { email: "a@b.c", password: "password123", remember: false })).rejects.toMatchObject({ status: 401 });
    await revokeSession(db, s.refreshToken);
    await expect(refreshSession(db, s.refreshToken, {})).rejects.toMatchObject({ status: 401 });
  });
  it("rejects a disabled user at login", async () => {
    const s = await register(db, { email: "a@b.c", name: "A", password: "password123" });
    const { setUserDisabled } = await import("@/lib/repo/users");
    await setUserDisabled(db, s.user.id, Date.now());
    await expect(login(db, { email: "a@b.c", password: "password123", remember: false })).rejects.toMatchObject({ status: 401 });
  });
  it("validates input via zod", async () => {
    await expect(register(db, { email: "not-an-email", name: "A", password: "password123" })).rejects.toMatchObject({ status: 400 });
    await expect(register(db, { email: "a@b.c", name: "A", password: "short" })).rejects.toMatchObject({ status: 400 });
  });
});
