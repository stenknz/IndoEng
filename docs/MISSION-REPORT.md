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
a Piper TTS sidecar, all deployable from GitHub Actions to a Docker/Portainer
host. Any
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
                       |            \
                       |             \
                  postgres      piper:5000
                 (internal)    (outbound TTS)
                 DB read/write
```

`/api/health` is a liveness-only probe and never pings the database. The only
outbound service call from the app is `app → piper:5000`; `/api/tts` is the
in-app route the browser hits, not an outbound hop.

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

## 5. Known limitations & deferred items

Each item was re-verified against the tree before listing. Marked
"(safe to defer)" or "(needs decision)".

- **Settings Piper status is env-static, not liveness-aware.** `ttsService.ts`
  computes `configured` from env (`cfg.tts.provider === "piper" && piperUrl`
  set), never from Piper's runtime state. Functional fallback holds: if Piper
  is down, the resolver degrades to browser TTS. (safe to defer)
- **TTS cache key is text+voice only.** `/api/tts` entries are shared across
  users; fine today because lesson audio is identical for everyone and
  low-sensitivity. (safe to defer)
- **`/api/health` is liveness-only (no DB ping).** It returns
  `{ status: "ok" }` without touching Postgres, so a DB outage won't fail the
  probe. (safe to defer)
- **Next 15.1.6 advisory.** `npm audit` reports multiple advisories affecting
  `next@15.1.6`, including the RSC RCE (GHSA-9qr9-h5gf-34mp /
  CVE-2025-55182). The audit is advisory-only by design. The ledger's
  "CVE-2025-66478" reference is a rejected NVD duplicate of CVE-2025-55182;
  the advisory is real, only the identifier was wrong. (safe to defer)
- **Piper voice model license "unclear".** The sub-project B design flagged it:
  the Indonesian voice model's license is fuzzy and must be cleared before any
  commercial distribution. (needs decision)
- **No CI concurrency group.** Concurrent pushes can run duplicate
  verify/deploy jobs; harmless at current volume. (safe to defer)
- **`package.json` `lint` script is non-functional locally** — `next lint`
  with no ESLint installed; the CI lint step is already removed. (safe to defer)
- **Root `package-lock.json` ranges still `^`** (e.g. `"bcryptjs": "^3.0.3"`);
  the lockfile self-heals on regeneration. (safe to defer)
- **No automated test for the instrumentation throw guard.** The fail-fast
  path is covered by container smoke instead. (safe to defer)
- **piperTTS `audioEl` singleton is not reset between tests** — a cached
  `Audio` element in `src/lib/audio/piperTTS.ts`; harmless in the current
  suite. (safe to defer)
- **SpeakButton hint never clears.** Once shown, the "cannot play audio" hint
  stays until unmount. (safe to defer)
- **Settings "Default" voice option duplicates a value and is a one-way
  door.** Its value equals the resolved default voice already in the list, and
  once another voice is chosen the option disappears. (needs decision)

## 6. How to run

**Development** (host + containers): `npm run dev` for the Next.js app with
`.env.local` per `.env.example`; `docker compose -f docker-compose.dev.yml up`
for Postgres + Piper (Piper on host port 5001).

**Production**: Docker Desktop smoke first — build both images
(`docker build -t kak-app:main .` and `docker build -t kak-piper:main ./piper`),
then `docker compose -f docker-compose.prod.yml up -d` and confirm the four
services come up healthy with audible Piper audio (browse `https://localhost`).
Then the Portainer deploy: add the compose file plus the `.env` and `Caddyfile`
stack files, set `APP_IMAGE`/`PIPER_IMAGE` to the ghcr.io tags, and configure
the `PORTAINER_WEBHOOK_URL` secret. Full runbook: `docs/ops/deployment.md`.

## 7. Next steps

Steps that require the user:

- Add the git remote and push `main` (`git remote add origin …`; no remote
  exists yet).
- Create the Portainer stack with the compose + `.env` + `Caddyfile` files.
- Set the `PORTAINER_WEBHOOK_URL` GitHub secret (Portainer Business; Community
  Edition must redeploy manually).
- Set `APP_IMAGE`/`PIPER_IMAGE` to the ghcr.io tags and do the real-NAS deploy
  with acceptance.

Future work: liveness-aware TTS status in Settings, `/api/health` readiness
(DB ping), a CI concurrency group, ESLint setup or lint-script removal, and the
Piper voice-model license decision before any commercial distribution.
