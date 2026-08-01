import { describe, expect, it } from "vitest";
import { computeLearnerStats, adaptProfile, knownWordIds } from "@/lib/difficulty/learnerModel";
import { simplifyUtterance } from "@/lib/difficulty/simplify";
import { createInitialState } from "@/lib/store/localStore";
import type { PracticeAttempt } from "@/lib/types";

describe("learner model", () => {
  it("counts known words by familiarity threshold", () => {
    const s = createInitialState("Sten");
    s.words = {
      air: { ...(s.words.air ?? { id: "air", indonesian: "air", english: "water", pronunciation: "", example: "", exampleTranslation: "", category: "", level: 0, familiarity: 0, exposures: 1, correct: 1, mistakes: 0, lastReviewed: null, nextReview: null, streak: 1 }), familiarity: 0.7 },
      nasi: { id: "nasi", indonesian: "nasi", english: "rice", pronunciation: "", example: "", exampleTranslation: "", category: "", level: 0, familiarity: 0, exposures: 0, correct: 0, mistakes: 0, lastReviewed: null, nextReview: null, streak: 0 },
    };
    expect(knownWordIds(s.words)).toEqual(["air"]);
  });

  it("gates difficulty increase on consistent performance", () => {
    const s = createInitialState("Sten");
    s.profile.consecutiveCorrect = 3;
    const stats = { vocabSize: 5, avgFamiliarity: 0.4, accuracy: 1, sameMistakeCount: 0, avgAnswerLength: 2 };
    const out = adaptProfile(s.profile, stats);
    expect(out.currentDifficulty).toBeGreaterThan(s.profile.currentDifficulty);
  });

  it("drops difficulty on poor recent accuracy", () => {
    const s = createInitialState("Sten");
    s.profile.currentDifficulty = 3;
    const stats = { vocabSize: 5, avgFamiliarity: 0.4, accuracy: 0.2, sameMistakeCount: 2, avgAnswerLength: 1 };
    const out = adaptProfile(s.profile, stats);
    expect(out.currentDifficulty).toBeLessThan(s.profile.currentDifficulty);
  });
});

describe("simplifyUtterance", () => {
  it("breaks long sentences into simpler ones", () => {
    const complex = "Apa yang biasanya kamu lakukan setelah pulang kerja?";
    const simple = simplifyUtterance(complex);
    expect(simple.length).toBeLessThan(complex.length);
  });
});
