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
   `docker-compose.prod.yml`.
3. Set the stack environment variables from `.env.example`:
   - `APP_IMAGE`/`PIPER_IMAGE` → `ghcr.io/<your-user>/<your-repo>/kak-{app,piper}:main`
   - `APP_DOMAIN` → your domain (Caddy issues Let's Encrypt automatically)
   - `DATABASE_URL=postgres://<user>:<pass>@postgres:5432/<db>`
   - `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `TRUST_PROXY=true`
4. Deploy. Portainer creates the volumes (`pg_data`, `piper_data`, `tts_cache`,
   `caddy_data`, `caddy_config`) — data survives stack redeploys.
5. In the stack's settings, copy the **webhook URL**; set it as the
   `PORTAINER_WEBHOOK_URL` GitHub secret. Pushing to `main` now rebuilds the
   image and redeploys the stack automatically.

## Notes

- The Piper voice downloads from HuggingFace on first boot (needs internet on
  the NAS); to air-gap, pre-seed `piper_data` on the NAS first.
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
- **Port 80 busy** (e.g. another server) → set `CADDY_HTTP_PORT=8080` and
  browse `https://localhost:8080`. Port 443 likewise via `CADDY_HTTPS_PORT`.
- **Playwright `response.body()` returns 0 bytes** for the streamed
  `/api/tts` audio behind Caddy (gzip/chunked); verify audibility by the
  `tts_cache` volume WAV size or a plain `curl` instead of the response body.
- Piper's host port is **5001** in the dev compose on all platforms
  (`5001:5000`; macOS AirPlay owns 5000).
