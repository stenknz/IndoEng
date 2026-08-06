# Production Deployment: Server Data Layer & Auth — Design

**Date:** 2026-08-06
**Sub-project:** A (of the Production Deployment mission)
**Status:** Approved by user (sections 1–4)

## 1. Background

The Kak app is currently 100% client-side: all learner data lives in `localStorage`,
mutated by a synchronous Zustand store (`src/lib/store/useStore.ts` → `localStore.ts`).
The only server code is a single AI-tutor proxy route. The mission is to make the app
production-ready and self-hostable on an ASUSTOR NAS via Portainer with multiple users.

The full mission was decomposed into four sequential sub-projects:

| # | Sub-project | Mission phases |
|---|---|---|
| A | Server data layer + auth (this spec) | 1, 4, 5, 6, 7, 8, 11, 14, 15 |
| B | Voice system: SpeechProvider + Piper TTS | 9, 10 |
| C | Ops & distribution: Docker, Portainer, CI/CD, upgrades | 2, 3, 12, 13, 15, 16 |
| D | Docs & reports | 17 + final deliverables |

**Test target note (user requirement):** the user has Docker Desktop on their Mac and
wants to test the deployed stack there once Sub-project C (Docker) is ready. The user
must be told when to start Docker Desktop before Docker work begins.

## 2. Decisions (agreed with user)

- **Database tooling:** Drizzle ORM + `drizzle-kit` migrations (plain committed SQL, auto-run at boot).
- **Auth:** hand-rolled JWT sessions (`jose` for JWT, `bcryptjs` for hashing), no framework.
- **Admin scope:** seed admin via env; admin UI = list users, enable/disable, reset password.
- **Reset/verify:** architecture-ready + optional SMTP. No email required to use the app; without SMTP, password recovery is admin-driven.
- **Data layer:** server-backed Zustand store with REST API and **normalized relational tables** (not a JSONB blob, not TanStack Query).

## 3. Architecture

Next.js 15 App Router remains the single deployable. PostgreSQL is the only external
dependency. Persistence lives behind REST API routes under `/api/*`, guarded by an auth
middleware. The client keeps Zustand as an in-memory cache with **identical method
signatures**, so components change minimally. Drizzle ORM defines the schema; committed
SQL migrations run automatically at container startup.

## 4. Data model

All user-data tables are scoped by `userId`.

| Table | Purpose | Key fields |
|---|---|---|
| `users` | Accounts | `id` uuid, `email` (unique, lowercase), `name`, `passwordHash`, `role` (`student`/`admin`, `teacher` reserved), `emailVerifiedAt` (future), `emailVerifyTokenHash` + `emailVerifyTokenExpiresAt` (future), `mfaSecret` (future), `disabledAt` (admin lock), timestamps |
| `refreshTokens` | Revocable sessions | `id`, `userId`, `tokenHash` (hashed), `expiresAt`, `createdAt`, `replacedById` (rotation) |
| `profiles` | One per user | `userId` PK, all `LearningProfile` fields; `recentMistakes` JSONB |
| `words` | SRS tracking | PK `(userId, wordId)`, familiarity/exposures/correct/mistakes/lastReviewed/nextReview/streak |
| `lessons` | Lesson progress | PK `(userId, lessonId)`, status, completedAt, attempts |
| `grammar` | Concept exposure | PK `(userId, conceptId)`, exposedAt, mastered |
| `conversations` | Chat history | `id`, `userId`, `lessonId`, `startedAt`, `messages` JSONB |
| `attempts` | Practice log | `id`, `userId`, ts, kind, prompt, learnerAnswer, expected, correct, `wordIds` JSONB |
| `sessions` | Learning sessions | `id`, `userId`, ts, durationMin, wordsReviewed, newWords, recallRate |

Migrations: `drizzle-kit generate` → committed SQL; a boot-time runner applies only
pending migrations via Drizzle's migration table (idempotent, additive, zero data loss).

## 5. Authentication & sessions

- **Register/login:** email + password, `bcryptjs` cost 12 (pure-JS, multi-platform Docker-safe). Emails normalized lowercase. Registration auto-logs-in.
- **Sessions:** short-lived access JWT + rotating refresh token.
  - Access JWT: HS256 via `jose`, signed with `JWT_SECRET`, ~15 min, carries `userId` + `role`, delivered as `httpOnly` + `SameSite=Lax` + `Secure` cookie.
  - Refresh token: 30-char random value, stored **hashed**, **rotated on every use** (old row marked replaced; reuse detection possible). Lifetime 7 days; 30 days with **Remember me**. Revocable: logout deletes row; admin-disable rejects all refreshes.
  - Middleware verifies access JWT on all `/api/*`; on 401 the client calls `/api/auth/refresh` and retries.
