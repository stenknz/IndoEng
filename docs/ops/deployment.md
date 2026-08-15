# Deployment (Sub-project C)

## Architecture

`docker-compose.prod.yml` runs four services: `app` (Next.js standalone),
`piper` (TTS sidecar), `postgres` (16-alpine), `caddy` (TLS reverse proxy).
Only Caddy publishes ports. `app` is reachable by Caddy over the `proxy`
network and talks to `postgres`/`piper` over `internal`.

## 1. Test the full stack on Docker Desktop first

```bash
docker build -t kak-app:main .
docker build -t kak-piper:main ./piper
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps          # all healthy
open http://localhost
```

Register a user, open Settings → Suara (Piper status + audible "Coba"), complete
lesson 1. Teardown: `docker compose -f docker-compose.prod.yml down -v`.

## 2. Deploy to the ASUSTOR NAS via Portainer

1. Push the repo to GitHub, then in GitHub Actions add the secret
   `PORTAINER_WEBHOOK_URL` (see `.github/workflows/ci.yml`).
2. In Portainer → Stacks → **Add stack** → paste the contents of
   `docker-compose.prod.yml` as the compose text. The stack's **Environment
   variables** panel only feeds `${VAR}` interpolation into that text; it does
   **not** create the files the compose file references.
3. This compose file uses `env_file: .env` and bind-mounts `./Caddyfile`, so in
   Portainer → Stacks → **Edit stack** → **Add file**, create **both** of these
   files in the stack:
   - **`.env`** — content = the values listed below (an actual `.env` file in
     the stack is required for `env_file` to resolve; env vars alone do not
     create it):
     - `APP_IMAGE`/`PIPER_IMAGE` → `ghcr.io/<your-user>/<your-repo>/kak-{app,piper}:main`
     - `APP_DOMAIN` → your domain (Caddy issues Let's Encrypt automatically)
     - `DATABASE_URL=postgres://<user>:<pass>@postgres:5432/<db>`
     - `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TRUST_PROXY=true`
   - **`Caddyfile`** — content:
     ```
     {$APP_DOMAIN:localhost} {
         encode gzip
         reverse_proxy app:3000
     }
     ```
4. Deploy. Portainer creates the volumes (`pg_data`, `piper_data`, `tts_cache`,
   `caddy_data`, `caddy_config`) — data survives stack redeploys.
5. In the stack's settings, copy the **webhook URL**; set it as the
   `PORTAINER_WEBHOOK_URL` GitHub secret. Pushing to `main` now rebuilds the
   image and redeploys the stack automatically.
6. **Note:** stack webhooks are a **Portainer Business** feature. On
   **Community Edition** there is no webhook; the fallback is to redeploy
   manually (Stacks → your stack → "Update / Pull image") or call the
   Portainer API. GitHub Actions still pushes images to ghcr.io on every
   `main` push either way.

## Notes

- The Piper voice downloads from HuggingFace on first boot (needs internet on
  the NAS); to air-gap, pre-seed `piper_data` on the NAS first.
- If the GitHub repo is private, register a ghcr.io credential in Portainer
  (Settings → Registries) using a PAT with `read:packages` scope, or every
  redeploy's `docker pull` fails with `unauthorized`.
- `TRUST_PROXY=true` is mandatory in production (config validation fails
  otherwise) so rate limiting sees the real client IP behind Caddy.
- Migrations run automatically at app boot (src/instrumentation.ts); no manual
  DB steps. Admin account is seeded on first boot from `ADMIN_EMAIL`/
  `ADMIN_PASSWORD`.

## 3. Verification summary (Task 6 — 2026-08-15)

Full local gate on `main` (`21da317`): `tsc --noEmit` clean; vitest
**166/166**; `next build` OK (standalone); Playwright **9/9** (against the dev
compose Postgres + Piper). Full prod stack accepted on Docker Desktop:
`docker compose -f docker-compose.prod.yml up -d --build` → `app`/`piper`/
`postgres`/`caddy` all running, `app` healthy. Browser (Chromium) smoke via
Caddy: register/login/logout work, Settings → Suara shows `Suara Piper
(server) ✓`, "Coba" plays a real Piper WAV (116,780 bytes), lesson words
speak (30,252 bytes in `tts_cache`). `/api/health` → `200 {"status":"ok"}`
through Caddy. Fail-fast verified end-to-end: with `TRUST_PROXY=false` the
`app` container logs `TRUST_PROXY must be true in production`, stays
`Restarting (1)`, reports `unhealthy`, and Caddy returns 502 — it never
starts.

### Docker Desktop caveats found

- **Caddy auto-HTTPS redirects `http://` → `https://`** (308). Use
  `https://localhost` (curl: add `-k`; the cert is Caddy's local CA).
- **Port 80 busy** (e.g. another server) → remap `CADDY_HTTP_PORT` to a free
  port but browse `https://localhost` (port 443): remapping only the HTTP port
  leaves TLS on 443, so `https://localhost:<http-port>` fails the TLS
  handshake. If 443 is also busy, set `CADDY_HTTPS_PORT=8443` and browse
  `https://localhost:8443` directly (the auto-redirect still targets 443).
- **Playwright `response.body()` returns 0 bytes** for the streamed
  `/api/tts` audio behind Caddy (gzip/chunked); verify audibility by the
  `tts_cache` volume WAV size or a plain `curl` instead of the response body.
- Piper's host port is **5001** in the dev compose on all platforms
  (`5001:5000`; macOS AirPlay owns 5000).
