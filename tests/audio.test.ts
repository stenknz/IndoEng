import { describe, expect, it } from "vitest";
import { browserTTS } from "@/lib/audio/browserTTS";

describe("browserTTS", () => {
  it("is a SpeechProvider with async speak, supported, voices, activeVoice", () => {
    expect(typeof browserTTS.speak).toBe("function");
    expect(typeof browserTTS.supported).toBe("boolean");
    expect(Array.isArray(browserTTS.voices)).toBe(true);
    expect(typeof browserTTS.activeVoice).toBe("string");
  });

  it("no-ops safely when speechSynthesis is unavailable", async () => {
    await expect(browserTTS.speak("halo")).resolves.toBe(false);
  });

  it("returns false (did not speak) when no Indonesian voice is present", async () => {
    expect(await browserTTS.speak("halo")).toBe(false);
  });
});
