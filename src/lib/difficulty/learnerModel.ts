import type { LearningProfile, PracticeAttempt, VocabularyWord } from "@/lib/types";

export interface LearnerStats {
  vocabSize: number;
  avgFamiliarity: number;
  accuracy: number;
  sameMistakeCount: number;
  avgAnswerLength: number;
}

export function knownWordIds(
  words: Record<string, VocabularyWord>,
  threshold = 0.5,
): string[] {
  return Object.values(words)
    .filter((w) => w.familiarity >= threshold)
    .map((w) => w.id);
}

export function computeLearnerStats(
  words: Record<string, VocabularyWord>,
  attempts: PracticeAttempt[],
  profile: LearningProfile,
): LearnerStats {
  const all = Object.values(words);
  const known = all.filter((w) => w.familiarity >= 0.5);
  const avgFamiliarity =
    all.length === 0 ? 0 : all.reduce((sum, w) => sum + w.familiarity, 0) / all.length;
  const recent = attempts.slice(-10);
  const correct = recent.filter((a) => a.correct === true).length;
  const accuracy = recent.length === 0 ? 1 : correct / recent.length;
  const recentMistakes = profile.recentMistakes.length;
  const avgAnswerLength =
    recent.length === 0 ? 2 : recent.reduce((sum, a) => sum + a.learnerAnswer.trim().split(/\s+/).length, 0) / recent.length;
  return {
    vocabSize: known.length,
    avgFamiliarity,
    accuracy,
    sameMistakeCount: recentMistakes,
    avgAnswerLength,
  };
}

export function adaptProfile(
  profile: LearningProfile,
  stats: LearnerStats,
): LearningProfile {
  let next = { ...profile };
  if (stats.accuracy < 0.4) {
    next = { ...next, currentDifficulty: Math.max(0, next.currentDifficulty - 1) as LearningProfile["currentDifficulty"] };
  } else if (next.consecutiveCorrect >= 3 && stats.avgAnswerLength >= 1) {
    next = {
      ...next,
      currentDifficulty: Math.min(5, next.currentDifficulty + 1) as LearningProfile["currentDifficulty"],
      level: Math.min(4, next.level + (next.currentDifficulty >= 3 ? 1 : 0)) as LearningProfile["level"],
    };
  }
  return next;
}
