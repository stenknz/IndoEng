import { describe, expect, it } from "vitest";
import { scheduler } from "@/lib/srs/scheduler";
import type { VocabularyWord } from "@/lib/types";

const base: VocabularyWord = {
  id: "air",
  indonesian: "air",
  english: "water",
  pronunciation: "AH-eer",
  example: "Saya minum air.",
  exampleTranslation: "I drink water.",
  category: "drinks",
  level: 0,
  familiarity: 0,
  exposures: 0,
  correct: 0,
  mistakes: 0,
  lastReviewed: null,
  nextReview: null,
  streak: 0,
};

describe("scheduler", () => {
  it("correct answers increase familiarity and schedule future review", () => {
    const w = scheduler.recordResult(base, "correct");
    expect(w.familiarity).toBeGreaterThan(0);
    expect(w.streak).toBe(1);
    expect(w.nextReview).not.toBeNull();
  });

  it("wrong answers lower familiarity and shorten interval", () => {
    const first = scheduler.recordResult(base, "correct");
    const w = scheduler.recordResult(first, "wrong");
    expect(w.familiarity).toBeLessThan(first.familiarity);
    expect(w.streak).toBe(0);
    expect(w.nextReview).not.toBeNull();
  });

  it("dueItems returns only words due at the given time", () => {
    const now = Date.now();
    const w1 = { ...scheduler.recordResult(base, "correct"), nextReview: now - 1000 };
    const w2 = { ...w1, id: "nasi", nextReview: now + 1000000 };
    const words: Record<string, VocabularyWord> = { air: w1, nasi: w2 };
    const due = scheduler.dueItems(words, now);
    expect(due.map((d) => d.id)).toContain("air");
    expect(due.map((d) => d.id)).not.toContain("nasi");
  });
});
