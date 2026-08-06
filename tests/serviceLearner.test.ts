import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb, createTestUser } from "@/tests/helpers/testDb";
import { applyWordResult, touchWordRow, setLessonProgress, updateProfile } from "@/lib/services/learnerService";

describe("learnerService", () => {
  let db: any; let uid: string;
  beforeEach(async () => { db = await createTestDb(); uid = await createTestUser(db, undefined, "l@b.c"); });
  afterEach(async () => { await dropTestDb(db); });

  it("applies an SRS result and returns the word", async () => {
    const w = await applyWordResult(db, uid, "halo", "correct");
    expect(w.id).toBe("halo");
    expect(w.streak).toBe(1);
    expect(w.nextReview).not.toBeNull();
  });
  it("touch records an exposure", async () => {
    const w = await touchWordRow(db, uid, "hai");
    expect(w.exposures).toBe(1);
    const w2 = await touchWordRow(db, uid, "hai");
    expect(w2.exposures).toBe(2);
  });
  it("sets lesson progress", async () => {
    await setLessonProgress(db, uid, "hello", "complete");
    const { loadLearnerState } = await import("@/lib/repo/learner");
    expect((await loadLearnerState(db, uid)).lessons["hello"].status).toBe("complete");
  });
  it("updates profile fields", async () => {
    await updateProfile(db, uid, { aiTutorOn: true, currentDifficulty: 3 });
    const { loadLearnerState } = await import("@/lib/repo/learner");
    const p = (await loadLearnerState(db, uid)).profile;
    expect(p.aiTutorOn).toBe(true);
    expect(p.currentDifficulty).toBe(3);
  });
});
