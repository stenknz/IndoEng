import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "crypto";
import { createTestDb, dropTestDb, createTestUser } from "@/tests/helpers/testDb";
import { applyWordResult, touchWordRow, setLessonProgress, appendAttempt, appendSession, upsertConversation, updateProfile } from "@/lib/services/learnerService";
import { loadLearnerState, saveProfileRow, getProfileRow } from "@/lib/repo/learner";

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

  it("persists ttsVoice through updateProfile and loadLearnerState", async () => {
    await updateProfile(db, uid, { ttsVoice: "id_ID-news_tts-medium" });
    const s = await loadLearnerState(db, uid);
    expect(s.profile.ttsVoice).toBe("id_ID-news_tts-medium");
  });

  it("round-trips ttsVoice through saveProfileRow / getProfileRow", async () => {
    const current = await getProfileRow(db, uid);
    await saveProfileRow(db, uid, { ...current, ttsVoice: "id_ID-news_tts-medium" });
    expect((await getProfileRow(db, uid)).ttsVoice).toBe("id_ID-news_tts-medium");
    await saveProfileRow(db, uid, { ...(await getProfileRow(db, uid)), ttsVoice: null });
    expect((await getProfileRow(db, uid)).ttsVoice).toBeNull();
  });

  it("PATCH /api/profile persists ttsVoice (not stripped by zod)", async () => {
    const { PATCH } = await import("@/app/api/profile/route");
    const res = await PATCH(
      new Request("http://x/api/profile", {
        method: "PATCH",
        headers: { "x-user-id": uid },
        body: JSON.stringify({ ttsVoice: "id_ID-news_tts-medium" }),
      }),
    );
    expect(res.status).toBe(200);
    expect((await loadLearnerState(db, uid)).profile.ttsVoice).toBe("id_ID-news_tts-medium");
  });
});
