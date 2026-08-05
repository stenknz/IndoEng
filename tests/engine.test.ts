import { describe, expect, it } from "vitest";
import { matchAnswer } from "@/lib/engine/matcher";
import { TutorEngine, buildCorrection } from "@/lib/engine/engine";
import { scriptedProvider } from "@/lib/engine/scripted";
import { LESSONS } from "@/lib/data/lessons";
import { createInitialState } from "@/lib/store/localStore";

describe("matchAnswer", () => {
  it("matches all expected words", () => {
    const r = matchAnswer("Saya minum air", ["minum", "air"]);
    expect(r.correct).toBe(true);
  });

  it("returns partial for missing words", () => {
    const r = matchAnswer("saya minum", ["minum", "air"]);
    expect(r.correct).toBe("partial");
  });

  it("returns wrong for unrelated input", () => {
    const r = matchAnswer("saya makan nasi", ["minum", "air"]);
    expect(r.correct).toBe(false);
  });

  it("handles ya/tidak answers", () => {
    expect(matchAnswer("ya", ["ya"]).correct).toBe(true);
    expect(matchAnswer("tidak", ["tidak"]).correct).toBe(true);
  });

  it("matches multi-word expected phrases", () => {
    expect(matchAnswer("Selamat pagi", ["selamat pagi"]).correct).toBe(true);
    expect(matchAnswer("Selamat pagi Kak", ["selamat pagi"]).correct).toBe(true);
  });

  it("matches hyphenated words with or without the hyphen", () => {
    expect(matchAnswer("sama sama", ["sama-sama"]).correct).toBe(true);
    expect(matchAnswer("sama-sama", ["sama-sama"]).correct).toBe(true);
  });

  it("does not mark a negated answer as correct", () => {
    expect(matchAnswer("Saya tidak makan ayam", ["makan", "ayam"]).correct).toBe(false);
    expect(matchAnswer("Bukan nasi", ["nasi"]).correct).toBe(false);
  });

  it("allows negation when the expected answer is itself negative", () => {
    expect(matchAnswer("Saya tidak mau", ["tidak"]).correct).toBe(true);
    expect(matchAnswer("tidak", ["tidak"]).correct).toBe(true);
  });
});

describe("buildCorrection", () => {
  it("uses a lesson sentence containing the expected words", () => {
    const c = buildCorrection(LESSONS[0], "Terima kasih", ["selamat pagi"]);
    expect(c).toContain("selamat pagi");
    expect(c).toContain("Coba lagi");
  });
});

describe("scriptedProvider", () => {
  it("asks the first practice item when a lesson starts", async () => {
    const state = createInitialState("Sten");
    const res = await scriptedProvider.generate({ state, lesson: LESSONS[0], messages: [], mode: "lesson" });
    expect(res.text).toBe("Selamat pagi!");
    expect(res.expectedWords).toEqual(["selamat pagi"]);
    expect(res.expectAnswer).toBe(true);
  });

  it("advances to the next item on a correct answer", async () => {
    const state = createInitialState("Sten");
    const res = await scriptedProvider.generate({ state, lesson: LESSONS[3], messages: [], input: "Saya makan nasi", mode: "lesson" });
    expect(res.text).toContain("Bagus!");
    expect(res.expectedWords).toEqual(["makan", "nasi"]);
  });

  it("re-asks the same question with a correction on a wrong answer", async () => {
    const state = createInitialState("Sten");
    const res = await scriptedProvider.generate({ state, lesson: LESSONS[0], messages: [], input: "Terima kasih", mode: "lesson" });
    expect(res.text).toContain("Coba lagi");
    expect(res.text).toContain("Selamat pagi");
    expect(res.expectedWords).toEqual(["selamat pagi"]);
  });

  it("re-asks then advances across a real message history", async () => {
    const state = createInitialState("Sten");
    const lesson = LESSONS[3];
    const q0 = await scriptedProvider.generate({ state, lesson, messages: [], mode: "lesson" });
    expect(q0.expectedWords).toEqual(["makan", "nasi"]);

    const msgs = [{ id: "t1", kind: "tutor" as const, content: q0.text, timestamp: 1 }];
    const wrong = await scriptedProvider.generate({ state, lesson, messages: msgs, input: "Saya minum air", mode: "lesson" });
    expect(wrong.text).toContain("Coba lagi");
    expect(wrong.expectedWords).toEqual(["makan", "nasi"]);

    const msgs2 = [...msgs, { id: "t2", kind: "tutor" as const, content: wrong.text, timestamp: 2 }];
    const right = await scriptedProvider.generate({ state, lesson, messages: msgs2, input: "Saya makan nasi", mode: "lesson" });
    expect(right.text).toContain("Bagus!");
    expect(right.expectedWords).toEqual(["makan", "nasi"]);
  });

  it("accepts the correct answer after a re-ask on duplicate prompts", async () => {
    const state = createInitialState("Sten");
    const lesson = LESSONS[6];
    const q0 = await scriptedProvider.generate({ state, lesson, messages: [], mode: "lesson" });
    expect(q0.expectedWords).toEqual(["rumah"]);

    const msgs = [{ id: "t1", kind: "tutor" as const, content: q0.text, timestamp: 1, hint: q0.hint }];
    const wrong = await scriptedProvider.generate({ state, lesson, messages: msgs, input: "Saya makan nasi", mode: "lesson" });
    expect(wrong.text).toContain("Coba lagi");
    expect(wrong.expectedWords).toEqual(["rumah"]);

    const msgs2 = [...msgs, { id: "t2", kind: "tutor" as const, content: wrong.text, timestamp: 2, hint: wrong.hint }];
    const right = await scriptedProvider.generate({ state, lesson, messages: msgs2, input: "rumah", mode: "lesson" });
    expect(right.text).toContain("Bagus!");
    expect(right.expectedWords).toEqual(["rumah"]);
  });

  it("acknowledges the first unprompted turn and asks a question without scoring", async () => {
    const state = createInitialState("Sten");
    state.words = {
      rumah: {
        id: "rumah", indonesian: "rumah", english: "house", pronunciation: "", example: "", exampleTranslation: "",
        category: "house", level: 0, frequency: 1, familiarity: 0.12, exposures: 1, correct: 1, mistakes: 0,
        lastReviewed: 1, nextReview: null, streak: 1,
      },
    };
    const seed = [
      { id: "s1", kind: "tutor" as const, content: "Halo! 👋", timestamp: 1 },
      { id: "s2", kind: "tutor" as const, content: "Hari ini kita belajar: 🏠 My House", timestamp: 2 },
    ];
    const opening = await scriptedProvider.generate({
      state,
      lesson: LESSONS[6],
      messages: seed,
      input: "halo",
      mode: "conversation",
    });
    expect(opening.expectedWords).toBeUndefined();
    expect(opening.text).toContain("Ini apa?");
    expect(opening.hint).toBeDefined();
  });

  it("scores the next answer against the displayed question", async () => {
    const engine = new TutorEngine();
    const state = createInitialState("Sten");
    state.words = {
      rumah: {
        id: "rumah", indonesian: "rumah", english: "house", pronunciation: "", example: "", exampleTranslation: "",
        category: "house", level: 0, frequency: 1, familiarity: 0.12, exposures: 1, correct: 1, mistakes: 0,
        lastReviewed: 1, nextReview: null, streak: 1,
      },
    };
    const seed = [
      { id: "s1", kind: "tutor" as const, content: "Halo! 👋", timestamp: 1 },
      { id: "s2", kind: "tutor" as const, content: "Hari ini kita belajar: 🏠 My House", timestamp: 2 },
    ];
    const opening = await scriptedProvider.generate({
      state,
      lesson: LESSONS[6],
      messages: seed,
      input: "halo",
      mode: "conversation",
    });
    const history = [
      ...seed,
      { id: "o1", kind: "tutor" as const, content: opening.text, hint: opening.hint, timestamp: 3 },
      { id: "l1", kind: "learner" as const, content: "halo", timestamp: 4 },
    ];
    const out = await engine.respond(state, LESSONS[6], history, "rumah", "conversation");
    expect(out.attempts).toHaveLength(1);
    expect(out.attempts[0].correct).toBe(true);
    expect(out.attempts[0].wordIds).toEqual(["rumah"]);
    expect(out.wordsToRecord).toEqual({ rumah: "correct" });
  });
});

