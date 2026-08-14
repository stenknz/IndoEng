import "server-only";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { profiles, learnerWords, learnerLessons, learnerGrammar, conversations, attempts, learningSessions } from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import type { LearnerState, LearningProfile, VocabularyWord, LessonProgress, GrammarConcept, Conversation, PracticeAttempt, LearningSession } from "@/lib/types";
import { createInitialState } from "@/lib/store/localStore";
import { WORD_BANK } from "@/lib/data/words";
import { findUserById } from "@/lib/repo/users";

const toBool = (s: string | null) => s === "true";
const toNum = (n: number | null) => n ?? 0;

export async function createProfileIfMissing(db: Db, userId: string): Promise<void> {
  const rows = await db.select({ id: profiles.userId }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (rows.length) return;
  await db.insert(profiles).values({ userId });
}

export async function getProfileRow(db: Db, userId: string): Promise<LearningProfile> {
  await createProfileIfMissing(db, userId);
  const rows = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const r = rows[0];
  return {
    level: toNum(r.level) as 0 | 1 | 2 | 3 | 4,
    translationMode: (r.translationMode as LearningProfile["translationMode"]),
    pronunciationOn: toBool(r.pronunciationOn),
    ttsVoice: r.ttsVoice ?? null,
    aiTutorOn: toBool(r.aiTutorOn),
    vocabKnowledge: toNum(r.vocabKnowledge),
    grammarKnowledge: toNum(r.grammarKnowledge),
    conversationAbility: toNum(r.conversationAbility),
    readingAbility: toNum(r.readingAbility),
    listeningAbility: toNum(r.listeningAbility),
    recentMistakes: (r.recentMistakes as number[]) ?? [],
    confidence: Number(r.confidence),
    currentDifficulty: toNum(r.currentDifficulty) as LearningProfile["currentDifficulty"],
    lastAnswerAccuracy: Number(r.lastAnswerAccuracy),
    consecutiveCorrect: toNum(r.consecutiveCorrect),
  };
}

export async function saveProfileRow(db: Db, userId: string, p: LearningProfile): Promise<void> {
  await createProfileIfMissing(db, userId);
  await db.update(profiles).set({
    level: p.level, translationMode: p.translationMode, pronunciationOn: String(p.pronunciationOn),
    ttsVoice: p.ttsVoice ?? null,
    aiTutorOn: String(p.aiTutorOn), vocabKnowledge: p.vocabKnowledge, grammarKnowledge: p.grammarKnowledge,
    conversationAbility: p.conversationAbility, readingAbility: p.readingAbility, listeningAbility: p.listeningAbility,
    recentMistakes: JSON.parse(JSON.stringify(p.recentMistakes)), confidence: String(p.confidence),
    currentDifficulty: p.currentDifficulty, lastAnswerAccuracy: String(p.lastAnswerAccuracy), consecutiveCorrect: p.consecutiveCorrect,
  }).where(eq(profiles.userId, userId));
}

export async function upsertWordRow(db: Db, userId: string, w: VocabularyWord): Promise<void> {
  await db.insert(learnerWords).values({
    userId, wordId: w.id, familiarity: Math.round(w.familiarity * 100), exposures: w.exposures, correct: w.correct,
    mistakes: w.mistakes, lastReviewed: w.lastReviewed, nextReview: w.nextReview, streak: w.streak,
  }).onConflictDoUpdate({
    target: [learnerWords.userId, learnerWords.wordId],
    set: { familiarity: Math.round(w.familiarity * 100), exposures: w.exposures, correct: w.correct, mistakes: w.mistakes, lastReviewed: w.lastReviewed, nextReview: w.nextReview, streak: w.streak },
  });
}

export async function upsertLessonRow(db: Db, userId: string, p: LessonProgress): Promise<void> {
  await db.insert(learnerLessons).values({ userId, lessonId: p.lessonId, status: p.status, completedAt: p.completedAt, attempts: p.attempts })
    .onConflictDoUpdate({ target: [learnerLessons.userId, learnerLessons.lessonId], set: { status: p.status, completedAt: p.completedAt, attempts: p.attempts } });
}

export async function upsertGrammarRow(db: Db, userId: string, g: GrammarConcept): Promise<void> {
  await db.insert(learnerGrammar).values({ userId, conceptId: g.id, exposedAt: g.exposedAt, mastered: String(g.mastered) })
    .onConflictDoUpdate({ target: [learnerGrammar.userId, learnerGrammar.conceptId], set: { exposedAt: g.exposedAt, mastered: String(g.mastered) } });
}

export async function appendAttemptRow(db: Db, userId: string, a: PracticeAttempt): Promise<void> {
  await db.insert(attempts).values({ id: a.id, userId, ts: a.ts, kind: a.kind, prompt: a.prompt, learnerAnswer: a.learnerAnswer, expected: a.expected, correct: String(a.correct), wordIds: JSON.parse(JSON.stringify(a.wordIds)) });
}

export async function appendSessionRow(db: Db, userId: string, s: LearningSession): Promise<void> {
  await db.insert(learningSessions).values({ id: s.id, userId, ts: s.ts, durationMin: s.durationMin, wordsReviewed: s.wordsReviewed, newWords: s.newWords, recallRate: String(s.recallRate) });
}

export async function upsertConversationRow(db: Db, userId: string, c: Conversation): Promise<void> {
  await db.insert(conversations).values({ id: c.id, userId, lessonId: c.lessonId ?? null, startedAt: c.startedAt, messages: JSON.parse(JSON.stringify(c.messages)) })
    .onConflictDoUpdate({ target: [conversations.id], set: { lessonId: c.lessonId ?? null, startedAt: c.startedAt, messages: JSON.parse(JSON.stringify(c.messages)) } });
}

export async function resetLearnerState(db: Db, userId: string): Promise<void> {
  await db.delete(profiles).where(eq(profiles.userId, userId));
  await db.delete(learnerWords).where(eq(learnerWords.userId, userId));
  await db.delete(learnerLessons).where(eq(learnerLessons.userId, userId));
  await db.delete(learnerGrammar).where(eq(learnerGrammar.userId, userId));
  await db.delete(conversations).where(eq(conversations.userId, userId));
  await db.delete(attempts).where(eq(attempts.userId, userId));
  await db.delete(learningSessions).where(eq(learningSessions.userId, userId));
}

export async function loadLearnerState(db: Db, userId: string): Promise<LearnerState> {
  await createProfileIfMissing(db, userId);
  const state = createInitialState("Learner");
  state.profile = await getProfileRow(db, userId);

  const wordRows = await db.select().from(learnerWords).where(eq(learnerWords.userId, userId));
  for (const r of wordRows) {
    const bank = WORD_BANK.find((w) => w.id === r.wordId);
    state.words[r.wordId] = {
      ...(bank ?? { id: r.wordId, indonesian: r.wordId, english: "", pronunciation: "", example: "", exampleTranslation: "", category: "", frequency: 0, level: 0 }),
      familiarity: toNum(r.familiarity) / 100, exposures: toNum(r.exposures), correct: toNum(r.correct), mistakes: toNum(r.mistakes),
      lastReviewed: r.lastReviewed, nextReview: r.nextReview, streak: toNum(r.streak),
    };
  }

  const lessonRows = await db.select().from(learnerLessons).where(eq(learnerLessons.userId, userId));
  for (const r of lessonRows) {
    state.lessons[r.lessonId] = { lessonId: r.lessonId, status: (r.status as LessonProgress["status"]), completedAt: r.completedAt, attempts: toNum(r.attempts) };
  }

  const grammarRows = await db.select().from(learnerGrammar).where(eq(learnerGrammar.userId, userId));
  for (const r of grammarRows) {
    state.grammar[r.conceptId] = { id: r.conceptId, name: r.conceptId, description: "", exposedAt: r.exposedAt, mastered: toBool(r.mastered) };
  }

  const convRows = await db.select().from(conversations).where(eq(conversations.userId, userId));
  state.conversations = convRows.map((r) => ({ id: r.id, lessonId: r.lessonId ?? undefined, startedAt: r.startedAt, messages: (r.messages as Conversation["messages"]) ?? [] }));

  const attemptRows = await db.select().from(attempts).where(eq(attempts.userId, userId));
  state.attempts = attemptRows.map((r) => ({ id: r.id, ts: r.ts, kind: r.kind as PracticeAttempt["kind"], prompt: r.prompt, learnerAnswer: r.learnerAnswer, expected: r.expected, correct: r.correct === "partial" ? "partial" : r.correct === "true", wordIds: (r.wordIds as string[]) ?? [] }));

  const sessionRows = await db.select().from(learningSessions).where(eq(learningSessions.userId, userId));
  state.sessions = sessionRows.map((r) => ({ id: r.id, ts: r.ts, durationMin: toNum(r.durationMin), wordsReviewed: toNum(r.wordsReviewed), newWords: toNum(r.newWords), recallRate: Number(r.recallRate) }));

  const user = await findUserById(db, userId);
  if (user) state.user = { name: user.name, createdAt: user.createdAt };

  return state;
}
