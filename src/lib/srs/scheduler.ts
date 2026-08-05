import type { VocabularyWord } from "@/lib/types";
import type { WordResult } from "@/lib/store/useStore";

export const INTERVALS = [0, 1, 3, 7, 14, 30] as const;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Half-life (hours) of the retention estimate per streak level. A word that
// was just learned (streak 1) decays faster than a well-spaced word (streak 5+).
const HALF_LIFE_HOURS = [12, 24, 72, 168, 336, 720] as const;

function clampFamiliarity(f: number): number {
  return Math.max(0, Math.min(1, f));
}

function todayPlus(days: number): number {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function laterToday(): number {
  // Same-day re-check window for a freshly learned word (~4 hours).
  return Date.now() + 4 * HOUR_MS;
}

export const scheduler = {
  intervalDays(streak: number): number {
    if (streak <= 0) return 1;
    return INTERVALS[Math.min(streak - 1, INTERVALS.length - 1)];
  },

  recordResult(word: VocabularyWord, result: WordResult): VocabularyWord {
    const now = Date.now();
    const exposures = word.exposures + 1;
    if (result === "correct") {
      const streak = word.streak + 1;
      const days = this.intervalDays(streak);
      return {
        ...word,
        familiarity: clampFamiliarity(word.familiarity + 0.12),
        exposures,
        correct: word.correct + 1,
        lastReviewed: now,
        nextReview: days === 0 ? laterToday() : todayPlus(days),
        streak,
      };
    }
    if (result === "partial") {
      // Partial credit, but the word is not mastered: reset the streak so
      // intervals cannot inflate, and re-check tomorrow.
      return {
        ...word,
        familiarity: clampFamiliarity(word.familiarity + 0.05),
        exposures,
        lastReviewed: now,
        nextReview: todayPlus(1),
        streak: 0,
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

  // Predicted retention probability in [0, 1]: the stored familiarity
  // strength decays exponentially with a streak-scaled half-life.
  retentionOf(word: VocabularyWord, now: number = Date.now()): number {
    if (!word.lastReviewed) return word.familiarity;
    const hours = (now - word.lastReviewed) / HOUR_MS;
    if (hours <= 0) return word.familiarity;
    const halfLife = HALF_LIFE_HOURS[Math.min(Math.max(word.streak, 0), HALF_LIFE_HOURS.length - 1)];
    return word.familiarity * Math.pow(0.5, hours / halfLife);
  },

  dueItems(
    words: Record<string, VocabularyWord>,
    now: number = Date.now(),
    cap?: number,
  ): VocabularyWord[] {
    const due = Object.values(words)
      .filter((w) => w.nextReview !== null && w.nextReview <= now)
      .sort((a, b) => this.retentionOf(a, now) - this.retentionOf(b, now));
    return cap !== undefined ? due.slice(0, cap) : due;
  },
};
