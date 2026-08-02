import { describe, expect, it } from "vitest";
import { browserTTS } from "@/lib/audio/browserTTS";

describe("browserTTS", () => {
  it("is an object with speak, supported, and voiceAvailable", () => {
    expect(typeof browserTTS.speak).toBe("function");
    expect(typeof browserTTS.supported).toBe("boolean");
    expect(typeof browserTTS.voiceAvailable).toBe("boolean");
  });

  it("no-ops safely when speechSynthesis is unavailable", () => {
    expect(() => browserTTS.speak("halo")).not.toThrow();
  });

  it("returns false (did not speak) when no Indonesian voice is present", () => {
    expect(browserTTS.speak("halo")).toBe(false);
  });
});
