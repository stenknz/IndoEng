# Production Ops & CI/CD Design — Sub-project C

**Sub-project:** C (of the Production Deployment mission)

**Date:** 2026-08-15

**Status:** Approved design

## Purpose

Make the app **self-hostable on an ASUSTOR NAS via Portainer** and delivered through **GitHub Actions**: a containerized Next.js app (standalone), a production compose stack (app + Piper + Postgres + Caddy reverse-proxy), CI that gates every change, and CD that publishes images to ghcr.io and redeploys the NAS stack via a Portainer webhook.

Mission phases covered: 2 (Dockerfiles), 3 (compose stack), 12 (CI), 13 (CD), 15 (health checks / validate-config), 16 (Node & version pinning). Phase 17 (final deliverables/report) is Sub-project D.

## Scope decisions (confirmed with user)

- GitHub + GitHub Actions; repo will be hosted on GitHub (remote not yet configured).
- NAS access via a **domain + reverse-proxy inside the stack** (Caddy); LAN-IP fallback documented for testing.
- "Upgrades" = **pin Node 22 + exact dependency versions** only. No Next/React major upgrades, no audit fixes.
- CI runs the **full gate**: lint + tsc + unit + build + audit (advisory) + Playwright e2e against a throwaway Postgres.
- Delivery = **ghcr.io push + Portainer webhook redeploy** on `main`.
- User validates the full prod stack locally on **Docker Desktop** before touching the NAS.
- Approach A: two compose files (`docker-compose.dev.yml` stays; new `docker-compose.prod.yml` pasted into Portainer).

## 1. App containerization

### `next.config.mjs`
- Add `output: "standalone"`.

### Root `Dockerfile` (multi-stage, Node 22 LTS)
1. `deps`: `node:22-alpine` → `npm ci`.
2. `builder`: from `deps` → `npm run build`.
3. `runner`: `node:22-alpine` → copy `.next/standalone`, `.next/static`, `public`; `EXPOSE 3000`; `CMD ["node", "server.js"]` (standalone entrypoint). A tiny `docker-entrypoint.sh` wrapper is permitted if needed for signal handling / exec semantics.

### `.dockerignore`
node_modules, .next, .git, tests, docs, .env*, screenshots, docker-compose files, e2e artifacts, .superpowers.

### Health check
- New route `src/app/api/health/route.ts` → `200 { status: "ok" }`. No DB dependency (liveness only). It is already in the middleware `PUBLIC_AUTH` set, so it responds without auth.
- Used by the Docker `HEALTHCHECK` and by compose `healthcheck` for the `app` service.

### Fail-fast config
- `src/instrumentation.ts` currently calls `validateConfig()` and **skips** migrations when invalid. Change: when `NODE_ENV === "production"` and config is invalid, **throw** `ConfigError` so `docker compose up` fails fast with a clear message. Dev behavior unchanged (builds/dev without a DB must keep working).
- New `scripts/validate-config.mjs`: plain-Node script checking the critical invariants (DATABASE_URL set, JWT_SECRET length ≥ 32, `TRUST_PROXY=true` in production, Postgres/Piper env coherence). Wired as `npm run validate-config`. Used by CI/dev; intentionally minimal and independent of the zod schema (no TS build step needed in the runner image).

### Piper image
- Published to ghcr.io from the existing `./piper/Dockerfile` (already pins `piper-tts[http]==1.6.1`).

## 2. Production compose stack (`docker-compose.prod.yml`)

Four services. Network topology:
- `internal` network: `app`, `piper`, `postgres`.
- `proxy` network: `app`, `caddy`.
- Only Caddy publishes ports (`80`/`443`). The app and DB ports are **not** published.

| Service | Image | Notes |
|---|---|---|
| `app` | `${APP_IMAGE:-ghcr.io/<owner>/kak-app}:${TAG:-main}` | `env_file: .env`, `depends_on` postgres (healthy) + piper, `healthcheck` → `/api/health`, volume `tts-cache:/data/tts-cache`, `restart: unless-stopped`, no published port |
| `piper` | `${PIPER_IMAGE:-ghcr.io/<owner>/kak-piper}:${TAG:-main}` | internal-only, volume `piper_data:/data` |
| `postgres` | `postgres:16-alpine` | internal-only, creds from `.env`, volume `pg_data` |
| `caddy` | `caddy:2-alpine` | `80`/`443`, `reverse_proxy app:3000`, auto Let's Encrypt for `APP_DOMAIN`, volumes `caddy_data`/`caddy_config` |

### Production `.env` (documented in `.env.example`)
`DATABASE_URL` (host `postgres`), `JWT_SECRET` (≥32), `APP_URL=https://<domain>`, `TRUST_PROXY=true`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`, `PIPER_URL=http://piper:5000`, `TTS_CACHE_DIR=/data/tts-cache`, optional `TTS_RATE_LIMIT_MAX`, `SMTP_*`.

### Deploy to NAS (documented in a README or the compose itself)
1. Portainer → Stacks → Add stack → paste `docker-compose.prod.yml` + `.env`.
2. Note the stack's webhook URL; configure `PORTAINER_WEBHOOK_URL` secret in GitHub.
3. `deploy` job calls the webhook to redeploy after each `main` push.

### Docker Desktop test target
Same `docker-compose.prod.yml` runs locally with `APP_DOMAIN=http://localhost` (Caddy still works, or a documented LAN-IP mode without TLS). This is the user's pre-NAS validation.

## 3. CI/CD — `.github/workflows/ci.yml`

Trigger: push + pull_request. Deploy job only on `main` and only after verify+e2e pass.

| Job | Runs on | Steps |
|---|---|---|
| `verify` | every push/PR | `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm test` → `npm audit` (advisory, non-blocking) → `npm run build` |
| `e2e` | every push/PR | spin up throwaway Postgres + Piper via compose → `npm run test:e2e` → teardown |
| `deploy` | `main` only | buildx build app + piper → push `ghcr.io` (`<sha>` + `main` tags) → `curl` Portainer webhook |

### GitHub secrets
`GHCR_TOKEN` (or default `GITHUB_TOKEN` with `packages: write`), `PORTAINER_WEBHOOK_URL`, optional `PORTAINER_WEBHOOK_TOKEN`. `APP_DOMAIN` etc. live in the NAS `.env`, not in CI.

## 4. Version pinning

- `.nvmrc` → `22`.
- `package.json` `"engines": { "node": ">=22" }`.
- Exact-pin dependency versions (package.json already uses exact versions; verify none remain caret/floating).

## Out of scope (deferred / later)

- Next/React major upgrades; `npm audit` fixes (only a non-blocking advisory report in CI).
- DB migrations via CD: migrations still run at app boot via `instrumentation.ts`.
- Traefik alternative to Caddy; multiple-site proxy configs.
- `/api/health` readiness (DB-ping) endpoint — liveness only for now.
- Sub-project D: final docs + mission report.

## Verification

- `docker build .` succeeds; `docker run -p 3000:3000` serves `/api/health` 200 and the app.
- `docker compose -f docker-compose.prod.yml up` on Docker Desktop: Caddy → app → Piper → Postgres all healthy; register + speak + TTS audible.
- CI: verify + e2e green on a test push; deploy pushes images and (with a real webhook URL) redeploys.
- Full local gate stays green: `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run test:e2e`.