- **Endpoints:** `register`, `login`, `logout`, `refresh`, `me`, `change-password`, future-ready `request-password-reset` / `verify-email` (active only when SMTP configured; otherwise admin reset covers recovery).
- **Roles:** `student` (default), `admin` (seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD` at first boot). `/api/admin/*` gated by admin role: list users, enable/disable, reset password.
- **Rate limiting:** in-memory token bucket on `/api/auth/*` (10/min/IP) and `/api/tutor` (20/min/IP), respecting `X-Forwarded-For` when `TRUST_PROXY=true`.
- **Future-readiness (schema only):** `emailVerifiedAt` + verify-token fields, `mfaSecret`, OAuth account table.

## 6. API surface & store integration

**API routes (session required unless noted):**
- `GET /api/state` — full `LearnerState` hydration snapshot
- `POST /api/words` — `{ wordId, result }`; server recomputes SRS (source of truth), returns updated word
- `POST /api/words/[wordId]/touch` — record exposure
- `POST /api/lessons` — `{ lessonId, status }`
- `POST /api/attempts` — append practice attempt
- `POST /api/sessions` — append learning session
- `PUT /api/conversations` — upsert conversation
- `PATCH /api/profile` — update profile fields
- `DELETE /api/state` — reset all user data (Settings "reset")
- `PATCH /api/auth/me` — change display name
- `/api/auth/*`, `/api/admin/*`, `/api/tutor` (as in Section 5 / below)

**Store integration:**
- `localStore` → `serverStore`; `useStore` method signatures unchanged.
- `hydrate()` → `GET /api/state`; on 401 redirect to login.
- Every mutation: optimistic local update (reusing deterministic SRS scheduler) + background write + reconcile with server response.
- `resetAll()` → `DELETE /api/state` then rehydrate.
- Auth actions (register/login/logout/change-password) in a small `useAuth` client module.
- **Gating:** `Shell` becomes an auth gate — no session → login/register screen; after login, hydrate. Existing pages work unchanged behind it.

**AI tutor (multi-user):** `/api/tutor` requires a session and builds learner context
(words, lessons, profile, conversation history) server-side from the DB by `userId`,
not from the client payload. Stays OpenAI-compatible so a future self-hosted provider
(e.g. Ollama) works via `BASE_URL` env with no code change.

## 7. Configuration & secrets

Env vars (never in source; see `.env.example` for the production mission):
- `DATABASE_URL`, `JWT_SECRET` (32+ bytes), `SESSION_TTL_HOURS` (8), `REMEMBER_TTL_DAYS` (30)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `SMTP_HOST/PORT/USER/PASS/FROM` (optional), `APP_URL` (public base URL)
- `TRUST_PROXY` (respect `X-Forwarded-*`), `COOKIE_SECURE` (auto-true in production)
- AI: `OPENCODE_GO_API_KEY/BASE_URL/MODEL`

`lib/config.ts` validates every required var at server boot, throwing a precise error
naming the missing one. The container entrypoint runs a `validate-config` check so
Docker Compose fails fast with a useful message (implemented in Sub-project C).

## 8. Security hardening

- bcrypt cost 12; JWT HS256 via `jose`; refresh tokens hashed at rest + rotation.
- CSRF: SameSite=Lax cookies + origin/referer check on state-changing routes + JSON-only bodies.
- Input validation: Zod schemas on every endpoint (email format, password min 8, length caps).
- Rate limiting: in-memory token bucket (Section 5).
- Headers: CSP, `X-Content-Type-Options`, frame-deny, referrer-policy in `next.config.mjs`.
- Secrets never logged; generic client errors; `npm audit` in CI (Sub-project C).

## 9. Testing

- **Unit (Vitest):** `config.ts` validation; auth (hash/verify, JWT issue/verify/expiry, role checks, refresh rotation/reuse); rate limiter; SRS (unchanged); Zod schemas.
- **Integration (Vitest):** API handlers against a throwaway Postgres (dockerized in CI; optional locally).
- **E2E (Playwright):** register → login → complete a lesson → review → logout; User-B-can't-see-User-A isolation check.

## 10. Non-goals (this sub-project)

- Docker files, Portainer stack, CI/CD → Sub-project C.
- Piper TTS / SpeechProvider → Sub-project B.
- Full docs and reports → Sub-project D.
- Implementing email verification / MFA / social login flows (schema-ready only).
- Full teacher role behavior (reserved in schema).
