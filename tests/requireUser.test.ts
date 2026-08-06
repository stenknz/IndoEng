import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb } from "@/tests/helpers/testDb";
import { createUser, setUserDisabled } from "@/lib/repo/users";
import { requireUser, requireAdmin, HttpError } from "@/lib/auth/requireUser";

describe("requireUser", () => {
  let db: any;
  beforeEach(async () => { db = await createTestDb(); });
  afterEach(async () => { await dropTestDb(db); });

  const req = (userId?: string) => new Request("http://x/", { headers: userId ? { "x-user-id": userId } : {} });

  it("rejects requests without an identity header", async () => {
    await expect(requireUser(req())).rejects.toMatchObject({ status: 401 });
  });
  it("rejects unknown users", async () => {
    await expect(requireUser(req("99999999-9999-9999-9999-999999999999"))).rejects.toMatchObject({ status: 401 });
  });
  it("accepts a valid active user and rejects disabled users", async () => {
    const u = await createUser(db, { email: "a@b.c", name: "A", passwordHash: "h" });
    expect((await requireUser(req(u.id))).id).toBe(u.id);
    await setUserDisabled(db, u.id, Date.now());
    await expect(requireUser(req(u.id))).rejects.toMatchObject({ status: 401 });
  });
  it("enforces admin role", async () => {
    const s = await createUser(db, { email: "s@b.c", name: "S", passwordHash: "h" });
    const a = await createUser(db, { email: "ad@b.c", name: "Ad", passwordHash: "h", role: "admin" });
    await expect(requireAdmin(req(s.id))).rejects.toMatchObject({ status: 403 });
    expect((await requireAdmin(req(a.id))).role).toBe("admin");
  });
});
