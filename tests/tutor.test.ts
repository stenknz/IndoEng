import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb, createTestUser } from "@/tests/helpers/testDb";
import { buildTutorContext } from "@/lib/services/learnerService";
import { applyWordResult } from "@/lib/services/learnerService";

describe("tutor context", () => {
  let db: any; let uid: string;
  beforeEach(async () => { db = await createTestDb(); uid = await createTestUser(db, undefined, "t@b.c"); });
  afterEach(async () => { await dropTestDb(db); });

  it("builds context from the user's own data", async () => {
    await applyWordResult(db, uid, "halo", "correct");
    const ctx = await buildTutorContext(db, uid);
    expect(typeof ctx.level).toBe("number");
    expect(Array.isArray(ctx.knownWords)).toBe(true);
    expect(typeof ctx.translationMode).toBe("string");
  });
});
