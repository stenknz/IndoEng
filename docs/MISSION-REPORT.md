# Mission Report — Production Deployment (Sub-projects A–D)

**Date:** 2026-08-15
**Status:** Complete (all four sub-projects implemented and verified on `main`)
**Applies to commit:** `8badaa3e4ed9bc3b27b4cc0efa864f5c2826e720`

## 1. Executive summary

The app started as a client-only prototype: vocabulary and phrases persisted in
`localStorage`, with audio produced by the macOS Web Speech synthesis API on the
visitor's machine. There was no backend, no login, and nothing survived a
browser profile wipe.

It is now a multi-user, self-hosted platform. A Next.js 15 server (rendered as a
standalone output) sits behind Caddy with automatic TLS, backed by Postgres and
a Piper TTS sidecar, all deployed from GitHub Actions to a NAS Docker host. Any
Indonesian learner can register, log in, practice lessons, and hear Indonesian
voice audio generated on the server.

- **A — Server data layer + auth:** Postgres + Drizzle with committed SQL
  migrations, JWT session tokens with rotating hashed refresh tokens, per-user
  lesson data, and hardening (bcrypt cost 12, header-spoofing defense, CSRF,
  rate limits).
- **B — Voice system:** an Indonesian Piper TTS sidecar wired in behind a
  fallback-capable speech provider, so lesson audio works in the browser and
  degrades gracefully when Piper is unavailable.
- **C — Ops & CI/CD:** a production Docker/Portainer/Caddy stack, health and
  fail-fast config, and a GitHub Actions pipeline that verifies, builds, and
  deploys the stack.

## 2. What shipped, by sub-project

### A — Server data layer + auth

- Drizzle ORM with committed SQL migrations under `src/lib/db` and
  `./drizzle`; migrations auto-run at boot via `migrate.ts`.
- JWT sessions (jose, HS256) plus hashed rotating refresh tokens with family
  revocation on reuse.
- bcrypt cost 12 for password hashing; admin seeding from
  `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- Middleware header-spoofing defense; CSRF protection via the `x-kak-request`
  header requirement.
- Rate limits: auth 10/min, tutor 20/min, tts 60/min — all env-configurable.
- `TRUST_PROXY=false` fails fast in production (see section 4).
- Security headers and a webpack `externals` fix so the standalone build stays
  small and self-contained.

### B — Voice system

- `SpeechProvider` async seam so components await a ready speech engine.
- `piperTTS` + `browserTTS` behind a resolver with a 60s cached fallback
  decision; functional fallback holds if Piper is down.
- `/api/tts` is auth-gated, rate-limited, and sha256-cached (atomic writes,
  RIFF header check). Cache key is text+voice (see limitations).
- Piper sidecar pinned to `piper-tts==1.6.1` with the Indonesian voice
  `id_ID-news_tts-medium`; host port 5001 in dev, internal `piper:5000` in
  prod.
- Settings voice picker persisted via `profiles.tts_voice` and honored by
  SpeakButton and the Coba sample.
- CSP `media-src 'self' blob:` fix so Piper audio is audible; unknown-voice
  requests get a 400 validation error.

### C — Ops & CI/CD

- Node 22 with exact dependency pins (`package-lock.json`); `.nvmrc` drives CI.
- `output: "standalone"` for a minimal Docker image.
- `/api/health` liveness endpoint; prod fail-fast via the
  `validate-config.mjs` entrypoint + instrumentation throw and a `NEXT_PHASE`
  build guard.
- Multi-stage Dockerfile that explicitly copies `./drizzle` (standalone
  doesn't trace it).
- `docker-compose.prod.yml`: app/piper/postgres/caddy; only Caddy publishes
  ports, the database is internal-only. Caddy handles TLS.
- GitHub Actions `verify`/`e2e`/`deploy` jobs: ghcr.io `main`+`sha` image tags,
  Portainer webhook deploy, `npm audit` advisory-only, CI lint step removed
  (no ESLint in the project).

## 3. How it fits together

```
                        internet
                           |
                         [Caddy]   :80/:443  TLS
                           |
                     internal :3000
                           |
                    [Next standalone app]
                          /  |  \
                 /api/health /api/tts  (outbound)
                       |      |
                  postgres   piper:5000
                  (internal)  (internal)
```

Request path: browser → (auth middleware) → dashboard/lesson → SpeakButton →
`/api/tts` → Piper sidecar (or browser-TTS fallback) → cached WAV → audio. The
app serves its own UI, checks tokens in middleware, reads/writes lesson state in
Postgres, and synthesizes speech through the internal Piper container; if Piper
is unavailable the resolver falls back to the browser's own speech API so
lessons remain usable.

## 4. Verification summary

- `npx tsc --noEmit` clean.
- 166 unit tests / 34 files passing (`npx vitest run`).
- Production build green (`npm run build`).
- 9/9 Playwright e2e: 6 auth + 1 voice (real Piper sidecar) + 2 smoke.
- Docker Desktop prod-stack acceptance: 4 services healthy, audible Piper
  audio, and the `TRUST_PROXY=false` fail-fast path confirmed (container
  unhealthy → 502).
- Gates were re-run at report time: `tsc --noEmit` and the vitest suite both
  passed on the commit noted above; the e2e and Docker acceptance runs are
  recorded in `docs/ops/deployment.md` and the CI workflows.
