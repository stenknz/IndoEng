import type { VocabularyWord } from "@/lib/types";
import type { WordResult } from "@/lib/store/useStore";

export const INTERVALS = [0, 1, 3, 7, 14, 30] as const;

function clampFamiliarity(f: number): number {
  return Math.max(0, Math.min(1, f));
}

function todayPlus(days: number): number {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export const scheduler = {
  intervalAfter(word: VocabularyWord): number {
    if (word.streak <= 0) return 1;
    return INTERVALS[Math.min(word.streak, INTERVALS.length - 1)];
  },

  recordResult(word: VocabularyWord, result: WordResult): VocabularyWord {
    const now = Date.now();
    const exposures = word.exposures + 1;
    if (result === "correct") {
      const streak = word.streak + 1;
      const interval = this.intervalAfter({ ...word, streak });
      return {
        ...word,
        familiarity: clampFamiliarity(word.familiarity + 0.12),
        exposures,
        correct: word.correct + 1,
        lastReviewed: now,
        nextReview: todayPlus(interval),
        streak,
      };
    }
    if (result === "partial") {
      return {
        ...word,
        familiarity: clampFamiliarity(word.familiarity + 0.05),
        exposures,
        lastReviewed: now,
        nextReview: todayPlus(1),
      };
    }
    return {
      ...word,
      familiarity: clampFamiliarity(word.familiarity - 0.2),
      exposures,
      mistakes: word.mistakes + 1,
      lastReviewed: now,
      nextReview: todayPlus(1),
      streak: 0,
    };
  },

  dueItems(
    words: Record<string, VocabularyWord>,
    now: number = Date.now(),
  ): VocabularyWord[] {
    return Object.values(words).filter((w) => w.nextReview !== null && w.nextReview <= now);
  },
};
