# Mission Completion Report Design — Sub-project D

**Sub-project:** D (of the Production Deployment mission)

**Date:** 2026-08-15

**Status:** Approved design

## Purpose

Produce the Production Deployment mission's final deliverable: a single owner/maintainer-oriented completion report at `docs/MISSION-REPORT.md` covering all four sub-projects (A: server data layer + auth, B: voice system, C: ops & CI/CD, D: this report). This is a **docs-only** sub-project — no application code changes.

## Decisions (confirmed with user)

- Single document: `docs/MISSION-REPORT.md`.
- Audience: the repo owner + a future maintainer (not marketing, not a newcomer tutorial).
- No other deliverables in D (no README rewrite, no verification-report refresh, no licensing deep-dive — those are explicitly out of scope; any that are still worth doing go into the report's "Next steps" section).
- Terminal state is the report itself; the spec/plan docs are produced along the way per the superpowers workflow.

## Report structure (approved outline)

1. **Executive summary** — what the app is now (multi-user, self-hosted, Indonesian tutor with Piper voice) vs. where it started (client-only prototype).
2. **What shipped, by sub-project** — A/B/C with their verification evidence.
3. **How it fits together** — ASCII architecture diagram + a short request-path walk (login → dashboard → lesson → speak).
4. **Verification summary** — final numbers (166 unit / 9 e2e, build, Docker Desktop acceptance, CI gates); the fail-fast/health design.
5. **Known limitations & deferred items** — the parked ledger list.
6. **How to run** — dev (host + compose) and prod (Docker Desktop smoke → Portainer deploy); pointers to `docs/ops/deployment.md` and `.env.example`.
7. **Next steps** — the steps that require the user (repo remote, Portainer stack, webhook secret, real-NAS deploy) + future work.

Length target: ~150–250 dense lines.

## Facts the report must state accurately (verify before writing)

- Final gate numbers: `npx tsc --noEmit` clean, **166 unit tests** (34 files), `npm run build` green, **9/9 Playwright e2e** (auth 6 + voice 1 + smoke 2), Docker Desktop prod-stack acceptance (4 services healthy, audible Piper, fail-fast → unhealthy/502).
- Sub-project A: Drizzle ORM + committed SQL migrations auto-run at boot; JWT (jose HS256) + hashed rotating refresh tokens with family revocation; bcrypt cost 12; middleware header-spoofing defense; CSRF `x-kak-request`; rate limits (auth 10/min, tutor 20/min, tts 60/min, env-configurable); `TRUST_PROXY=false` fails fast in prod; security headers; webpack externals fix.
- Sub-project B: SpeechProvider async seam; piperTTS + browserTTS behind a resolver with 60s cached fallback decision; `/api/tts` auth-gated + rate-limited + sha256-cached (atomic writes, RIFF check); Piper sidecar (`piper-tts==1.6.1`, Indonesian voice `id_ID-news_tts-medium`, host 5001 in dev / internal `piper:5000` in prod); Settings voice picker persisted via `profiles.tts_voice`; CSP `media-src 'self' blob:` fix; voice-validation 400s.
- Sub-project C: Node 22 + exact pins; `output: "standalone"`; `/api/health` (liveness); prod fail-fast config (entrypoint `validate-config.mjs` + instrumentation throw, `NEXT_PHASE` build guard); multi-stage Dockerfile (drizzle copied — standalone doesn't trace it); `docker-compose.prod.yml` (app/piper/postgres/caddy, only Caddy publishes, DB internal); Caddy TLS; GH Actions verify/e2e/deploy (ghcr.io `main`+`sha`, Portainer webhook); `npm audit` advisory-only; CI lint step removed (no ESLint in project).
- Deferred/parked items (from the sub-project B and C ledgers): Settings Piper status is env-static not liveness-aware (functional fallback holds); TTS cache key is text+voice (cross-user sharing, low sensitivity today); `/api/health` is liveness-only (no DB ping); Next 15.1.6 CVE-2025-66478 advisory (audit advisory-only by design); Piper voice model license "unclear" — flag for commercial distribution; CI has no concurrency group; `package.json` `lint` script is non-functional locally (no ESLint); root `package-lock.json` ranges still `^` (self-heals); no automated test for the instrumentation throw guard (covered by container smoke); piperTTS `audioEl` singleton not reset between tests; SpeakButton hint never clears; Settings "Default" voice option duplicates a value + one-way door.
- Repo state: work committed directly on `main` (user's standing choice); no git remote yet.

## Out of scope (explicit)

- README.md rewrite/newcomer guide.
- Refreshing `docs/verification-report.md` to final numbers.
- Piper/licensing deep-dive.
- Any application code, config, or workflow changes.
- Fixing any deferred item — these are listed as limitations, not addressed in D.

## Verification

- Report renders as clean Markdown (headings, ASCII diagram intact, no unrendered code fences).
- Every fact above cross-checked against the current tree before writing (gate numbers re-run or taken from the final Task 6/C acceptance reports; file/commit references verified with `git log`).
- No code/config/CI files changed by this sub-project (only docs).
