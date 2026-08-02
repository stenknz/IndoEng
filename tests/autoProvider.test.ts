import { afterEach, describe, expect, it, vi } from "vitest";
import { autoProvider } from "@/lib/engine/autoProvider";
import { createInitialState } from "@/lib/store/localStore";
import { LESSONS } from "@/lib/data/lessons";
import type { TutorContext } from "@/lib/engine/provider";
import type { ConversationMessage } from "@/lib/types";

function makeCtx(overrides: Partial<TutorContext> = {}): TutorContext {
  const state = createInitialState("Kawan");
  return {
    state,
    lesson: LESSONS[0],
    messages: [{ id: "1", kind: "tutor", content: "Halo!", timestamp: 1 }],
    input: "Halo!",
    mode: "conversation",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("autoProvider", () => {
  it("uses the AI reply when aiTutorOn and the route responds", async () => {
    const state = createInitialState("Kawan");
    state.profile.aiTutorOn = true;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        text: "Kamu makan apa?",
        hint: "what",
        translation: "What do you eat?",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await autoProvider.generate(
      makeCtx({ state, input: "Saya makan nasi" }),
    );
    expect(res.text).toBe("Kamu makan apa?");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the scripted tutor when the route is not configured", async () => {
    const state = createInitialState("Kawan");
    state.profile.aiTutorOn = true;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 501 }),
    );
    const res = await autoProvider.generate(makeCtx({ state }));
    expect(res.text.length).toBeGreaterThan(0);
  });

  it("uses the scripted tutor (no fetch) when aiTutorOn is off", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await autoProvider.generate(makeCtx({ input: "Halo!" }));
    expect(res.text.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the scripted tutor when fetch throws", async () => {
    const state = createInitialState("Kawan");
    state.profile.aiTutorOn = true;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    const res = await autoProvider.generate(makeCtx({ state }));
    expect(res.text.length).toBeGreaterThan(0);
  });
});
