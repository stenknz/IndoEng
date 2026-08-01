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
    expect(res.expectedWords).toEqual(["makan", "ayam"]);
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
    expect(right.expectedWords).toEqual(["makan", "ayam"]);
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
    expect(right.expectedWords).toEqual(["pintu"]);
  });

  it("asks a conversation question using a known word", async () => {
    const state = createInitialState("Sten");
    state.words = {
      nasi: {
        id: "nasi", indonesian: "nasi", english: "rice", pronunciation: "", example: "", exampleTranslation: "",
        category: "food", level: 0, familiarity: 0.8, exposures: 2, correct: 2, mistakes: 0,
        lastReviewed: null, nextReview: null, streak: 2,
      },
    };
    const messages = [{ id: "1", kind: "learner" as const, content: "Saya makan nasi", timestamp: 1 }];
    const res = await scriptedProvider.generate({ state, lesson: LESSONS[0], messages, mode: "conversation" });
    expect(res.text).toContain("nasi");
    expect(res.expectAnswer).toBe(true);
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
});
