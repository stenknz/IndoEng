import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb } from "@/tests/helpers/testDb";
import { createUser, findUserByEmail, findUserById, updateUserPassword, setUserDisabled, listUsers } from "@/lib/repo/users";

describe("users repo", () => {
  let db: any;
  beforeEach(async () => { db = await createTestDb(); });
  afterEach(async () => { await dropTestDb(db); });

  it("creates and finds users by email (lowercased) and id", async () => {
    const u = await createUser(db, { email: "Foo@Example.com", name: "Foo", passwordHash: "h" });
    expect((await findUserByEmail(db, "foo@example.com"))!.id).toBe(u.id);
    expect((await findUserById(db, u.id))!.name).toBe("Foo");
    expect(await findUserByEmail(db, "missing@x.com")).toBeUndefined();
  });
  it("updates password and disables", async () => {
    const u = await createUser(db, { email: "a@b.c", name: "A", passwordHash: "h1" });
    await updateUserPassword(db, u.id, "h2");
    expect((await findUserById(db, u.id))!.passwordHash).toBe("h2");
    await setUserDisabled(db, u.id, 123);
    expect((await findUserById(db, u.id))!.disabledAt).toBe(123);
    await setUserDisabled(db, u.id, null);
    expect((await findUserById(db, u.id))!.disabledAt).toBeNull();
  });
  it("lists users and rejects duplicate emails", async () => {
    await createUser(db, { email: "a@b.c", name: "A", passwordHash: "h" });
    await expect(createUser(db, { email: "A@B.C", name: "B", passwordHash: "h" })).rejects.toThrow();
    expect((await listUsers(db)).length).toBe(1);
  });
});
