import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/store/localStore";

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
