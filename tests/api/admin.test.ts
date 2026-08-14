import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb } from "@/tests/helpers/testDb";
import { register } from "@/lib/services/authService";
import { listUsers, setUserDisabled, resetUserPassword } from "@/lib/services/adminService";
import { findUserById } from "@/lib/repo/users";
import { adminDisableSchema } from "@/lib/validation/schemas";

describe("adminService", () => {
  let db: any;
  beforeEach(async () => { db = await createTestDb(); });
  afterEach(async () => { await dropTestDb(db); });

  it("lists users with public fields only", async () => {
    await register(db, { email: "a@b.c", name: "A", password: "password123" });
    await register(db, { email: "b@b.c", name: "B", password: "password123" });
    const users = await listUsers(db);
    expect(users).toHaveLength(2);
    expect(users[0]).not.toHaveProperty("passwordHash");
  });
  it("disables and re-enables a user", async () => {
    const s = await register(db, { email: "a@b.c", name: "A", password: "password123" });
    const admin = await register(db, { email: "ad@b.c", name: "Ad", password: "password123" });
    await setUserDisabled(db, admin.user.id, s.user.id, true);
    expect((await findUserById(db, s.user.id))!.disabledAt).not.toBeNull();
    await setUserDisabled(db, admin.user.id, s.user.id, false);
    expect((await findUserById(db, s.user.id))!.disabledAt).toBeNull();
  });
  it("refuses to disable yourself", async () => {
    const admin = await register(db, { email: "ad@b.c", name: "Ad", password: "password123" });
    await expect(setUserDisabled(db, admin.user.id, admin.user.id, true)).rejects.toMatchObject({ status: 400 });
  });
  it("validates disabled as a strict boolean", () => {
    expect(adminDisableSchema.parse({ disabled: true })).toEqual({ disabled: true });
    expect(adminDisableSchema.parse({ disabled: false })).toEqual({ disabled: false });
    expect(adminDisableSchema.safeParse({ disabled: "false" }).success).toBe(false); // truthy string must not disable
    expect(adminDisableSchema.safeParse({}).success).toBe(false);
  });
  it("resets a user password", async () => {
    const s = await register(db, { email: "a@b.c", name: "A", password: "password123" });
    const admin = await register(db, { email: "ad@b.c", name: "Ad", password: "password123" });
    await resetUserPassword(db, admin.user.id, s.user.id, "brand-new-pass-1");
    const { login } = await import("@/lib/services/authService");
    const sess = await login(db, { email: "a@b.c", password: "brand-new-pass-1", remember: false });
    expect(sess.user.id).toBe(s.user.id);
  });
});
