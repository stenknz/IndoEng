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
