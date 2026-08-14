# Production Voice System: SpeechProvider + Piper TTS — Design

**Date:** 2026-08-14
**Sub-project:** B (of the Production Deployment mission)
**Status:** Approved by user (sections 1–4)

## 1. Background

The app's current speech is macOS-only `speechSynthesis` (browser TTS) behind a
synchronous `SpeechProvider` interface (`src/lib/audio/SpeechProvider.ts`,
`browserTTS.ts`, `SpeakButton.tsx`). The mission requires a free, self-hosted,
Docker-compatible voice system with a modular provider architecture.

## 2. Engine research (Phase 9) — verdict: Piper

Comparison of the three open-source engines (full details in the research report):

| | Piper (`piper1-gpl`) | Coqui XTTS | Mimic 3 |
|---|---|---|---|
| Indonesian voice | **Yes** — `id_ID-news_tts-medium` | No (17 langs, not id) | No (Javanese only) |
| CPU viability | CPU-first, real-time on modest CPUs | Needs GPU (~2.1GB weights, 3–10× slower than real-time on CPU) | CPU-friendly |
| Docker/HTTP | Dockerfile + built-in `http_server` (POST /synthesize, GET /voices, /info) | Official image, port 5002 | Official image, port 59125 |
| License | Engine **GPL-3.0** (was MIT); voice model license **unclear** | MPL-2.0 + **CPML (non-commercial)** | AGPL-3.0 |
| Maintenance | **Active** (last push 2026-08-14, 5.1k stars) | Unmaintained (Coqui shut down 2024) | **Abandoned** (Piper named successor) |

**Winner: Piper.** The only engine with an Indonesian voice, actively maintained,
CPU-first, with a built-in HTTP API that drops into a Docker sidecar. XTTS is
eliminated (no Indonesian + GPU + restrictive license); Mimic 3 is eliminated
(no Indonesian + abandoned). Piper's GPL-3.0 engine is fine as a separate sidecar
process (no linking/copying); the Indonesian voice model's license is fuzzy and
must be flagged for any commercial distribution.

**Recommended voice:** `id_ID-news_tts-medium` (~63MB, 22.05kHz), from
`https://huggingface.co/rhasspy/piper-voices/.../id_ID-news_tts-medium.onnx` (+ `.onnx.json`).

## 3. Decisions (agreed with user)

- **Piper runs as a sidecar container** (app image stays small; engine swap = config change).
- **Browser TTS fallback** when Piper is unreachable/unconfigured (app stays fully functional offline/in dev).
- **Default Indonesian voice ships + a Settings voice picker** (additional voice packs drop into the voice volume).
- **ASR/pronunciation scoring: architecture-ready only** (interface/config seams, no implementation).

## 4. SpeechProvider seam

```ts
export interface SpeechProvider {
  speak(text: string, opts?: { voice?: string; language?: string }): Promise<boolean>;
  supported: boolean;
  voices: { id: string; name: string; language: string }[];
  activeVoice: string;
  // future (architecture-ready): transcribe(audio), score(spoken, expected)
}
```

- `piperTTS` — fetches the WAV from the app's `POST /api/tts`, plays via a shared `<audio>` element.
- `browserTTS` — existing `speechSynthesis` path, made async-compatible (both return `Promise<boolean>`).
- `speech.ts` resolver — checks `GET /api/tts/info` at boot and re-checks on failure; Piper configured+reachable → `piperTTS`, else `browserTTS`. `SpeakButton` also falls back at play-time.

## 5. Server `/api/tts` + sidecar

- `GET /api/tts/info` (auth) → `{ provider, configured, voices, defaultVoice }`.
- `POST /api/tts` (auth) body `{ text, voice? }` → `audio/wav` bytes. Flow: validate (`text` 1–2000 chars; `voice` in installed list) → cache key `sha256(text|voice)` → serve from `TTS_CACHE_DIR` if present → else `POST` Piper `/synthesize` → write WAV to cache → serve. Sidecar failure → 502 (client falls back to browser TTS).
- **Piper sidecar** (dev service + `piper/Dockerfile`): `python:3.12-slim` + `piper-tts[http]`, entrypoint downloads `id_ID-news_tts-medium` into a volume on first start, runs `piper.http_server` on 5000. `length_scale` (~1.1) configurable for learner-paced speech.
- **Rate limiting**: validated `TTS_RATE_LIMIT_MAX` (default 60/min) in middleware for `/api/tts`.
- **Config (validated in `config.ts`)**: `TTS_PROVIDER` (`piper`|`browser`, default `piper`), `PIPER_URL` (default `http://piper:5000`), `TTS_CACHE_DIR` (default `/data/tts-cache`), `TTS_DEFAULT_VOICE`, `TTS_LENGTH_SCALE`, `TTS_RATE_LIMIT_MAX`.

## 6. Client UI

- `SpeakButton`: resolver → `await speak(text, { voice })`; on `false` retry via `browserTTS`; both fail → existing hint. Props unchanged (`text`).
- Settings **Suara** card: provider status ("Suara Piper (server)" / "Suara perangkat (browser)"), voice `<select>` from `info.voices`, "Coba" play button. Persists via `updateProfile({ ttsVoice })`.
- **Schema**: new `ttsVoice` text column on `profiles` (Drizzle migration) + `LearningProfile.ttsVoice: string | null` + repo get/save wiring. `null` = server default.

## 7. Caching, security, tests, dev sidecar

- **Caching**: WAVs in `TTS_CACHE_DIR` (persistent volume; dev mounts local dir). Key `sha256(text|voice)`. No pruning (documented).
- **Security**: `/api/tts` auth-gated, rate-limited, text capped, sidecar URL env-only (no SSRF), no secrets in responses.
- **Tests**: config validation; cache-key derivation; `/api/tts` with mocked Piper (cache hit / miss→synthesize / sidecar error→502); resolver logic; updated `audio.test.ts` (async `speak`); e2e asserts `/api/tts` returns `audio/wav` with the real sidecar.
- **Dev sidecar**: `piper` service in `docker-compose.dev.yml`; `piper/Dockerfile` + entrypoint (voice downloaded to volume on first start, enabling future voice packs).

## 8. Non-goals (this sub-project)

- Formal Portainer stack / production compose (→ Sub-project C).
- ASR / pronunciation scoring implementation (seams only).
- Voice-pack management UI (drop-in volume only).
- Cache pruning / size caps.
- Commercial-distribution license clearance for the Indonesian voice model (documented flag).
