# Production Voice System (SpeechProvider + Piper) Implementation Plan — Sub-project B

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the macOS-only browser speech with a modular, self-hosted voice system: a `SpeechProvider` seam, a server-side `/api/tts` (auth + cache) proxying to a Piper TTS sidecar, browser-TTS fallback, and a Settings voice picker.

**Architecture:** Next.js App Router stays the single app. A Piper TTS sidecar container (python `piper-tts` HTTP server on :5000, Indonesian voice on a volume) synthesizes speech. The app's `POST /api/tts` (auth-gated, rate-limited) validates text, checks a persistent WAV cache, and on miss calls the sidecar. The client `SpeechProvider` seam resolves Piper→browser fallback; `SpeakButton` and Settings use it.

**Tech Stack:** Existing Next.js 15.1.6 / TS 5.7 / Tailwind / zustand / vitest / Playwright; Docker (dev compose) for the Piper sidecar; node `crypto`/`fs/promises` for cache.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-14-production-voice-piper-design.md` — this plan implements it fully.
- **Keep:** existing `SpeakButton` props (`text` only) — all 6 consumers unchanged. Existing `tests/audio.test.ts` updated for async, not deleted.
- **Server-only modules** (`src/lib/services/*`, `src/lib/db/*`, route handlers) start with `import "server-only"` where applicable; client modules (`src/lib/audio/*` used by the browser, `src/lib/api/*`) must not import server-only code.
- **Auth:** `/api/tts*` requires a session (`requireUser`); CSRF header `x-kak-request: 1` on POST (apiFetch and raw fetches must send it).
- **Config:** every new env var is validated in `src/lib/config.ts` (mirror `AUTH_RATE_LIMIT_MAX`/`TUTOR_RATE_LIMIT_MAX` pattern); no hardcoded secrets.
- **Secrets:** none new; `.env.local`/`.env.example` placeholders only, never committed.
- **Verification after every task:** `npx tsc --noEmit`, `npx vitest run`, `npm run build` pass (build needs no DB/Piper).
- **Docker Desktop** is running; Postgres dev container from Sub-project A is up (`docker compose -f docker-compose.dev.yml up -d`). The e2e task needs BOTH Postgres and the Piper sidecar up.

---

### Task 1: SpeechProvider seam — async interface + browserTTS update

**Files:**
- Modify: `src/lib/audio/SpeechProvider.ts`, `src/lib/audio/browserTTS.ts`, `tests/audio.test.ts`
- Create: `src/lib/audio/speech.ts` (resolver stub — returns browserTTS for now)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `interface SpeechVoice { id: string; name: string; language: string }`
  - `interface SpeechProvider { speak(text: string, opts?: { voice?: string; language?: string }): Promise<boolean>; supported: boolean; voices: SpeechVoice[]; activeVoice: string }`
  - `browserTTS: SpeechProvider` (async `speak`, keeps a `voiceAvailable` getter as an extra property)
  - `speakText(text: string, opts?: { voice?: string }): Promise<boolean>` in `speech.ts` (Task 5 wires the real resolver)

- [ ] **Step 1: Write the failing test**

`tests/audio.test.ts` (updated for async):
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio.test.ts`
Expected: FAIL (type errors / resolved assertions).

- [ ] **Step 3: Rewrite `src/lib/audio/SpeechProvider.ts`**

```ts
export interface SpeechVoice {
  id: string;
  name: string;
  language: string;
}

export interface SpeechProvider {
  speak(text: string, opts?: { voice?: string; language?: string }): Promise<boolean>;
  supported: boolean;
  voices: SpeechVoice[];
  activeVoice: string;
}
```

- [ ] **Step 4: Rewrite `src/lib/audio/browserTTS.ts`**

```ts
import type { SpeechProvider } from "@/lib/audio/SpeechProvider";

const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;

let idVoice: SpeechSynthesisVoice | undefined;

function refreshVoices(): void {
  if (!hasSpeech) return;
  const voices = window.speechSynthesis.getVoices();
  idVoice = voices.find((v) => v.lang.toLowerCase().startsWith("id"));
}

if (hasSpeech) {
  refreshVoices();
  window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
}

export const browserTTS: SpeechProvider & { voiceAvailable: boolean } = {
  supported: hasSpeech,
  voices: [],
  activeVoice: "",
  get voiceAvailable(): boolean {
    return hasSpeech && Boolean(idVoice);
  },
  async speak(text: string): Promise<boolean> {
    // Never read Indonesian with a non-Indonesian voice — that sounds wrong.
    if (!hasSpeech || !idVoice) return false;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "id-ID";
    utter.voice = idVoice;
    window.speechSynthesis.speak(utter);
    return true;
  },
};
```

- [ ] **Step 5: Write the resolver stub `src/lib/audio/speech.ts`**

```ts
"use client";
import { browserTTS } from "@/lib/audio/browserTTS";
import type { SpeechProvider } from "@/lib/audio/SpeechProvider";

export async function getSpeechProvider(): Promise<SpeechProvider> {
  return browserTTS; // Task 5 replaces this with the /api/tts/info resolver
}

export async function speakText(text: string, opts?: { voice?: string }): Promise<boolean> {
  return (await getSpeechProvider()).speak(text, opts);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/audio.test.ts`
Expected: PASS.

- [ ] **Step 7: Run full suite, typecheck, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all pass (SpeakButton is not yet updated — `speech.ts` is unused, which is fine).

- [ ] **Step 8: Commit**

```bash
git add src/lib/audio/SpeechProvider.ts src/lib/audio/browserTTS.ts src/lib/audio/speech.ts tests/audio.test.ts
git commit -m "feat(audio): async SpeechProvider seam with browser TTS"
```

---

### Task 2: TTS config + `profiles.ttsVoice` migration + repo wiring

**Files:**
- Modify: `src/lib/config.ts`, `src/lib/db/schema.ts`, `src/lib/store/localStore.ts` (`createInitialState`), `src/lib/types/index.ts`, `src/lib/repo/learner.ts`
- Create: `tests/config.test.ts` additions
- Generated: `drizzle/*` migration

**Interfaces:**
- Consumes: existing config schema, `profiles` table, repo get/save profile functions.
- Produces:
  - `AppConfig.tts: { provider: "piper" | "browser"; piperUrl: string; cacheDir: string; defaultVoice: string; lengthScale: number }`
  - `AppConfig.ttsRateLimitMax: number`
  - `profiles.ttsVoice` column; `LearningProfile.ttsVoice: string | null`

- [ ] **Step 1: Write the failing config test (append to `tests/config.test.ts`)**

```ts
it("validates TTS config defaults and rejects a bad provider", () => {
  const c = loadConfig(base);
  expect(c.tts.provider).toBe("piper");
  expect(c.tts.piperUrl).toBe("http://piper:5000");
  expect(c.tts.defaultVoice).toBe("id_ID-news_tts-medium");
  expect(c.ttsRateLimitMax).toBe(60);
  expect(() => loadConfig({ ...base, TTS_PROVIDER: "wat" })).toThrow(/TTS_PROVIDER/);
  expect(validateConfig({ ...base, TTS_RATE_LIMIT_MAX: "abc" }).ok).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config.test.ts`
Expected: FAIL (tts fields missing).

- [ ] **Step 3: Extend `src/lib/config.ts`**

Add to `envSchema`:
```ts
TTS_PROVIDER: z.enum(["piper", "browser"]).default("piper"),
PIPER_URL: z.string().url().default("http://piper:5000"),
TTS_CACHE_DIR: z.string().min(1).default("/data/tts-cache"),
TTS_DEFAULT_VOICE: z.string().min(1).default("id_ID-news_tts-medium"),
TTS_LENGTH_SCALE: z.coerce.number().positive().default(1.1),
TTS_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
```
Add to `AppConfig` interface:
```ts
tts: { provider: "piper" | "browser"; piperUrl: string; cacheDir: string; defaultVoice: string; lengthScale: number };
ttsRateLimitMax: number;
```
Populate in `loadConfig`:
```ts
tts: {
  provider: v.TTS_PROVIDER,
  piperUrl: v.PIPER_URL,
  cacheDir: v.TTS_CACHE_DIR,
  defaultVoice: v.TTS_DEFAULT_VOICE,
  lengthScale: v.TTS_LENGTH_SCALE,
},
ttsRateLimitMax: v.TTS_RATE_LIMIT_MAX,
```

- [ ] **Step 4: Add the schema column + migration**

`src/lib/db/schema.ts` — add to the `profiles` table (after `pronunciationOn`):
```ts
ttsVoice: text("tts_voice"),
```
Run `DATABASE_URL=postgres://kak:kak@localhost:5432/kak npx drizzle-kit generate`, commit the generated `drizzle/XXXX_add_tts_voice.sql` + meta.

`src/lib/types/index.ts` — `LearningProfile` gains `ttsVoice: string | null;`

`src/lib/store/localStore.ts` `createInitialState` — the profile object gains `ttsVoice: null,` (find the profile literal and add the field; also add to any other object literal that constructs a full `LearningProfile`).

- [ ] **Step 5: Wire the repo**

`src/lib/repo/learner.ts`:
- `getProfileRow`: add `ttsVoice: r.ttsVoice ?? null` to the returned object.
- `saveProfileRow`: add `ttsVoice: p.ttsVoice ?? null` to the `.set({...})`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/config.test.ts`
Expected: PASS.

- [ ] **Step 7: Run full suite, typecheck, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all pass (fix any test that constructs a full `LearningProfile` by adding `ttsVoice: null`).

- [ ] **Step 8: Commit**

```bash
git add src/lib/config.ts src/lib/db/schema.ts drizzle src/lib/types/index.ts src/lib/store/localStore.ts src/lib/repo/learner.ts tests/config.test.ts
git commit -m "feat(tts): config vars, profiles.ttsVoice schema and repo wiring"
```

---

### Task 3: TTS service + `/api/tts` routes + rate limit

**Files:**
- Create: `src/lib/services/ttsService.ts`, `src/app/api/tts/info/route.ts`, `src/app/api/tts/route.ts`
- Modify: `src/middleware.ts` (TTS rate limit)
- Test: `tests/ttsService.test.ts`

**Interfaces:**
- Consumes: `loadConfig()` (Task 2), `requireUser`/`HttpError`, `apiFetch` conventions.
- Produces:
  - `cacheKey(text: string, voice: string): string` (sha256 hex)
  - `getPiperVoices(): Promise<TtsVoiceInfo[]>` (defensive normalization of the sidecar `/voices` response)
  - `synthesize(text: string, voice?: string): Promise<Uint8Array>` (cache-first, then sidecar POST /synthesize, then write cache; sidecar error → `HttpError(502)`)
  - `ttsInfo(): Promise<{ provider; configured; voices; defaultVoice }>`
  - Routes: `GET /api/tts/info` → JSON info; `POST /api/tts` `{ text, voice? }` → `audio/wav` bytes or `{ error }`.

- [ ] **Step 1: Write the failing test**

`tests/ttsService.test.ts` (uses a temp dir for the cache, mocks `global.fetch`):
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ttsService.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/lib/services/ttsService.ts`**

```ts
import "server-only";
import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { loadConfig } from "@/lib/config";
import { HttpError } from "@/lib/auth/requireUser";

export interface TtsVoiceInfo {
  id: string;
  name: string;
  language: string;
}

export function cacheKey(text: string, voice: string): string {
  return createHash("sha256").update(`${text}\u0000${voice}`).digest("hex");
}

const toVoice = (raw: unknown, fallback: string): TtsVoiceInfo => {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (typeof r.id === "string" || typeof r.name === "string") {
      return {
        id: (r.id as string) ?? fallback,
        name: (r.name as string) ?? (r.id as string) ?? fallback,
        language: (r.language as string) ?? "id",
      };
    }
    if (typeof r.key === "string") {
      return { id: r.key as string, name: r.key as string, language: "id" };
    }
  }
  if (typeof raw === "string") return { id: raw, name: raw, language: "id" };
  return { id: fallback, name: fallback, language: "id" };
};

export async function getPiperVoices(): Promise<TtsVoiceInfo[]> {
  const cfg = loadConfig();
  if (cfg.tts.provider !== "piper") return [];
  try {
    const res = await fetch(`${cfg.tts.piperUrl}/voices`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    const list = Array.isArray(data) ? data : (data as { voices?: unknown[] })?.voices ?? [];
    if (!Array.isArray(list)) return [];
    const voices = list.map((v) => toVoice(v, cfg.tts.defaultVoice));
    // Ensure the configured default is always present.
    if (!voices.some((v) => v.id === cfg.tts.defaultVoice)) {
      voices.unshift({ id: cfg.tts.defaultVoice, name: cfg.tts.defaultVoice, language: "id" });
    }
    return voices;
  } catch {
    return [{ id: cfg.tts.defaultVoice, name: cfg.tts.defaultVoice, language: "id" }];
  }
}

export async function synthesize(text: string, voice?: string): Promise<Uint8Array> {
  const cfg = loadConfig();
  const v = voice || cfg.tts.defaultVoice;
  const key = cacheKey(text, v);
  const file = join(cfg.tts.cacheDir, `${key}.wav`);
  try {
    const cached = await readFile(file);
    return new Uint8Array(cached);
  } catch {
    // cache miss — synthesize below
  }
  if (cfg.tts.provider !== "piper") throw new HttpError(503, "TTS provider not configured");
  let res: Response;
  try {
    res = await fetch(`${cfg.tts.piperUrl}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: v, length_scale: cfg.tts.lengthScale }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new HttpError(502, "TTS provider unavailable");
  }
  if (!res.ok) throw new HttpError(502, "TTS provider error");
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(cfg.tts.cacheDir, { recursive: true });
  await writeFile(file, buf);
  return new Uint8Array(buf);
}

export async function ttsInfo(): Promise<{ provider: "piper" | "browser"; configured: boolean; voices: TtsVoiceInfo[]; defaultVoice: string }> {
  const cfg = loadConfig();
  const configured = cfg.tts.provider === "piper" && Boolean(cfg.tts.piperUrl);
  return {
    provider: cfg.tts.provider,
    configured,
    voices: configured ? await getPiperVoices() : [],
    defaultVoice: cfg.tts.defaultVoice,
  };
}
```

> Note: verify the actual piper sidecar `/voices` response shape against the running container (Task 4) and adjust `getPiperVoices` normalization if it differs.

- [ ] **Step 4: Write the routes**

`src/app/api/tts/info/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { ttsInfo } from "@/lib/services/ttsService";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    return NextResponse.json(await ttsInfo());
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/tts/info]", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
```

`src/app/api/tts/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { synthesize } from "@/lib/services/ttsService";

const bodySchema = z.object({
  text: z.string().min(1).max(2000),
  voice: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  try {
    await requireUser(request);
    const body = bodySchema.parse(await request.json());
    const audio = await synthesize(body.text, body.voice);
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[api/tts]", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
```

- [ ] **Step 5: Add the TTS rate limit in `src/middleware.ts`**

Add a second limiter (module scope, next to `authLimiter`) and apply it:
```ts
const ttsLimiter = createRateLimiter({ windowMs: 60_000, max: loadConfig().ttsRateLimitMax });
```
In `middleware`, before the gate, when `pathname === "/api/tts" && request.method === "POST"`:
```ts
const r = ttsLimiter(clientIp(request, loadConfig().trustProxy));
if (!r.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "retry-after": String(Math.ceil(r.retryAfterMs / 1000)) } });
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/ttsService.test.ts`
Expected: PASS.

- [ ] **Step 7: Run full suite, typecheck, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/services/ttsService.ts src/app/api/tts src/middleware.ts tests/ttsService.test.ts
git commit -m "feat(tts): server TTS service with cache, /api/tts routes, rate limit"
```

---

### Task 4: Piper sidecar (dev Docker)

**Files:**
- Create: `piper/Dockerfile`, `piper/entrypoint.sh`
- Modify: `docker-compose.dev.yml` (add `piper` service + volume)

**Interfaces:**
- Produces: a running Piper HTTP server on `http://localhost:5000` and (from the app's perspective) `http://piper:5000` in compose, with `POST /synthesize`, `GET /voices`, and the Indonesian voice downloaded on first start.

- [ ] **Step 1: Write `piper/Dockerfile`**

```dockerfile
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir piper-tts[http]
WORKDIR /app
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
EXPOSE 5000
ENTRYPOINT ["/app/entrypoint.sh"]
```

- [ ] **Step 2: Write `piper/entrypoint.sh`**

```sh
#!/bin/sh
set -e
VOICE_DIR="${PIPER_DATA_DIR:-/data}"
VOICE_ID="${PIPER_VOICE:-id_ID-news_tts-medium}"
MODEL="$VOICE_DIR/$VOICE_ID.onnx"
if [ ! -f "$MODEL" ]; then
  echo "Downloading Piper voice: $VOICE_ID"
  mkdir -p "$VOICE_DIR"
  python3 -m piper.download_voices "$VOICE_ID" --data-dir "$VOICE_DIR" || \
  { curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/main/id/id_ID/news_tts/medium/$VOICE_ID.onnx" -o "$MODEL" \
            && curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/main/id/id_ID/news_tts/medium/$VOICE_ID.onnx.json" -o "$MODEL.json"; }
fi
exec python3 -m piper.http_server --host 0.0.0.0 --port 5000 --data-dir "$VOICE_DIR"
```

> Note: verify the installed `piper-tts` version's actual module/CLI (run `python3 -m piper --help` / `python3 -m piper.http_server --help` inside the container) and adjust the entrypoint to the correct invocation and flags (the newer `piper-tts` package and the GPL `piper1-gpl` repo differ; use whichever the installed version supports). Confirm the voice download command works or the curl fallback succeeds.

- [ ] **Step 3: Add the `piper` service to `docker-compose.dev.yml`**

Append:
```yaml
  piper:
    build: ./piper
    environment:
      PIPER_VOICE: id_ID-news_tts-medium
    ports:
      - "5000:5000"
    volumes:
      - piper_data:/data

volumes:
  kak_dev_pg:
  piper_data:
```

- [ ] **Step 4: Build and run the sidecar**

Run: `docker compose -f docker-compose.dev.yml up -d --build`
Expected: the piper container is healthy and listening on 5000.

- [ ] **Step 5: Verify the sidecar API**

Run:
```bash
curl -s http://localhost:5000/info
curl -s -X POST http://localhost:5000/synthesize -H 'Content-Type: application/json' -d '{"text":"Selamat pagi","voice":"id_ID-news_tts-medium"}' -o /tmp/test-tts.wav && file /tmp/test-tts.wav
```
Expected: `/info` returns JSON; `/synthesize` returns a RIFF WAV file (`file` says "WAVE audio"). Record the exact `/voices` response shape in your report (Task 3's `getPiperVoices` normalization may need adjusting to match).

- [ ] **Step 6: Commit**

```bash
git add piper docker-compose.dev.yml
git commit -m "feat(tts): Piper sidecar dev container with Indonesian voice"
```

---

### Task 5: Client `piperTTS` provider + resolver + `SpeakButton`

**Files:**
- Create: `src/lib/audio/piperTTS.ts`
- Modify: `src/lib/audio/speech.ts` (real resolver), `src/components/SpeakButton.tsx`
- Test: `tests/piperTTS.test.ts`, `tests/speech.test.ts`

**Interfaces:**
- Consumes: `SpeechProvider` interface (Task 1), `POST /api/tts` + `GET /api/tts/info` (Task 3), `browserTTS` (Task 1).
- Produces:
  - `piperTTS: SpeechProvider` (speak → POST /api/tts → blob → shared `<audio>`, returns false on any failure)
  - `getSpeechProvider(): Promise<SpeechProvider>` (cached `/api/tts/info` decision, ~60s TTL)
  - `speakText(text, opts?): Promise<boolean>` (piper-first, browser fallback on failure)

- [ ] **Step 1: Write the failing tests**

`tests/piperTTS.test.ts` (stub `fetch` + `Audio`):
```ts
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
```

`tests/speech.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/piperTTS.test.ts tests/speech.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `src/lib/audio/piperTTS.ts`**

```ts
"use client";
import type { SpeechProvider } from "@/lib/audio/SpeechProvider";

let audioEl: HTMLAudioElement | null = null;
function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audioEl) audioEl = new Audio();
  return audioEl;
}

async function fetchWav(text: string, voice?: string): Promise<Blob | null> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json", "x-kak-request": "1" },
    body: JSON.stringify({ text, voice }),
    credentials: "same-origin",
  });
  if (!res.ok) return null;
  return res.blob();
}

export const piperTTS: SpeechProvider = {
  supported: true,
  voices: [],
  activeVoice: "",
  async speak(text: string, opts?: { voice?: string }): Promise<boolean> {
    try {
      const blob = await fetchWav(text, opts?.voice);
      if (!blob) return false;
      const el = getAudio();
      if (!el) return false;
      const url = URL.createObjectURL(blob);
      el.src = url;
      await el.play();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      return true;
    } catch {
      return false;
    }
  },
};
```

- [ ] **Step 4: Rewrite `src/lib/audio/speech.ts` with the real resolver**

```ts
"use client";
import { browserTTS } from "@/lib/audio/browserTTS";
import { piperTTS } from "@/lib/audio/piperTTS";
import type { SpeechProvider } from "@/lib/audio/SpeechProvider";

let cached: SpeechProvider | null = null;
let checkedAt = 0;
const TTL = 60_000;

export async function getSpeechProvider(): Promise<SpeechProvider> {
  const now = Date.now();
  if (cached && now - checkedAt < TTL) return cached;
  try {
    const res = await fetch("/api/tts/info", {
      headers: { "x-kak-request": "1" },
      credentials: "same-origin",
    });
    if (res.ok) {
      const info = (await res.json()) as { provider?: string; configured?: boolean; voices?: SpeechProvider["voices"]; defaultVoice?: string };
      if (info.provider === "piper" && info.configured) {
        piperTTS.voices = info.voices ?? [];
        piperTTS.activeVoice = info.defaultVoice ?? "";
        cached = piperTTS;
      } else {
        cached = browserTTS;
      }
    } else {
      cached = browserTTS;
    }
  } catch {
    cached = browserTTS;
  }
  checkedAt = now;
  return cached;
}

export async function speakText(text: string, opts?: { voice?: string }): Promise<boolean> {
  const provider = await getSpeechProvider();
  if (provider === browserTTS) return provider.speak(text, opts);
  const ok = await provider.speak(text, opts);
  if (ok) return true;
  cached = browserTTS; // piper failed — fall back (and remember for the TTL)
  return browserTTS.speak(text, opts);
}
```

- [ ] **Step 5: Update `src/components/SpeakButton.tsx`**

Replace the `browserTTS` import/usage with `speakText`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { speakText } from "@/lib/audio/speech";

export function SpeakButton({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={async () => {
          const ok = await speakText(text);
          if (!ok) setHint(true);
        }}
        aria-label={`Dengarkan ${text}`}
        title="Putar pelafalan"
        className={`rounded-full bg-canopy-50 p-2.5 text-base text-canopy-700 transition hover:bg-canopy-100 ${className}`}
      >
        🔊
      </button>
      {hint && (
        <span className="text-xs text-amber-600">
          Tidak dapat memutar suara. Coba nyalakan Piper (server) di Pengaturan.
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/piperTTS.test.ts tests/speech.test.ts tests/audio.test.ts`
Expected: PASS.

- [ ] **Step 7: Run full suite, typecheck, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/audio/piperTTS.ts src/lib/audio/speech.ts src/components/SpeakButton.tsx tests/piperTTS.test.ts tests/speech.test.ts
git commit -m "feat(audio): piper client provider, resolver with browser fallback, SpeakButton"
```

---

### Task 6: Settings "Suara" card + voice picker

**Files:**
- Modify: `src/components/SettingsPage.tsx`
- No unit tests (UI; e2e in Task 7).

**Interfaces:**
- Consumes: `GET /api/tts/info` (Task 3), `updateProfile({ ttsVoice })` via `useStore`, `speakText` (Task 5).
- Produces: a Settings card showing the active provider, a voice `<select>` persisting to `profile.ttsVoice`, and a "Coba" play button.

- [ ] **Step 1: Add the Suara card to `src/components/SettingsPage.tsx`**

In `SettingsPage`:
- State: `const [tts, setTts] = useState<{ provider: string; configured: boolean; voices: { id: string; name: string; language: string }[]; defaultVoice: string } | null>(null);`
- Fetch on mount (like the existing `fetch("/api/tutor")` effect):
```ts
useEffect(() => {
  let cancelled = false;
  fetch("/api/tts/info", { headers: { "x-kak-request": "1" }, credentials: "same-origin" })
    .then((r) => r.json())
    .then((d) => { if (!cancelled) setTts(d); })
    .catch(() => { if (!cancelled) setTts(null); });
  return () => { cancelled = true; };
}, []);
```
- Render a **Suara** card (place it after the Pronunciation card):
  - Status line: if `tts?.provider === "piper" && tts?.configured` → green "Suara Piper (server)"; else "Suara perangkat (browser)" (amber note to enable Piper for the best voice).
  - Voice `<select>` (visible only when piper is active): options from `tts.voices` (label = name), value = `state.profile.ttsVoice ?? tts.defaultVoice`; `onChange={(e) => useStore.getState().updateProfile({ ttsVoice: e.target.value })}`. Include an option for "Default" when `ttsVoice` is null. Label `aria-label="Suara"`.
  - A "Coba" button (`variant="secondary"`) calling `void speakText(selectedVoice, { voice: selectedVoice })`.
  - Helper: `const selectedVoice = state.profile.ttsVoice ?? tts?.defaultVoice;`

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsPage.tsx
git commit -m "feat(settings): voice provider status and picker (Suara card)"
```

---

### Task 7: E2E + full verification (needs Docker: Postgres + Piper)

> **Docker:** Postgres AND the Piper sidecar (Task 4) must be up: `docker compose -f docker-compose.dev.yml up -d --build`.

**Files:**
- Create: `e2e/voice.spec.ts`
- Modify: `.env.local` (add `PIPER_URL=http://localhost:5000` for the dev server), `.env.example` (TTS vars, commented defaults)
- Test: full verification.

- [ ] **Step 1: Update `.env.local` + `.env.example`**

`.env.local` (gitignored) — append. IMPORTANT: the dev app runs on the HOST (not in the compose network), and macOS AirPlay owns host port 5000, so the piper service maps `5001:5000` — use `localhost:5001`:
```
PIPER_URL=http://localhost:5001
TTS_CACHE_DIR=/tmp/kak-tts-cache
```
`.env.example` — add a TTS section (all safe defaults, commented):
```
# --- Voice (Piper sidecar) ---
# TTS_PROVIDER=piper
# PIPER_URL=http://piper:5000
# TTS_CACHE_DIR=/data/tts-cache
# TTS_DEFAULT_VOICE=id_ID-news_tts-medium
# TTS_LENGTH_SCALE=1.1
# TTS_RATE_LIMIT_MAX=60
```

- [ ] **Step 2: Write `e2e/voice.spec.ts`**

```ts
import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

test("server TTS endpoint returns audio for an authenticated user", async ({ page, request }) => {
  const email = `voice-${Date.now()}@example.com`;
  await registerUser(page, email, "password123");

  const res = await request.post("/api/tts", {
    headers: { "x-kak-request": "1" },
    data: { text: "Selamat pagi", voice: "id_ID-news_tts-medium" },
  });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("audio/wav");
  const body = await res.body();
  expect(body.length).toBeGreaterThan(100); // a real WAV header + samples

  const info = await request.get("/api/tts/info", { headers: { "x-kak-request": "1" } });
  expect(info.status()).toBe(200);
  const infoJson = await info.json();
  expect(infoJson.provider).toBe("piper");
  expect(infoJson.configured).toBe(true);
});
```

> Create `e2e/helpers/auth.ts` with `registerUser(page, email, password)` (reuse the UI register flow from `e2e/auth.spec.ts` — if one already exists there, extract/share it) and `login(page, email, password)`.

- [ ] **Step 3: Run the e2e suite**

Kill stale dev server (`pkill -f "next dev"`), run `npm run test:e2e`.
Expected: all existing specs + the voice spec pass.

- [ ] **Step 4: Full verification**

Run: `npx tsc --noEmit && npx vitest run && npm run build && npm run test:e2e`
Expected: all green.

- [ ] **Step 5: Manual smoke**

Open http://localhost:3000, register, open Settings → Suara card shows "Suara Piper (server)"; click Coba (audible); click a speak button in Vocabulary (audible). Stop the piper container (`docker compose -f docker-compose.dev.yml stop piper`) → speak falls back silently (no crash).

- [ ] **Step 6: Commit**

```bash
git add e2e .env.example
git commit -m "test(e2e): voice endpoint with real Piper sidecar + full verification"
```

---

## Self-Review

**Spec coverage:**
- §4 SpeechProvider seam → Task 1 (interface + browserTTS + resolver stub), Task 5 (piperTTS + resolver).
- §5 Server /api/tts + sidecar → Task 2 (config/schema), Task 3 (service + routes + rate limit), Task 4 (sidecar Docker).
- §6 Client UI → Task 5 (SpeakButton), Task 6 (Settings Suara card).
- §7 Caching/security/tests/dev sidecar → Task 3 (cache + auth + limit), Task 4 (dev sidecar), Task 7 (e2e).

**Deferred by design (spec §8):** Portainer/production compose (Sub-project C), ASR implementation, voice-pack management UI, cache pruning, commercial voice-license clearance (documented flag).

**Notes for the executor:**
- The exact piper `http_server` module name/CLI flags and the `/voices` response shape must be verified against the running container (Tasks 3/4) — adjust `getPiperVoices` normalization and `entrypoint.sh` to reality.
- `piperTTS.speak` uses raw `fetch` (not `apiFetch`) to get a blob; a 401 returns false → browser fallback. Acceptable; note it.
- `tests/speech.test.ts` uses `vi.resetModules()` because `speech.ts` caches its resolver at module scope.
