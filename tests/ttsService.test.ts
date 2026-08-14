import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { cacheKey, synthesize, ttsInfo } from "@/lib/services/ttsService";

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
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "audio/wav" } }));
    const a1 = await synthesize("halo", "v1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockClear();
    const a2 = await synthesize("halo", "v1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(Array.from(a2)).toEqual([1, 2, 3]);
    expect(a1).toBeInstanceOf(Uint8Array);
  });

  it("throws HttpError(502) when the provider fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    await expect(synthesize("halo", "v1")).rejects.toMatchObject({ status: 502 });
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
