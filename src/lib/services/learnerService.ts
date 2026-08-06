import "server-only";
import { randomUUID } from "crypto";
import type { Db } from "@/lib/db";
import { getDb } from "@/lib/db";
import { scheduler } from "@/lib/srs/scheduler";
import { WORD_BANK } from "@/lib/data/words";
import type { LearnerState, LessonProgress, PracticeAttempt, LearningSession, Conversation, LearningProfile, VocabularyWord, LessonStatus } from "@/lib/types";
import { loadLearnerState, upsertWordRow, upsertLessonRow, upsertGrammarRow, appendAttemptRow, appendSessionRow, upsertConversationRow, saveProfileRow, resetLearnerState } from "@/lib/repo/learner";
import type { LearnerContext } from "@/lib/engine/openaiMessages";

export type WordResult = "correct" | "partial" | "wrong";

function emptyWord(id: string): VocabularyWord {
  const bank = WORD_BANK.find((w) => w.id === id);
  return {
    id, indonesian: bank?.indonesian ?? "", english: bank?.english ?? "", pronunciation: bank?.pronunciation ?? "",
    example: bank?.example ?? "", exampleTranslation: bank?.exampleTranslation ?? "", category: bank?.category ?? "",
    image: bank?.image, frequency: bank?.frequency ?? 0, level: bank?.level ?? 0,
    familiarity: 0, exposures: 0, correct: 0, mistakes: 0, lastReviewed: null, nextReview: null, streak: 0,
  };
}

export async function loadState(db: Db, userId: string): Promise<LearnerState> { return loadLearnerState(db, userId); }
export async function resetState(db: Db, userId: string): Promise<void> { await resetLearnerState(db, userId); }

export async function applyWordResult(db: Db, userId: string, wordId: string, result: WordResult): Promise<VocabularyWord> {
  const prev = (await loadLearnerState(db, userId)).words[wordId] ?? emptyWord(wordId);
  const next = scheduler.recordResult(prev, result);
  await upsertWordRow(db, userId, next);
  return next;
}

export async function touchWordRow(db: Db, userId: string, wordId: string): Promise<VocabularyWord> {
  const prev = (await loadLearnerState(db, userId)).words[wordId] ?? emptyWord(wordId);
  const next = { ...prev, lastReviewed: Date.now(), exposures: prev.exposures + 1 };
  await upsertWordRow(db, userId, next);
  return next;
}

export async function setLessonProgress(db: Db, userId: string, lessonId: string, status: LessonStatus): Promise<void> {
  const state = await loadLearnerState(db, userId);
  const prev = state.lessons[lessonId];
  const next: LessonProgress = {
    lessonId,
    status,
    completedAt: status === "complete" ? Date.now() : (prev?.completedAt ?? null),
    attempts: prev ? prev.attempts + 1 : 1,
  };
  await upsertLessonRow(db, userId, next);
}

export async function appendAttempt(db: Db, userId: string, a: PracticeAttempt): Promise<void> {
  await appendAttemptRow(db, userId, { ...a, id: a.id ?? randomUUID() });
}

export async function appendSession(db: Db, userId: string, s: LearningSession): Promise<void> {
  await appendSessionRow(db, userId, { ...s, id: s.id ?? randomUUID() });
}

export async function upsertConversation(db: Db, userId: string, c: Conversation): Promise<void> {
  await upsertConversationRow(db, userId, { ...c, id: c.id ?? randomUUID() });
}

export async function updateProfile(db: Db, userId: string, partial: Partial<LearningProfile>): Promise<void> {
  const current = await loadLearnerState(db, userId);
  const next = { ...current.profile, ...partial };
  await saveProfileRow(db, userId, next);
}

export async function buildTutorContext(db: Db, userId: string): Promise<LearnerContext> {
  const s = await loadLearnerState(db, userId);
  return {
    level: s.profile.level,
    translationMode: s.profile.translationMode,
    knownWords: Object.values(s.words).map((w) => w.indonesian).filter(Boolean).slice(-60),
  };
}
