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

  it("first correct answer schedules a same-day re-check (within 24h)", () => {
    const now = Date.now();
    const w = scheduler.recordResult(base, "correct");
    expect(w.nextReview).not.toBeNull();
    expect(w.nextReview! - now).toBeGreaterThan(0);
    expect(w.nextReview! - now).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it("partial answers reset the streak so intervals cannot inflate", () => {
    const first = scheduler.recordResult(base, "correct");
    const w = scheduler.recordResult(first, "partial");
    expect(w.streak).toBe(0);
    expect(w.nextReview).not.toBeNull();
  });

  it("retention estimate decays over time since last review", () => {
    const w = scheduler.recordResult(base, "correct");
    const atReview = scheduler.retentionOf(w, w.lastReviewed ?? 0);
    const muchLater = scheduler.retentionOf(
      w,
      (w.lastReviewed ?? 0) + 30 * 24 * 60 * 60 * 1000,
    );
    expect(atReview).toBeGreaterThan(0);
    expect(atReview).toBeGreaterThan(muchLater);
    expect(muchLater).toBeGreaterThanOrEqual(0);
  });

  it("dueItems orders the weakest-retention item first", () => {
    const now = Date.now();
    const weak = {
      ...base,
      id: "weak",
      nextReview: now - 1000,
      streak: 0,
      familiarity: 0.3,
      lastReviewed: now - 5 * 24 * 60 * 60 * 1000,
    };
    const strong = {
      ...base,
      id: "strong",
      nextReview: now - 1000,
      streak: 5,
      familiarity: 0.9,
      lastReviewed: now - 1000,
    };
    const due = scheduler.dueItems({ weak, strong }, now);
    expect(due[0].id).toBe("weak");
  });

  it("supports a daily review cap", () => {
    const now = Date.now();
    const words: Record<string, VocabularyWord> = {};
    for (let i = 0; i < 25; i++) {
      words[`w${i}`] = {
        ...base,
        id: `w${i}`,
        nextReview: now - 1000,
        streak: 0,
        familiarity: 0.1,
        lastReviewed: now - 1000,
      };
    }
    expect(scheduler.dueItems(words, now, 20).length).toBe(20);
  });
});