describe("TutorEngine", () => {
  it("starts a lesson with a greeting", async () => {
    const engine = new TutorEngine();
    const state = createInitialState("Sten");
    const messages = await engine.startLesson(state, LESSONS[0]);
    expect(messages[0].content).toContain("Halo");
  });

  it("records attempts and adapts profile", async () => {
    const engine = new TutorEngine();
    const state = createInitialState("Sten");
    const lesson = LESSONS[0];
    const msgs = await engine.startLesson(state, lesson);
    const input = "Ya";
    const out = await engine.respond(state, lesson, msgs, input, "lesson");
    expect(out.attempts.length).toBeGreaterThanOrEqual(0);
    expect(out.adaptedProfile).toBeTruthy();
  });

  it("scores a correct practice answer against the answered item", async () => {
    const engine = new TutorEngine();
    const state = createInitialState("Sten");
    const lesson = LESSONS[0];
    const history = [
      { id: "t1", kind: "tutor" as const, content: lesson.practice[0].prompt, hint: lesson.practice[0].hint, timestamp: 1 },
      { id: "l1", kind: "learner" as const, content: "selamat pagi", timestamp: 2 },
    ];
    const out = await engine.respond(state, lesson, history, "selamat pagi", "lesson");
    expect(out.attempts[0].correct).toBe(true);
    expect(out.attempts[0].wordIds).toEqual(["selamat pagi"]);
    expect(out.wordsToRecord).toEqual({ "selamat pagi": "correct" });
  });

  it("scores a wrong practice answer against the answered item", async () => {
    const engine = new TutorEngine();
    const state = createInitialState("Sten");
    const lesson = LESSONS[0];
    const history = [
      { id: "t1", kind: "tutor" as const, content: lesson.practice[0].prompt, hint: lesson.practice[0].hint, timestamp: 1 },
      { id: "l1", kind: "learner" as const, content: "terima kasih", timestamp: 2 },
    ];
    const out = await engine.respond(state, lesson, history, "terima kasih", "lesson");
    expect(out.attempts[0].correct).toBe(false);
    expect(out.attempts[0].wordIds).toEqual(["selamat pagi"]);
    expect(out.wordsToRecord).toEqual({ "selamat pagi": "wrong" });
  });

  it("does not create an attempt or record words when the reply has no expected words", async () => {
    const stubProvider = {
      generate: async () => ({
        text: "Bagus! Kamu sudah selesai. Sampai jumpa lagi!",
        expectAnswer: false,
        expectedWords: [] as string[],
      }),
    };
    const engine = new TutorEngine(stubProvider);
    const state = createInitialState("Sten");
    const out = await engine.respond(state, LESSONS[0], [], "halo", "lesson");
    expect(out.attempts).toHaveLength(0);
    expect(out.wordsToRecord).toEqual({});
  });
});
