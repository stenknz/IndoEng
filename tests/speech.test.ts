import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("speech resolver", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("resolves piper when /api/tts/info says configured", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ provider: "piper", configured: true, voices: [], defaultVoice: "v1" }), { status: 200 }));
    const { getSpeechProvider, piperTTS } = await import("@/lib/audio/speech");
    const { piperTTS: pt } = await import("@/lib/audio/piperTTS");
    const provider = await getSpeechProvider();
    expect(provider).toBe(pt);
  });

  it("falls back to browser when not configured or fetch fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ provider: "browser", configured: false }), { status: 200 }));
    const { getSpeechProvider } = await import("@/lib/audio/speech");
    const { browserTTS } = await import("@/lib/audio/browserTTS");
    expect(await getSpeechProvider()).toBe(browserTTS);
    vi.mocked(fetch).mockRejectedValue(new Error("down"));
    const { getSpeechProvider: g2 } = await import("@/lib/audio/speech");
    expect(await g2()).toBe(browserTTS);
  });
});
