import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createTestDb, dropTestDb, createTestUser } from "@/tests/helpers/testDb";

const DEFAULT_VOICE = "id_ID-news_tts-medium";
const RIFF_WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);

describe("POST /api/tts voice validation", () => {
  let db: any; let uid: string; let cacheDir: string;

  beforeEach(async () => {
    db = await createTestDb();
    uid = await createTestUser(db, undefined, "tts@b.c");
    cacheDir = join(mkdtempSync(join(tmpdir(), "tts-api-")), "cache");
    process.env.TTS_PROVIDER = "piper";
    process.env.PIPER_URL = "http://piper:5000";
    process.env.TTS_CACHE_DIR = cacheDir;
    process.env.TTS_DEFAULT_VOICE = DEFAULT_VOICE;
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await dropTestDb(db);
    rmSync(cacheDir, { recursive: true, force: true });
  });

  const post = (body: unknown) =>
    new Request("http://x/api/tts", {
      method: "POST",
      headers: { "x-user-id": uid },
      body: JSON.stringify(body),
    });

  it("returns 400 Unknown voice when voice is not in the installed list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const { POST } = await import("@/app/api/tts/route");
    const res = await POST(post({ text: "halo", voice: "en_US-bogus-medium" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Unknown voice" });
  });

  it("allows the default voice and synthesizes audio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (String(url).endsWith("/voices")) {
          return Promise.resolve(new Response(JSON.stringify({ [DEFAULT_VOICE]: { language: { code: "id_ID" } } }), { status: 200 }));
        }
        return Promise.resolve(new Response(RIFF_WAV, { status: 200, headers: { "content-type": "audio/wav" } }));
      }),
    );
    const { POST } = await import("@/app/api/tts/route");
    const res = await POST(post({ text: "halo", voice: DEFAULT_VOICE }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("audio/wav");
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual(Array.from(RIFF_WAV));
  });

  it("returns 400 Unknown voice when no installed list is known", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const { POST } = await import("@/app/api/tts/route");
    const res = await POST(post({ text: "halo", voice: "nope-voice" }));
    expect(res.status).toBe(400);
  });
});
