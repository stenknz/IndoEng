import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { piperTTS } from "@/lib/audio/piperTTS";

function stubAudio() {
  const plays: Array<{ src: string }> = [];
  class FakeAudio {
    src = "";
    async play() { plays.push({ src: this.src }); }
  }
  vi.stubGlobal("Audio", FakeAudio);
  return plays;
}

describe("piperTTS", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs /api/tts and plays the returned blob", async () => {
    const plays = stubAudio();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }), { status: 200 })));
    const ok = await piperTTS.speak("halo", { voice: "v1" });
    expect(ok).toBe(true);
    const fetchMock = vi.mocked(fetch);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/tts");
    expect((init as RequestInit).headers).toMatchObject({ "x-kak-request": "1" });
    expect(plays).toHaveLength(1);
  });

  it("returns false when the request fails", async () => {
    stubAudio();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 502 })));
    expect(await piperTTS.speak("halo")).toBe(false);
  });
});
