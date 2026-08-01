import { describe, expect, it } from "vitest";
import { browserTTS } from "@/lib/audio/browserTTS";

describe("browserTTS", () => {
  it("is an object with speak and supported", () => {
    expect(typeof browserTTS.speak).toBe("function");
    expect(typeof browserTTS.supported).toBe("boolean");
  });

  it("no-ops safely when speechSynthesis is unavailable", () => {
    expect(() => browserTTS.speak("halo")).not.toThrow();
  });
});
