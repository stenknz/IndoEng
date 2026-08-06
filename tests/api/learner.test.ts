import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "crypto";
import { createTestDb, dropTestDb, createTestUser } from "@/tests/helpers/testDb";
import { applyWordResult, touchWordRow, setLessonProgress, appendAttempt, appendSession, upsertConversation, updateProfile } from "@/lib/services/learnerService";
import { loadLearnerState } from "@/lib/repo/learner";

describe("learner API behavior", () => {
  let db: any; let uid: string;
  beforeEach(async () => { db = await createTestDb(); uid = await createTestUser(db, undefined, "l@b.c"); });
  afterEach(async () => { await dropTestDb(db); });

  it("persists a full learning session sequence", async () => {
    const w = await applyWordResult(db, uid, "halo", "correct");
    await touchWordRow(db, uid, "hai");
    await setLessonProgress(db, uid, "hello", "complete");
    const aId = randomUUID();
    await appendAttempt(db, uid, { id: aId, ts: Date.now(), kind: "lesson", prompt: "p", learnerAnswer: "x", expected: "y", correct: true, wordIds: [w.id] });
    await appendSession(db, uid, { id: randomUUID(), ts: Date.now(), durationMin: 3, wordsReviewed: 2, newWords: 2, recallRate: 1 });
    const cId = randomUUID();
    await upsertConversation(db, uid, { id: cId, startedAt: Date.now(), messages: [{ id: "m1", kind: "tutor", content: "halo", timestamp: Date.now() }] });
    await updateProfile(db, uid, { aiTutorOn: true });

    const s = await loadLearnerState(db, uid);
    expect(Object.keys(s.words).length).toBe(2);
    expect(s.lessons["hello"].status).toBe("complete");
    expect(s.attempts).toHaveLength(1);
    expect(s.sessions).toHaveLength(1);
    expect(s.conversations[0].id).toBe(cId);
    expect(s.profile.aiTutorOn).toBe(true);
  });
});
