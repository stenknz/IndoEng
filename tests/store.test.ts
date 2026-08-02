import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/store/localStore";
import { useStore } from "@/lib/store/useStore";

describe("createInitialState", () => {
  it("builds a valid beginner profile", () => {
    const s = createInitialState("Sten");
    expect(s.user.name).toBe("Sten");
    expect(s.profile.level).toBe(0);
    expect(s.profile.translationMode).toBe("beginner");
    expect(s.words).toEqual({});
    expect(s.sessions).toEqual([]);
  });
});

describe("bumpWord", () => {
  it("appends a timestamp to profile.recentMistakes on a wrong result", () => {
    useStore.getState().resetAll();
    useStore.getState().bumpWord("nasi", "wrong");
    const mistakes = useStore.getState().state.profile.recentMistakes;
    expect(mistakes).toHaveLength(1);
    expect(typeof mistakes[0]).toBe("number");
  });

  it("caps recentMistakes at 5, dropping the oldest", () => {
    useStore.getState().resetAll();
    useStore.getState().updateProfile({ recentMistakes: [1, 2, 3, 4, 5] });
    useStore.getState().bumpWord("nasi", "wrong");
    const mistakes = useStore.getState().state.profile.recentMistakes;
    expect(mistakes).toHaveLength(5);
    expect(mistakes[0]).toBe(2);
  });

  it("leaves recentMistakes untouched on correct results", () => {
    useStore.getState().resetAll();
    useStore.getState().bumpWord("nasi", "correct");
    expect(useStore.getState().state.profile.recentMistakes).toHaveLength(0);
  });
});

describe("recordAttempt", () => {
  function attempt(correct: boolean | "partial") {
    return {
      id: crypto.randomUUID(),
      ts: Date.now(),
      kind: "lesson" as const,
      prompt: "Selamat pagi!",
      learnerAnswer: "selamat pagi",
      expected: "selamat pagi",
      correct,
      wordIds: ["selamat pagi"],
    };
  }

  it("increments consecutiveCorrect and sets lastAnswerAccuracy on a correct answer", () => {
    useStore.getState().resetAll();
    useStore.getState().updateProfile({ consecutiveCorrect: 2 });
    useStore.getState().recordAttempt(attempt(true));
    const p = useStore.getState().state.profile;
    expect(p.consecutiveCorrect).toBe(3);
    expect(p.lastAnswerAccuracy).toBe(1);
  });

  it("resets consecutiveCorrect on a wrong or partial answer", () => {
    useStore.getState().resetAll();
    useStore.getState().updateProfile({ consecutiveCorrect: 3 });
    useStore.getState().recordAttempt(attempt(false));
    let p = useStore.getState().state.profile;
    expect(p.consecutiveCorrect).toBe(0);
    expect(p.lastAnswerAccuracy).toBe(0);

    useStore.getState().updateProfile({ consecutiveCorrect: 3 });
    useStore.getState().recordAttempt(attempt("partial"));
    p = useStore.getState().state.profile;
    expect(p.consecutiveCorrect).toBe(0);
    expect(p.lastAnswerAccuracy).toBe(0);
  });

  it("appends the attempt to the attempts log", () => {
    useStore.getState().resetAll();
    useStore.getState().recordAttempt(attempt(true));
    expect(useStore.getState().state.attempts).toHaveLength(1);
  });
});
