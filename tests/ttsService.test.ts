import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readdirSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { cacheKey, getPiperVoices, synthesize, ttsInfo } from "@/lib/services/ttsService";

const RIFF_WAV = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00];

const tmp = () => join(mkdtempSync(join(tmpdir(), "tts-")), "cache");
let dir: string;

beforeEach(() => {
  dir = tmp();
  process.env.TTS_CACHE_DIR = dir;
  process.env.PIPER_URL = "http://piper:5000";
  process.env.TTS_PROVIDER = "piper";
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

describe("cacheKey", () => {
  it("is deterministic and distinct per text/voice", () => {
    expect(cacheKey("halo", "v1")).toBe(cacheKey("halo", "v1"));
    expect(cacheKey("halo", "v1")).not.toBe(cacheKey("halo", "v2"));
    expect(cacheKey("halo", "v1")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("synthesize", () => {
  it("serves a cache hit without calling the provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    // prime the cache by synthesizing once
    fetchMock.mockResolvedValue(new Response(new Uint8Array(RIFF_WAV), { status: 200, headers: { "content-type": "audio/wav" } }));
    const a1 = await synthesize("halo", "v1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockClear();
    const a2 = await synthesize("halo", "v1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(Array.from(a2)).toEqual(RIFF_WAV);
    expect(a1).toBeInstanceOf(Uint8Array);
  });

  it("writes cache atomically via tmp + rename (no .tmp left behind)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(RIFF_WAV), { status: 200, headers: { "content-type": "audio/wav" } })));
    await synthesize("halo", "v1");
    expect(readdirSync(dir)).toEqual([`${cacheKey("halo", "v1")}.wav`]);
  });

  it("treats a corrupt cached file as a miss and re-synthesizes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array(RIFF_WAV), { status: 200, headers: { "content-type": "audio/wav" } }));
    vi.stubGlobal("fetch", fetchMock);
    const key = cacheKey("halo", "v1");
    const file = join(dir, `${key}.wav`);
    await mkdir(dir, { recursive: true });
    await writeFile(file, Buffer.from("GARBAGE_NOT_A_WAV"));
    const audio = await synthesize("halo", "v1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Array.from(audio)).toEqual(RIFF_WAV);
    const reread = await readFile(file);
    expect(reread.subarray(0, 4).toString("latin1")).toBe("RIFF");
    // the repaired entry is now a cache hit
    fetchMock.mockClear();
    await synthesize("halo", "v1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws HttpError(502) when the provider fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    await expect(synthesize("halo", "v1")).rejects.toMatchObject({ status: 502 });
  });
});

describe("getPiperVoices", () => {
  it("normalizes the piper-tts dict shape {voiceId: config}", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ "id_ID-news_tts-medium": { language: { code: "id_ID" } } }), { status: 200 }),
      ),
    );
    const voices = await getPiperVoices();
    expect(voices).toEqual([
      { id: "id_ID-news_tts-medium", name: "id_ID-news_tts-medium", language: "id_ID" },
    ]);
  });

  it("falls back to default-only when /voices is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const voices = await getPiperVoices();
    expect(voices).toEqual([{ id: "id_ID-news_tts-medium", name: "id_ID-news_tts-medium", language: "id" }]);
  });

  it("falls back to default-only when /voices is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    const voices = await getPiperVoices();
    expect(voices).toEqual([{ id: "id_ID-news_tts-medium", name: "id_ID-news_tts-medium", language: "id" }]);
  });

  it("keeps the configured default when the dict lacks it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ "en_US-lessac-medium": { language: { code: "en_US" } } }), { status: 200 })),
    );
    const voices = await getPiperVoices();
    expect(voices).toHaveLength(2);
    expect(voices[0].id).toBe("id_ID-news_tts-medium");
    expect(voices[1]).toEqual({ id: "en_US-lessac-medium", name: "en_US-lessac-medium", language: "en_US" });
  });
});

describe("ttsInfo", () => {
  it("reports provider and defaults", async () => {
    const info = await ttsInfo();
    expect(info.provider).toBe("piper");
    expect(info.defaultVoice).toBe("id_ID-news_tts-medium");
    expect(Array.isArray(info.voices)).toBe(true);
  });
});
