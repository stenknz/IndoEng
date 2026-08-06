import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "crypto";
import { createTestDb, dropTestDb, createTestUser } from "@/tests/helpers/testDb";
import { loadLearnerState, upsertWordRow, upsertLessonRow, appendAttemptRow, appendSessionRow, upsertConversationRow, resetLearnerState, createProfileIfMissing } from "@/lib/repo/learner";
import type { VocabularyWord, PracticeAttempt, LearningSession, Conversation } from "@/lib/types";

describe("learner repo", () => {
  let db: any; let uid: string;
  beforeEach(async () => { db = await createTestDb(); uid = await createTestUser(db, undefined, "l@b.c"); });
  afterEach(async () => { await dropTestDb(db); });

  it("loads an empty state for a fresh user", async () => {
    await createProfileIfMissing(db, uid);
    const s = await loadLearnerState(db, uid);
    expect(s.words).toEqual({});
    expect(s.lessons).toEqual({});
    expect(s.attempts).toEqual([]);
    expect(s.profile).toBeTruthy();
  });
  it("round-trips words, lessons, attempts, sessions, conversations", async () => {
    const word: VocabularyWord = { id: "w1", indonesian: "makan", english: "eat", pronunciation: "mah-kahn", example: "", exampleTranslation: "", category: "verb", frequency: 1, level: 1, familiarity: 0, exposures: 1, correct: 1, mistakes: 0, lastReviewed: 1, nextReview: 2, streak: 1 };
    await upsertWordRow(db, uid, word);
    const a: PracticeAttempt = { id: randomUUID(), ts: 1, kind: "lesson", prompt: "p", learnerAnswer: "x", expected: "makan", correct: true, wordIds: ["w1"] };
    await appendAttemptRow(db, uid, a);
    const sess: LearningSession = { id: randomUUID(), ts: 1, durationMin: 5, wordsReviewed: 3, newWords: 2, recallRate: 1 };
    await appendSessionRow(db, uid, sess);
    const conv: Conversation = { id: randomUUID(), startedAt: 1, messages: [{ id: "m1", kind: "learner", content: "halo", timestamp: 1 }] };
    await upsertConversationRow(db, uid, conv);
    const state = await loadLearnerState(db, uid);
    expect(state.words["w1"].streak).toBe(1);
    expect(state.attempts).toHaveLength(1);
    expect(state.sessions).toHaveLength(1);
    expect(state.conversations[0].messages[0].content).toBe("halo");
  });
  it("resets all user data", async () => {
    await createProfileIfMissing(db, uid);
    await upsertWordRow(db, uid, { id: "w1", indonesian: "x", english: "y", pronunciation: "", example: "", exampleTranslation: "", category: "", frequency: 1, level: 1, familiarity: 0, exposures: 1, correct: 0, mistakes: 0, lastReviewed: null, nextReview: null, streak: 0 });
    await resetLearnerState(db, uid);
    const s = await loadLearnerState(db, uid);
    expect(s.words).toEqual({});
  });
});
