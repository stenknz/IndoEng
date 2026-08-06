# Server Data Layer & Auth Implementation Plan (Sub-project A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Kak app from a client-only, single-user app to a multi-user, server-backed app with PostgreSQL, JWT authentication, roles, and per-user data isolation.

**Architecture:** Next.js App Router stays the single deployable. A Drizzle ORM layer talks to PostgreSQL. Hand-rolled JWT sessions (short access token + rotating refresh token in httpOnly cookies). All learner data moves behind REST API routes scoped by `userId`; the client keeps Zustand as a cache with unchanged method signatures. Auth gating lives in the `Shell`.

**Tech Stack:** Next.js 15.1.6, TypeScript 5.7, Drizzle ORM + drizzle-kit, node-postgres (`pg`), `jose` (JWT), `bcryptjs` (hashing), `zod` (validation), Vitest (unit/integration), Playwright (e2e), `pg-mem` (in-memory Postgres for tests).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-06-production-server-auth-design.md` — this plan implements it fully.
- **Keep:** Next 15.1.6, React 19, TS strict, Tailwind, existing SRS engine, word/lesson data, existing UI components.
- **No native modules:** `bcryptjs` (pure JS) and `jose` (pure JS) only. Must build on Docker for linux/amd64 + linux/arm64, Windows, macOS.
- **Secrets:** only via environment variables; never logged; never committed. `.env.local` is gitignored.
- **Isolation:** every query scoped by `userId`; never trust a client-provided `userId`; server derives it from the JWT.
- **Server-only modules:** `src/lib/config.ts`, `src/lib/db/*`, `src/lib/repo/*`, `src/lib/services/*` must begin with `import "server-only"` so they can never be bundled to the client.
- **Passwords:** minimum 8 chars; bcrypt cost 12; hashes never returned in API responses.
- **CSRF:** all state-changing client calls send header `x-kak-request: 1`; middleware rejects non-GET `/api/*` without it (or a matching Origin).
- **Verification after every task:** `npx tsc --noEmit`, `npx vitest run`, `npm run build` must pass (build needs no DB — module-level code must not connect to Postgres at import time).
- **Docker Desktop:** only needed at Task 13 (e2e against a real Postgres) and later for Sub-project C. The executor must tell the user to start Docker Desktop at Task 13.

---

### Task 1: Project foundation — deps, config, schema, DB, migrations

**Files:**
- Modify: `package.json` (add deps), `package-lock.json` (via npm install), `.env.example`
- Create: `src/lib/config.ts`, `src/lib/db/schema.ts`, `src/lib/db/index.ts`, `src/lib/db/migrate.ts`, `drizzle.config.ts`, `src/instrumentation.ts`
- Test: `tests/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `loadConfig(env?: NodeJS.ProcessEnv): AppConfig` and `validateConfig(): { ok: boolean; errors: string[] }`
  - `src/lib/db/schema.ts` exports table objects: `users`, `refreshTokens`, `profiles`, `learnerWords`, `learnerLessons`, `learnerGrammar`, `conversations`, `attempts`, `learningSessions`
  - `getDb(): Db` (lazy, cached, overridable via `__setDbForTests(db)`), `getPool(): Pool`
  - `runMigrations(): Promise<void>` (idempotent)
  - `src/instrumentation.ts` calls `runMigrations()` at server startup

- [ ] **Step 1: Add dependencies**

Run:
```bash
npm install drizzle-orm pg jose bcryptjs zod server-only
npm install -D drizzle-kit @types/pg pg-mem
```

- [ ] **Step 2: Write `src/lib/config.ts`**

```ts
import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(8),
  REMEMBER_TTL_DAYS: z.coerce.number().int().positive().default(30),
  ADMIN_EMAIL: z.string().email().optional().or(z.literal("")),
  ADMIN_PASSWORD: z.string().min(8).optional().or(z.literal("")),
  SMTP_HOST: z.string().optional().or(z.literal("")),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional().or(z.literal("")),
  SMTP_PASS: z.string().optional().or(z.literal("")),
  SMTP_FROM: z.string().email().optional().or(z.literal("")),
  APP_URL: z.string().url().default("http://localhost:3000"),
  TRUST_PROXY: z.coerce.boolean().default(false),
  COOKIE_SECURE: z.coerce.boolean().default(true),
  OPENCODE_GO_API_KEY: z.string().optional().or(z.literal("")),
  OPENCODE_GO_BASE_URL: z.string().url().default("https://opencode.ai/zen/go/v1"),
  OPENCODE_GO_MODEL: z.string().default("deepseek-v4-flash"),
  NODE_ENV: z.string().default("development"),
});

export interface AppConfig {
  databaseUrl: string;
  jwtSecret: string;
  sessionTtlHours: number;
  rememberTtlDays: number;
  adminEmail: string | null;
  adminPassword: string | null;
  smtp: { host: string | null; port: number; user: string | null; pass: string | null; from: string | null };
  appUrl: string;
  trustProxy: boolean;
  cookieSecure: boolean;
  opencodeGo: { apiKey: string; baseUrl: string; model: string };
  nodeEnv: string;
}

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.message).join(", ");
    throw new ConfigError(`Invalid configuration. Missing or invalid: ${missing}`);
  }
  const v = parsed.data;
  return {
    databaseUrl: v.DATABASE_URL,
    jwtSecret: v.JWT_SECRET,
    sessionTtlHours: v.SESSION_TTL_HOURS,
    rememberTtlDays: v.REMEMBER_TTL_DAYS,
    adminEmail: v.ADMIN_EMAIL || null,
    adminPassword: v.ADMIN_PASSWORD || null,
    smtp: {
      host: v.SMTP_HOST || null,
      port: v.SMTP_PORT ?? 587,
      user: v.SMTP_USER || null,
      pass: v.SMTP_PASS || null,
      from: v.SMTP_FROM || null,
    },
    appUrl: v.APP_URL,
    trustProxy: v.TRUST_PROXY,
    cookieSecure: v.COOKIE_SECURE && v.NODE_ENV === "production",
    opencodeGo: { apiKey: v.OPENCODE_GO_API_KEY ?? "", baseUrl: v.OPENCODE_GO_BASE_URL, model: v.OPENCODE_GO_MODEL },
    nodeEnv: v.NODE_ENV,
  };
}

export function validateConfig(env: NodeJS.ProcessEnv = process.env): { ok: boolean; errors: string[] } {
  const parsed = envSchema.safeParse(env);
  if (parsed.success) return { ok: true, errors: [] };
  return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
}
```

- [ ] **Step 3: Write the failing config test**

`tests/config.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { loadConfig, validateConfig, ConfigError } from "@/lib/config";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/kak",
  JWT_SECRET: "a".repeat(48),
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_PASSWORD: "password123",
  NODE_ENV: "development",
};

describe("config", () => {
  it("loads a valid config", () => {
    const c = loadConfig(base);
    expect(c.databaseUrl).toBe(base.DATABASE_URL);
    expect(c.cookieSecure).toBe(false); // dev
  });
  it("throws a precise error when DATABASE_URL is missing", () => {
    expect(() => loadConfig({ JWT_SECRET: base.JWT_SECRET })).toThrow(/DATABASE_URL/);
  });
  it("rejects a short JWT_SECRET", () => {
    expect(() => loadConfig({ ...base, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
  });
  it("validateConfig reports errors without throwing", () => {
    const r = validateConfig({});
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/DATABASE_URL/);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/config.test.ts`
Expected: FAIL with "Cannot find module '@/lib/config'".

- [ ] **Step 5: Write the Drizzle schema `src/lib/db/schema.ts`**

```ts
import { bigint, jsonb, pgTable, primaryKey, text, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("student"),
  emailVerifiedAt: bigint("email_verified_at", { mode: "number" }),
  emailVerifyTokenHash: text("email_verify_token_hash"),
  emailVerifyTokenExpiresAt: bigint("email_verify_token_expires_at", { mode: "number" }),
  mfaSecret: text("mfa_secret"),
  disabledAt: bigint("disabled_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  replacedById: uuid("replaced_by_id"),
  userAgent: text("user_agent"),
  ip: text("ip"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  level: bigint("level", { mode: "number" }).notNull().default(0),
  translationMode: text("translation_mode").notNull().default("beginner"),
  pronunciationOn: text("pronunciation_on").notNull().default("true"),
  aiTutorOn: text("ai_tutor_on").notNull().default("false"),
  vocabKnowledge: bigint("vocab_knowledge", { mode: "number" }).notNull().default(0),
  grammarKnowledge: bigint("grammar_knowledge", { mode: "number" }).notNull().default(0),
  conversationAbility: bigint("conversation_ability", { mode: "number" }).notNull().default(0),
  readingAbility: bigint("reading_ability", { mode: "number" }).notNull().default(0),
  listeningAbility: bigint("listening_ability", { mode: "number" }).notNull().default(0),
  recentMistakes: jsonb("recent_mistakes").notNull().default([]),
  confidence: text("confidence").notNull().default("0.5"),
  currentDifficulty: bigint("current_difficulty", { mode: "number" }).notNull().default(0),
  lastAnswerAccuracy: text("last_answer_accuracy").notNull().default("1"),
  consecutiveCorrect: bigint("consecutive_correct", { mode: "number" }).notNull().default(0),
});

export const learnerWords = pgTable("learner_words", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  wordId: text("word_id").notNull(),
  familiarity: bigint("familiarity", { mode: "number" }).notNull().default(0),
  exposures: bigint("exposures", { mode: "number" }).notNull().default(0),
  correct: bigint("correct", { mode: "number" }).notNull().default(0),
  mistakes: bigint("mistakes", { mode: "number" }).notNull().default(0),
  lastReviewed: bigint("last_reviewed", { mode: "number" }),
  nextReview: bigint("next_review", { mode: "number" }),
  streak: bigint("streak", { mode: "number" }).notNull().default(0),
}, (t) => [primaryKey({ columns: [t.userId, t.wordId] })]);

export const learnerLessons = pgTable("learner_lessons", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lessonId: text("lesson_id").notNull(),
  status: text("status").notNull().default("not_started"),
  completedAt: bigint("completed_at", { mode: "number" }),
  attempts: bigint("attempts", { mode: "number" }).notNull().default(0),
}, (t) => [primaryKey({ columns: [t.userId, t.lessonId] })]);

export const learnerGrammar = pgTable("learner_grammar", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conceptId: text("concept_id").notNull(),
  exposedAt: bigint("exposed_at", { mode: "number" }),
  mastered: text("mastered").notNull().default("false"),
}, (t) => [primaryKey({ columns: [t.userId, t.conceptId] })]);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lessonId: text("lesson_id"),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  messages: jsonb("messages").notNull().default([]),
});

export const attempts = pgTable("attempts", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ts: bigint("ts", { mode: "number" }).notNull(),
  kind: text("kind").notNull(),
  prompt: text("prompt").notNull(),
  learnerAnswer: text("learner_answer").notNull(),
  expected: text("expected").notNull(),
  correct: text("correct").notNull(),
  wordIds: jsonb("word_ids").notNull().default([]),
});

export const learningSessions = pgTable("learning_sessions", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ts: bigint("ts", { mode: "number" }).notNull(),
  durationMin: bigint("duration_min", { mode: "number" }).notNull(),
  wordsReviewed: bigint("words_reviewed", { mode: "number" }).notNull(),
  newWords: bigint("new_words", { mode: "number" }).notNull(),
  recallRate: text("recall_rate").notNull(),
});
```

Note: booleans/numbers that can be `"partial"` or floats are stored as `text`/`bigint` with explicit conversion in the repo layer; `jsonb` columns are stringified/parsed explicitly in the repo layer so tests work identically in `pg-mem`.

- [ ] **Step 6: Write `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
```

> This file must NOT import from `@/lib/config` — `config.ts` is `server-only`, which throws outside a React server context, breaking `drizzle-kit`. `DATABASE_URL` is read directly from the process env. `drizzle-kit generate` runs offline (no DB needed) but requires `DATABASE_URL` set (any value) so the config parses.

- [ ] **Step 7: Write `src/lib/db/index.ts`**

```ts
import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";
import { loadConfig } from "@/lib/config";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let db: Db | null = null;
let pool: Pool | null = null;

export function getDb(): Db {
  if (db) return db;
  const cfg = loadConfig();
  pool = new Pool({ connectionString: cfg.databaseUrl, max: 10 });
  db = drizzle(pool, { schema });
  return db;
}

export function getPool(): Pool {
  if (!pool) getDb();
  return pool!;
}

/** Test-only override. */
export function __setDbForTests(next: Db | null): void {
  db = next;
  pool = null;
}
```

- [ ] **Step 8: Write `src/lib/db/migrate.ts` + `src/instrumentation.ts`**

```ts
// src/lib/db/migrate.ts
import "server-only";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "@/lib/db";

export async function runMigrations(): Promise<void> {
  const db = getDb();
  await migrate(db, { migrationsFolder: "./drizzle" });
}
```

```ts
// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { validateConfig } = await import("@/lib/config");
  if (!validateConfig().ok) return; // no DB configured — build/dev without a DB must still work
  const { runMigrations } = await import("@/lib/db/migrate");
  await runMigrations();
}
```

- [ ] **Step 9: Generate the initial migration**

Run (requires `DATABASE_URL` + `JWT_SECRET` in env):
```bash
npx drizzle-kit generate
```
Expected: a `drizzle/0000_*.sql` file + `drizzle/meta/` created. Commit the generated SQL. (If the executor has no DB available, `drizzle-kit generate` still works offline — it diffs schema against the migration history.)

- [ ] **Step 10: Update `.env.example`**

Add to `.env.example`:
```
# --- Production / multi-user ---
DATABASE_URL=postgres://kak:kak@localhost:5432/kak
JWT_SECRET=change-me-to-at-least-32-random-characters
SESSION_TTL_HOURS=8
REMEMBER_TTL_DAYS=30
APP_URL=http://localhost:3000
TRUST_PROXY=false
COOKIE_SECURE=true

# First-boot admin (optional): creates an admin account if none exists
ADMIN_EMAIL=
ADMIN_PASSWORD=

# Optional SMTP — enables password reset / email verification emails
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

- [ ] **Step 11: Run all tests, typecheck, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all pass (build must not require a DB).

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/config.ts src/lib/db src/instrumentation.ts drizzle drizzle.config.ts tests/config.test.ts
git commit -m "feat(db): config validation, Drizzle schema, migrations bootstrap"
```

---

### Task 2: Password + JWT libraries

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/jwt.ts`
- Test: `tests/password.test.ts`, `tests/jwt.test.ts`

**Interfaces:**
- Consumes: `loadConfig()` for `JWT_SECRET`.
- Produces:
  - `MIN_PASSWORD_LENGTH = 8`
  - `hashPassword(plain: string): Promise<string>`
  - `verifyPassword(plain: string, hash: string): Promise<boolean>`
  - `signAccessToken(payload: { userId: string; role: string }): Promise<string>`
  - `verifyAccessToken(token: string): Promise<{ userId: string; role: string }>` (throws `JwtError` on invalid/expired)
  - `ACCESS_TTL_SECONDS = 15 * 60`
  - `generateRefreshToken(): string` (32-byte random hex)

- [ ] **Step 1: Write the failing tests**

`tests/password.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

describe("password", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct-horse-1");
    expect(hash).not.toContain("correct-horse-1");
    expect(await verifyPassword("correct-horse-1", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
  it("produces different hashes for the same password", async () => {
    const a = await hashPassword("same-pass");
    const b = await hashPassword("same-pass");
    expect(a).not.toBe(b);
  });
  it("exposes the minimum length constant", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });
});
```

`tests/jwt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { signAccessToken, verifyAccessToken, JwtError } from "@/lib/auth/jwt";

describe("jwt", () => {
  it("round-trips a payload", async () => {
    const t = await signAccessToken({ userId: "u1", role: "student" });
    const p = await verifyAccessToken(t);
    expect(p.userId).toBe("u1");
    expect(p.role).toBe("student");
  });
  it("rejects a garbage token", async () => {
    await expect(verifyAccessToken("not-a-token")).rejects.toBeInstanceOf(JwtError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/password.test.ts tests/jwt.test.ts`
Expected: FAIL with "Cannot find module '@/lib/auth/password'".

- [ ] **Step 3: Write `src/lib/auth/password.ts`**

```ts
import "server-only";
import bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Write `src/lib/auth/jwt.ts`**

```ts
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { loadConfig } from "@/lib/config";
import { randomBytes } from "crypto";

export const ACCESS_TTL_SECONDS = 15 * 60;

export class JwtError extends Error {}

function secret(): Uint8Array {
  return new TextEncoder().encode(loadConfig().jwtSecret);
}

export async function signAccessToken(payload: { userId: string; role: string }): Promise<string> {
  return new SignJWT({ userId: payload.userId, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<{ userId: string; role: string }> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string" || typeof payload.role !== "string") throw new Error("bad payload");
    return { userId: payload.userId, role: payload.role };
  } catch {
    throw new JwtError("invalid or expired token");
  }
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/password.test.ts tests/jwt.test.ts`
Expected: PASS (set `JWT_SECRET` + `DATABASE_URL` for the test process — see Task 2 note below).

> **Test env note:** `jwt.ts` calls `loadConfig()` which requires `JWT_SECRET`. Add a Vitest setup file `tests/setup.ts`:
> ```ts
> process.env.JWT_SECRET = process.env.JWT_SECRET ?? "a".repeat(48);
> process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://u:p@localhost:5432/kak_test";
> ```
> and register it in `vitest.config.ts`:
> ```ts
> test: { environment: "node", include: ["tests/**/*.test.{ts,tsx}"], setupFiles: ["tests/setup.ts"] },
> ```
> This keeps tests self-contained (no `dotenv`, no `.env.test.local`).

- [ ] **Step 6: Run full suite, typecheck, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/password.ts src/lib/auth/jwt.ts tests/password.test.ts tests/jwt.test.ts vitest.config.ts package.json package-lock.json .gitignore .env.test.local
git commit -m "feat(auth): bcrypt password hashing and JWT signing/verification"
```

---

### Task 3: Rate limiter, session cookie helpers, refresh-token repo

**Files:**
- Create: `src/lib/auth/rateLimit.ts`, `src/lib/auth/session.ts`, `src/lib/repo/authTokens.ts`
- Test: `tests/rateLimit.test.ts`, `tests/session.test.ts`, `tests/repoAuthTokens.test.ts`

**Interfaces:**
- Consumes: `getDb()`/`Db`, `generateRefreshToken()`, `loadConfig()`.
- Produces:
  - `createRateLimiter(opts: { windowMs: number; max: number }): (key: string) => { allowed: boolean; retryAfterMs: number }`
  - `setAuthCookies(res: NextResponse, access: string, refresh: string, maxAgeSeconds: number): void`
  - `clearAuthCookies(res: NextResponse): void`
  - `getRefreshCookie(request: Request): string | null`
  - `hashToken(token: string): string`
  - Repo: `createRefreshTokenRow(db, row)`, `findRefreshTokenRow(db, tokenHash)`, `rotateRefreshTokenRow(db, { id, newHash, newExpiresAt, replacedById? })`, `revokeRefreshTokenRow(db, tokenHash)`, `revokeAllUserTokens(db, userId)`

- [ ] **Step 1: Write the failing tests**

`tests/rateLimit.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createRateLimiter } from "@/lib/auth/rateLimit";

describe("rateLimit", () => {
  it("allows up to max then blocks", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(limiter("a").allowed).toBe(true);
    expect(limiter("a").allowed).toBe(true);
    expect(limiter("a").allowed).toBe(true);
    const blocked = limiter("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });
  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter("x").allowed).toBe(true);
    expect(limiter("y").allowed).toBe(true);
    expect(limiter("x").allowed).toBe(false);
  });
});
```

`tests/session.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { setAuthCookies, clearAuthCookies, getRefreshCookie, hashToken } from "@/lib/auth/session";

describe("session cookies", () => {
  it("sets both cookies with attributes", () => {
    const res = NextResponse.next();
    setAuthCookies(res, "access-token", "refresh-token", 3600);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("kak_access=access-token");
    expect(setCookie).toContain("kak_refresh=refresh-token");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });
  it("clears both cookies", () => {
    const res = NextResponse.next();
    clearAuthCookies(res);
    expect(res.headers.get("set-cookie")).toContain("kak_access=;");
    expect(res.headers.get("set-cookie")).toContain("kak_refresh=;");
  });
  it("reads the refresh cookie from a request", () => {
    const req = new Request("http://x/", { headers: { cookie: "kak_refresh=abc" } });
    expect(getRefreshCookie(req)).toBe("abc");
  });
  it("hashes tokens deterministically", () => {
    const h1 = hashToken("tok123");
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("tok123")).toBe(h1);
    expect(hashToken("tok123")).not.toBe(hashToken("tok124"));
  });
});
```

`tests/repoAuthTokens.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb } from "@/tests/helpers/testDb";
import { createRefreshTokenRow, findRefreshTokenRow, rotateRefreshTokenRow, revokeRefreshTokenRow } from "@/lib/repo/authTokens";

describe("authTokens repo", () => {
  let db: any;
  beforeEach(async () => { db = await createTestDb(); });
  afterEach(async () => { await dropTestDb(db); });

  it("creates, finds, rotates, and revokes tokens", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    await createTestUser(db, id, "a@b.c");
    const row = { id: "22222222-2222-2222-2222-222222222222", userId: id, tokenHash: hashToken("tok"), expiresAt: Date.now() + 1000, createdAt: Date.now() };
    await createRefreshTokenRow(db, row);
    expect(await findRefreshTokenRow(db, hashToken("tok"))).not.toBeNull();

    await rotateRefreshTokenRow(db, row.id, hashToken("tok2"), Date.now() + 1000);
    expect(await findRefreshTokenRow(db, hashToken("tok"))).toBeUndefined();
    expect(await findRefreshTokenRow(db, hashToken("tok2"))).not.toBeUndefined();

    await revokeRefreshTokenRow(db, hashToken("tok2"));
    expect(await findRefreshTokenRow(db, hashToken("tok2"))).toBeUndefined();
  });
});
```

> **Test helper note:** `tests/helpers/testDb.ts` creates an in-memory Postgres via `pg-mem`, runs the Drizzle schema (create tables), and provides `createTestUser`. Implement it in this task:
> ```ts
> import { newDb } from "pg-mem";
> import { drizzle } from "drizzle-orm/node-postgres";
> import * as schema from "@/lib/db/schema";
> // Build a pg-mem adapter pool, create the tables by executing the migration SQL files
> // from ./drizzle (sorted by name), then return drizzle(pool, { schema }).
> // dropTestDb releases the adapter.
> ```
> If a migration file uses a feature `pg-mem` rejects, fall back to generating `CREATE TABLE` from the schema and note the deviation in the commit message.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/rateLimit.test.ts tests/session.test.ts tests/repoAuthTokens.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `src/lib/auth/rateLimit.ts`**

```ts
import "server-only";

interface Bucket { count: number; resetAt: number }

export function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const buckets = new Map<string, Bucket>();
  const sweep = () => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  };
  return (key: string): { allowed: boolean; retryAfterMs: number } => {
    sweep();
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (b.count >= max) return { allowed: false, retryAfterMs: b.resetAt - now };
    b.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  };
}

export function clientIp(request: Request, trustProxy: boolean): string {
  const xff = request.headers.get("x-forwarded-for");
  if (trustProxy && xff) return xff.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}
```

- [ ] **Step 4: Write `src/lib/auth/session.ts`**

```ts
import "server-only";
import { createHash } from "crypto";
import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "kak_access";
export const REFRESH_COOKIE = "kak_refresh";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function baseAttrs(secure: boolean): string {
  return `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function setAuthCookies(res: NextResponse, access: string, refresh: string, maxAgeSeconds: number, secure: boolean): void {
  res.headers.append("set-cookie", `${ACCESS_COOKIE}=${access}; ${baseAttrs(secure)}; Max-Age=${15 * 60}`);
  res.headers.append("set-cookie", `${REFRESH_COOKIE}=${refresh}; ${baseAttrs(secure)}; Max-Age=${maxAgeSeconds}`);
}

export function clearAuthCookies(res: NextResponse, secure: boolean): void {
  const attrs = baseAttrs(secure);
  res.headers.append("set-cookie", `${ACCESS_COOKIE}=; ${attrs}; Max-Age=0`);
  res.headers.append("set-cookie", `${REFRESH_COOKIE}=; ${attrs}; Max-Age=0`);
}

export function getRefreshCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === REFRESH_COOKIE && v) return v;
  }
  return null;
}
```

- [ ] **Step 5: Write `src/lib/repo/authTokens.ts`**

```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { refreshTokens } from "@/lib/db/schema";
import type { Db } from "@/lib/db";

export interface RefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: number;
  replacedById?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  createdAt: number;
}

export async function createRefreshTokenRow(db: Db, row: RefreshTokenRow): Promise<void> {
  await db.insert(refreshTokens).values({ ...row, replacedById: row.replacedById ?? null, userAgent: row.userAgent ?? null, ip: row.ip ?? null });
}

export async function findRefreshTokenRow(db: Db, tokenHash: string): Promise<RefreshTokenRow | undefined> {
  const rows = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);
  return rows[0] as RefreshTokenRow | undefined;
}

export async function rotateRefreshTokenRow(db: Db, id: string, newHash: string, newExpiresAt: number): Promise<void> {
  await db.update(refreshTokens).set({ tokenHash: newHash, expiresAt: newExpiresAt }).where(eq(refreshTokens.id, id));
}

export async function revokeRefreshTokenRow(db: Db, tokenHash: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function revokeAllUserTokens(db: Db, userId: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/rateLimit.test.ts tests/session.test.ts tests/repoAuthTokens.test.ts`
Expected: PASS.

- [ ] **Step 7: Run full suite, typecheck, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth/rateLimit.ts src/lib/auth/session.ts src/lib/repo/authTokens.ts tests/rateLimit.test.ts tests/session.test.ts tests/repoAuthTokens.test.ts tests/helpers
git commit -m "feat(auth): rate limiter, session cookies, refresh token persistence"
```

---

### Task 4: Users repo + requireUser/requireAdmin

**Files:**
- Create: `src/lib/repo/users.ts`, `src/lib/auth/requireUser.ts`
- Test: `tests/repoUsers.test.ts`, `tests/requireUser.test.ts`

**Interfaces:**
- Consumes: `Db`, `hashToken`, `loadConfig` (seed admin).
- Produces:
  - `UserRow { id, email, name, passwordHash, role, emailVerifiedAt, disabledAt, createdAt, updatedAt }`
  - `createUser(db, { email, name, passwordHash, role?, id? })`, `findUserByEmail(db, email)`, `findUserById(db, id)`, `updateUserPassword(db, id, hash)`, `setUserDisabled(db, id, disabledAt: number | null)`, `listUsers(db)`, `countUsers(db)`
  - `seedAdminIfNeeded(db): Promise<void>`
  - `AuthUser { id, email, name, role, disabledAt }`
  - `class HttpError extends Error { status: number }`
  - `requireUser(request: Request): Promise<AuthUser>` (throws `HttpError(401)` when unauthenticated/disabled)
  - `requireAdmin(request: Request): Promise<AuthUser>` (throws `HttpError(403)` when not admin)

- [ ] **Step 1: Write the failing tests**

`tests/repoUsers.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb } from "@/tests/helpers/testDb";
import { createUser, findUserByEmail, findUserById, updateUserPassword, setUserDisabled, listUsers } from "@/lib/repo/users";

describe("users repo", () => {
  let db: any;
  beforeEach(async () => { db = await createTestDb(); });
  afterEach(async () => { await dropTestDb(db); });

  it("creates and finds users by email (lowercased) and id", async () => {
    const u = await createUser(db, { email: "Foo@Example.com", name: "Foo", passwordHash: "h" });
    expect((await findUserByEmail(db, "foo@example.com"))!.id).toBe(u.id);
    expect((await findUserById(db, u.id))!.name).toBe("Foo");
    expect(await findUserByEmail(db, "missing@x.com")).toBeUndefined();
  });
  it("updates password and disables", async () => {
    const u = await createUser(db, { email: "a@b.c", name: "A", passwordHash: "h1" });
    await updateUserPassword(db, u.id, "h2");
    expect((await findUserById(db, u.id))!.passwordHash).toBe("h2");
    await setUserDisabled(db, u.id, 123);
    expect((await findUserById(db, u.id))!.disabledAt).toBe(123);
    await setUserDisabled(db, u.id, null);
    expect((await findUserById(db, u.id))!.disabledAt).toBeNull();
  });
  it("lists users and rejects duplicate emails", async () => {
    await createUser(db, { email: "a@b.c", name: "A", passwordHash: "h" });
    await expect(createUser(db, { email: "A@B.C", name: "B", passwordHash: "h" })).rejects.toThrow();
    expect((await listUsers(db)).length).toBe(1);
  });
});
```

`tests/requireUser.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb } from "@/tests/helpers/testDb";
import { createUser } from "@/lib/repo/users";
import { requireUser, requireAdmin, HttpError } from "@/lib/auth/requireUser";

describe("requireUser", () => {
  let db: any;
  beforeEach(async () => { db = await createTestDb(); });
  afterEach(async () => { await dropTestDb(db); });

  const req = (userId?: string) => new Request("http://x/", { headers: userId ? { "x-user-id": userId } : {} });

  it("rejects requests without an identity header", async () => {
    await expect(requireUser(req())).rejects.toMatchObject({ status: 401 });
  });
  it("rejects unknown users", async () => {
    await expect(requireUser(req("99999999-9999-9999-9999-999999999999"))).rejects.toMatchObject({ status: 401 });
  });
  it("accepts a valid active user and rejects disabled users", async () => {
    const u = await createUser(db, { email: "a@b.c", name: "A", passwordHash: "h" });
    expect((await requireUser(req(u.id))).id).toBe(u.id);
    await setUserDisabled(db, u.id, Date.now());
    await expect(requireUser(req(u.id))).rejects.toMatchObject({ status: 401 });
  });
  it("enforces admin role", async () => {
    const s = await createUser(db, { email: "s@b.c", name: "S", passwordHash: "h" });
    const a = await createUser(db, { email: "ad@b.c", name: "Ad", passwordHash: "h", role: "admin" });
    await expect(requireAdmin(req(s.id))).rejects.toMatchObject({ status: 403 });
    expect((await requireAdmin(req(a.id))).role).toBe("admin");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/repoUsers.test.ts tests/requireUser.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `src/lib/repo/users.ts`**

```ts
import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { users } from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { loadConfig } from "@/lib/config";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: "student" | "admin";
  emailVerifiedAt: number | null;
  disabledAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export async function createUser(db: Db, input: { email: string; name: string; passwordHash: string; role?: "student" | "admin"; id?: string }): Promise<UserRow> {
  const now = Date.now();
  const row = {
    id: input.id ?? randomUUID(),
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash: input.passwordHash,
    role: input.role ?? "student",
    emailVerifiedAt: null,
    disabledAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(users).values(row);
  return row;
}

export async function findUserByEmail(db: Db, email: string): Promise<UserRow | undefined> {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return rows[0] as UserRow | undefined;
}

export async function findUserById(db: Db, id: string): Promise<UserRow | undefined> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] as UserRow | undefined;
}

export async function updateUserPassword(db: Db, id: string, hash: string): Promise<void> {
  await db.update(users).set({ passwordHash: hash, updatedAt: Date.now() }).where(eq(users.id, id));
}

export async function setUserDisabled(db: Db, id: string, disabledAt: number | null): Promise<void> {
  await db.update(users).set({ disabledAt, updatedAt: Date.now() }).where(eq(users.id, id));
}

export async function listUsers(db: Db): Promise<UserRow[]> {
  return (await db.select().from(users).orderBy(desc(users.createdAt))) as UserRow[];
}

export async function countUsers(db: Db): Promise<number> {
  const rows = await db.select({ count: sql`count(*)` }).from(users);
  return Number(rows[0]?.count ?? 0);
}

export async function seedAdminIfNeeded(db: Db): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.adminEmail || !cfg.adminPassword) return;
  const existing = await findUserByEmail(db, cfg.adminEmail);
  if (existing) return;
  const { hashPassword } = await import("@/lib/auth/password");
  await createUser(db, { email: cfg.adminEmail, name: "Admin", passwordHash: await hashPassword(cfg.adminPassword), role: "admin" });
}
```

- [ ] **Step 4: Write `src/lib/auth/requireUser.ts`**

```ts
import "server-only";
import { findUserById } from "@/lib/repo/users";
import { getDb } from "@/lib/db";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "student" | "admin";
  disabledAt: number | null;
}

export async function requireUser(request: Request): Promise<AuthUser> {
  const id = request.headers.get("x-user-id");
  if (!id) throw new HttpError(401, "Not authenticated");
  const row = await findUserById(getDb(), id);
  if (!row || row.disabledAt) throw new HttpError(401, "Not authenticated");
  return { id: row.id, email: row.email, name: row.name, role: row.role, disabledAt: row.disabledAt };
}

export async function requireAdmin(request: Request): Promise<AuthUser> {
  const user = await requireUser(request);
  if (user.role !== "admin") throw new HttpError(403, "Admin role required");
  return user;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/repoUsers.test.ts tests/requireUser.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full suite, typecheck, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/repo/users.ts src/lib/auth/requireUser.ts tests/repoUsers.test.ts tests/requireUser.test.ts
git commit -m "feat(auth): user repo, admin seeding, request authorization guards"
```

---

### Task 5: Zod schemas + auth service + auth API routes + middleware

**Files:**
- Create: `src/lib/validation/schemas.ts`, `src/lib/services/authService.ts`, `src/middleware.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/auth/refresh/route.ts`, `src/app/api/auth/me/route.ts`, `src/app/api/auth/change-password/route.ts`
- Test: `tests/api/auth.test.ts`, `tests/middleware.test.ts`

**Interfaces:**
- Consumes: all of Tasks 1–4.
- Produces:
  - `PublicUser { id, email, name, role, createdAt, disabledAt }`
  - `AuthSession { accessToken: string; refreshToken: string; user: PublicUser; refreshMaxAgeSeconds: number }`
  - `register(db, { email, name, password })`, `login(db, { email, password, remember })`, `refreshSession(db, refreshToken, { ip?, ua? })`, `revokeSession(db, refreshToken)`, `changePassword(db, userId, current, next)`, `renameUser(db, userId, name)`, `getPublicUser(db, userId)`
  - Middleware: verifies access JWT for protected `/api/*`, sets `x-user-id`/`x-user-role` headers, enforces `x-kak-request: 1` or matching Origin on non-GET, enforces rate limit on auth routes.

- [ ] **Step 1: Write the failing tests**

`tests/api/auth.test.ts` (integration through the service layer with `pg-mem`):
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb } from "@/tests/helpers/testDb";
import { register, login, refreshSession, revokeSession, changePassword, getPublicUser } from "@/lib/services/authService";

describe("authService", () => {
  let db: any;
  beforeEach(async () => { db = await createTestDb(); });
  afterEach(async () => { await dropTestDb(db); });

  it("registers and logs in", async () => {
    const s = await register(db, { email: "A@B.c", name: "Ana", password: "password123" });
    expect(s.user.email).toBe("a@b.c");
    expect(s.user.role).toBe("student");
    const s2 = await login(db, { email: "a@b.c", password: "password123", remember: true });
    expect(s2.user.id).toBe(s.user.id);
    expect(s2.refreshMaxAgeSeconds).toBeGreaterThan(7 * 24 * 3600); // remember
  });
  it("rejects wrong password and unknown email", async () => {
    await register(db, { email: "a@b.c", name: "A", password: "password123" });
    await expect(login(db, { email: "a@b.c", password: "nope", remember: false })).rejects.toMatchObject({ status: 401 });
    await expect(login(db, { email: "z@b.c", password: "password123", remember: false })).rejects.toMatchObject({ status: 401 });
  });
  it("rotates refresh tokens and rejects reused tokens", async () => {
    const s = await register(db, { email: "a@b.c", name: "A", password: "password123" });
    const s2 = await refreshSession(db, s.refreshToken, {});
    expect(s2.accessToken).not.toBe(s.accessToken);
    expect(s2.refreshToken).not.toBe(s.refreshToken);
    await expect(refreshSession(db, s.refreshToken, {})).rejects.toMatchObject({ status: 401 });
  });
  it("rejects an expired refresh token", async () => {
    const s = await register(db, { email: "a@b.c", name: "A", password: "password123" });
    // force-expire by updating the row in the DB
    const { refreshTokens } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(refreshTokens).set({ expiresAt: Date.now() - 1000 }).where(eq(refreshTokens.userId, s.user.id));
    await expect(refreshSession(db, s.refreshToken, {})).rejects.toMatchObject({ status: 401 });
  });
  it("changes password and logs out", async () => {
    const s = await register(db, { email: "a@b.c", name: "A", password: "password123" });
    await changePassword(db, s.user.id, "password123", "new-password-1");
    await expect(login(db, { email: "a@b.c", password: "password123", remember: false })).rejects.toMatchObject({ status: 401 });
    await revokeSession(db, s.refreshToken);
    await expect(refreshSession(db, s.refreshToken, {})).rejects.toMatchObject({ status: 401 });
  });
  it("rejects a disabled user at login", async () => {
    const s = await register(db, { email: "a@b.c", name: "A", password: "password123" });
    const { setUserDisabled } = await import("@/lib/repo/users");
    await setUserDisabled(db, s.user.id, Date.now());
    await expect(login(db, { email: "a@b.c", password: "password123", remember: false })).rejects.toMatchObject({ status: 401 });
  });
  it("validates input via zod", async () => {
    await expect(register(db, { email: "not-an-email", name: "A", password: "password123" })).rejects.toMatchObject({ status: 400 });
    await expect(register(db, { email: "a@b.c", name: "A", password: "short" })).rejects.toMatchObject({ status: 400 });
  });
});
```

`tests/middleware.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { signAccessToken } from "@/lib/auth/jwt";
import { shouldGate } from "@/lib/middlewareLogic";

describe("middleware logic", () => {
  it("does not gate public auth endpoints", () => {
    expect(shouldGate("/api/auth/login")).toBe(false);
    expect(shouldGate("/api/auth/refresh")).toBe(false);
    expect(shouldGate("/api/tutor")).toBe(true);
    expect(shouldGate("/api/state")).toBe(true);
  });
  it("checks CSRF header on non-GET", async () => {
    const req = new Request("http://x/api/state", { method: "POST", headers: {} });
    expect(await isSafeMutation(req)).toBe(false);
    const ok = new Request("http://x/api/state", { method: "POST", headers: { "x-kak-request": "1" } });
    expect(await isSafeMutation(ok)).toBe(true);
  });
});
```

> To keep the middleware testable without Edge runtime, put the pure logic in `src/lib/middlewareLogic.ts` and import it from `src/middleware.ts`. Add the two functions:
> - `shouldGate(pathname: string): boolean` — false for `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`, `/api/health`; true for every other `/api/*` path.
> - `isSafeMutation(request: Request): boolean` — true when method is GET/HEAD/OPTIONS, or header `x-kak-request: 1` present, or an `Origin` header whose host matches `APP_URL` host.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/api/auth.test.ts tests/middleware.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `src/lib/validation/schemas.ts`**

```ts
import "server-only";
import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

export const emailSchema = z.string().email().max(254);
export const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(128);
export const nameSchema = z.string().trim().min(1).max(80);

export const registerSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  remember: z.boolean().default(false),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const renameSchema = z.object({ name: nameSchema });
```

- [ ] **Step 4: Write `src/lib/services/authService.ts`**

```ts
import "server-only";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { refreshTokens } from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { HttpError } from "@/lib/auth/requireUser";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signAccessToken, generateRefreshToken } from "@/lib/auth/jwt";
import { hashToken } from "@/lib/auth/session";
import { loadConfig } from "@/lib/config";
import { createUser, findUserByEmail, findUserById, updateUserPassword } from "@/lib/repo/users";
import { createRefreshTokenRow, findRefreshTokenRow, rotateRefreshTokenRow, revokeRefreshTokenRow, revokeAllUserTokens } from "@/lib/repo/authTokens";

export interface PublicUser { id: string; email: string; name: string; role: "student" | "admin"; createdAt: number; disabledAt: number | null; }
export interface AuthSession { accessToken: string; refreshToken: string; user: PublicUser; refreshMaxAgeSeconds: number; }

function toPublic(row: { id: string; email: string; name: string; role: string; createdAt: number; disabledAt: number | null }): PublicUser {
  return { id: row.id, email: row.email, name: row.name, role: row.role === "admin" ? "admin" : "student", createdAt: row.createdAt, disabledAt: row.disabledAt };
}

async function issueSession(db: Db, user: { id: string; email: string; name: string; role: "student" | "admin"; createdAt: number; disabledAt: number | null }, remember: boolean, meta: { ip?: string; ua?: string }): Promise<AuthSession> {
  const cfg = loadConfig();
  const refreshToken = generateRefreshToken();
  const refreshTtlSeconds = (remember ? cfg.rememberTtlDays : cfg.sessionTtlHours / 24) * 86400;
  await createRefreshTokenRow(db, {
    id: randomUUID(),
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: Date.now() + refreshTtlSeconds * 1000,
    userAgent: meta.ua ?? null,
    ip: meta.ip ?? null,
    createdAt: Date.now(),
  });
  return {
    accessToken: await signAccessToken({ userId: user.id, role: user.role }),
    refreshToken,
    user: toPublic(user),
    refreshMaxAgeSeconds: refreshTtlSeconds,
  };
}

export async function register(db: Db, input: { email: string; name: string; password: string }): Promise<AuthSession> {
  const parsed = registerSchema.parse(input);
  if (await findUserByEmail(db, parsed.email)) throw new HttpError(409, "Email already registered");
  const user = await createUser(db, { email: parsed.email, name: parsed.name, passwordHash: await hashPassword(parsed.password) });
  await createProfileIfMissing(db, user.id);
  return issueSession(db, user, false, {});
}

export async function login(db: Db, input: { email: string; password: string; remember: boolean }): Promise<AuthSession> {
  const parsed = loginSchema.parse(input);
  const user = await findUserByEmail(db, parsed.email);
  if (!user || user.disabledAt) throw new HttpError(401, "Invalid email or password");
  const ok = await verifyPassword(parsed.password, user.passwordHash);
  if (!ok) throw new HttpError(401, "Invalid email or password");
  return issueSession(db, user, parsed.remember, {});
}

export async function refreshSession(db: Db, refreshToken: string, meta: { ip?: string; ua?: string }): Promise<AuthSession> {
  if (!refreshToken) throw new HttpError(401, "Missing refresh token");
  const row = await findRefreshTokenRow(db, hashToken(refreshToken));
  if (!row) throw new HttpError(401, "Invalid refresh token");
  if (row.expiresAt < Date.now()) throw new HttpError(401, "Refresh token expired");
  const user = await findUserById(db, row.userId);
  if (!user || user.disabledAt) throw new HttpError(401, "Invalid refresh token");
  const cfg = loadConfig();
  const next = generateRefreshToken();
  await rotateRefreshTokenRow(db, row.id, hashToken(next), Date.now() + cfg.sessionTtlHours * 3600 * 1000);
  return {
    accessToken: await signAccessToken({ userId: user.id, role: user.role }),
    refreshToken: next,
    user: toPublic(user),
    refreshMaxAgeSeconds: cfg.sessionTtlHours * 3600,
  };
}

export async function revokeSession(db: Db, refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  await revokeRefreshTokenRow(db, hashToken(refreshToken));
}

export async function changePassword(db: Db, userId: string, current: string, next: string): Promise<void> {
  const parsed = changePasswordSchema.parse({ currentPassword: current, newPassword: next });
  const user = await findUserById(db, userId);
  if (!user) throw new HttpError(401, "Not authenticated");
  const ok = await verifyPassword(parsed.currentPassword, user.passwordHash);
  if (!ok) throw new HttpError(400, "Current password is incorrect");
  await updateUserPassword(db, userId, await hashPassword(parsed.newPassword));
  await revokeAllUserTokens(db, userId);
}

export async function renameUser(db: Db, userId: string, name: string): Promise<PublicUser> {
  const { nameSchema } = await import("@/lib/validation/schemas");
  const parsed = nameSchema.parse(name);
  const { users } = await import("@/lib/db/schema");
  await db.update(users).set({ name: parsed, updatedAt: Date.now() }).where(eq(users.id, userId));
  const row = await findUserById(db, userId);
  if (!row) throw new HttpError(401, "Not authenticated");
  return toPublic(row);
}

export async function getPublicUser(db: Db, userId: string): Promise<PublicUser> {
  const row = await findUserById(db, userId);
  if (!row) throw new HttpError(401, "Not authenticated");
  return toPublic(row);
}
```

> Note: `createProfileIfMissing` and `createProfileRow` are defined in Task 6's repo; export a `createProfileIfMissing(db, userId)` from `src/lib/repo/learner.ts` and import it here. If Task 6 is not yet done when you run tests, temporarily inline a minimal `insert profiles (userId)` in `register`.

- [ ] **Step 5: Write `src/lib/middlewareLogic.ts` and `src/middleware.ts`**

```ts
// src/lib/middlewareLogic.ts
import "server-only";
import { loadConfig } from "@/lib/config";

const PUBLIC_AUTH = new Set(["/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/health"]);

export function shouldGate(pathname: string): boolean {
  if (!pathname.startsWith("/api")) return false;
  return !PUBLIC_AUTH.has(pathname);
}

export function isSafeMutation(request: Request): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  if (request.headers.get("x-kak-request") === "1") return true;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === new URL(loadConfig().appUrl).host;
    } catch {
      return false;
    }
  }
  return false;
}
```

```ts
// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken, JwtError } from "@/lib/auth/jwt";
import { shouldGate, isSafeMutation } from "@/lib/middlewareLogic";
import { clientIp } from "@/lib/auth/rateLimit";
import { createRateLimiter } from "@/lib/auth/rateLimit";
import { loadConfig } from "@/lib/config";

const authLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/register")) {
    const ip = clientIp(request, loadConfig().trustProxy);
    const r = authLimiter(ip);
    if (!r.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "retry-after": String(Math.ceil(r.retryAfterMs / 1000)) } });
    }
  }

  if (!isSafeMutation(request)) {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  if (!shouldGate(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("kak_access")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const payload = await verifyAccessToken(token);
    const res = NextResponse.next();
    res.headers.set("x-user-id", payload.userId);
    res.headers.set("x-user-role", payload.role);
    return res;
  } catch (e) {
    if (e instanceof JwtError) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    throw e;
  }
}

export const config = { matcher: ["/api/:path*"] };
```

- [ ] **Step 6: Write the auth API route handlers**

`src/app/api/auth/register/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { register } from "@/lib/services/authService";
import { setAuthCookies } from "@/lib/auth/session";
import { loadConfig } from "@/lib/config";
import { HttpError } from "@/lib/auth/requireUser";
import { registerSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.parse(body);
    const session = await register(getDb(), parsed);
    const cfg = loadConfig();
    const res = NextResponse.json({ user: session.user });
    setAuthCookies(res, session.accessToken, session.refreshToken, session.refreshMaxAgeSeconds, cfg.cookieSecure);
    return res;
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
```

`src/app/api/auth/login/route.ts` — mirror of register but calls `login(getDb(), parsed)` and body from `loginSchema`.
`src/app/api/auth/logout/route.ts` — reads refresh cookie, calls `revokeSession`, returns `clearAuthCookies` response.
`src/app/api/auth/refresh/route.ts` — reads refresh cookie, calls `refreshSession`, sets fresh cookies.
`src/app/api/auth/me/route.ts` — `GET` returns `getPublicUser(getDb(), (await requireUser(request)).id)`; `PATCH` calls `renameUser`.
`src/app/api/auth/change-password/route.ts` — `POST` with `requireUser`, body from `changePasswordSchema`.

> All handlers use the same `try/catch` shape above and `requireUser` from `@/lib/auth/requireUser`. Duplicate the pattern (per plan rule: repeat code rather than reference "similar to").

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/api/auth.test.ts tests/middleware.test.ts`
Expected: PASS.

- [ ] **Step 8: Run full suite, typecheck, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/validation/schemas.ts src/lib/services/authService.ts src/lib/middlewareLogic.ts src/middleware.ts src/app/api/auth tests/api/auth.test.ts tests/middleware.test.ts
git commit -m "feat(auth): register, login, logout, refresh, me, change-password endpoints + middleware"
```

---

### Task 6: Learner repo (state load/persist) + learner service

**Files:**
- Create: `src/lib/repo/learner.ts`, `src/lib/services/learnerService.ts`
- Test: `tests/repoLearner.test.ts`, `tests/serviceLearner.test.ts`

**Interfaces:**
- Consumes: `Db`, `getDb()`, `scheduler` (`src/lib/srs/scheduler.ts`), `WORD_BANK`, `emptyWord` shape, existing types (`LearnerState`, `VocabularyWord`, `LessonProgress`, `GrammarConcept`, `Conversation`, `PracticeAttempt`, `LearningSession`, `LearningProfile`).
- Produces:
  - `createProfileIfMissing(db, userId)`, `getProfileRow(db, userId)`
  - `loadLearnerState(db, userId): Promise<LearnerState>`
  - `resetLearnerState(db, userId): Promise<void>`
  - `saveProfileRow(db, userId, profile)`, `upsertWordRow(db, userId, word)`, `upsertLessonRow`, `upsertGrammarRow`, `appendAttemptRow`, `appendSessionRow`, `upsertConversationRow`
  - `applyWordResult(db, userId, wordId, result): Promise<VocabularyWord>`
  - `touchWordRow(db, userId, wordId): Promise<VocabularyWord>`
  - `setLessonProgress(db, userId, lessonId, status)`, `appendAttempt(db, userId, a)`, `appendSession(db, userId, s)`, `upsertConversation(db, userId, c)`, `updateProfile(db, userId, partial)`, `buildTutorContext(db, userId)`

- [ ] **Step 1: Write the failing tests**

`tests/repoLearner.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb, createTestUser } from "@/tests/helpers/testDb";
import { loadLearnerState, upsertWordRow, upsertLessonRow, appendAttemptRow, appendSessionRow, upsertConversationRow, resetLearnerState, createProfileIfMissing } from "@/lib/repo/learner";
import type { VocabularyWord, PracticeAttempt, LearningSession, Conversation } from "@/lib/types";

describe("learner repo", () => {
  let db: any; let uid: string;
  beforeEach(async () => { db = await createTestDb(); uid = await createTestUser(db, undefined, "l@b.c"); });
  afterEach(async () => { await dropTestDb(db); });

  it("loads an empty state for a fresh user", async () => {
    await createProfileIfMissing(db, uid);
    const s = await loadLearnerState(db, uid);
    expect(s.words).toEqual({});
    expect(s.lessons).toEqual({});
    expect(s.attempts).toEqual([]);
    expect(s.profile).toBeTruthy();
  });
  it("round-trips words, lessons, attempts, sessions, conversations", async () => {
    const word: VocabularyWord = { id: "w1", indonesian: "makan", english: "eat", pronunciation: "mah-kahn", example: "", exampleTranslation: "", category: "verb", frequency: 1, level: 1, familiarity: 0, exposures: 1, correct: 1, mistakes: 0, lastReviewed: 1, nextReview: 2, streak: 1 };
    await upsertWordRow(db, uid, word);
    const a: PracticeAttempt = { id: "a1", ts: 1, kind: "lesson", prompt: "p", learnerAnswer: "x", expected: "makan", correct: true, wordIds: ["w1"] };
    await appendAttemptRow(db, uid, a);
    const sess: LearningSession = { id: "s1", ts: 1, durationMin: 5, wordsReviewed: 3, newWords: 2, recallRate: 1 };
    await appendSessionRow(db, uid, sess);
    const conv: Conversation = { id: "c1", startedAt: 1, messages: [{ id: "m1", kind: "learner", content: "halo", timestamp: 1 }] };
    await upsertConversationRow(db, uid, conv);
    const state = await loadLearnerState(db, uid);
    expect(state.words["w1"].streak).toBe(1);
    expect(state.attempts).toHaveLength(1);
    expect(state.sessions).toHaveLength(1);
    expect(state.conversations[0].messages[0].content).toBe("halo");
  });
  it("resets all user data", async () => {
    await createProfileIfMissing(db, uid);
    await upsertWordRow(db, uid, { id: "w1", indonesian: "x", english: "y", pronunciation: "", example: "", exampleTranslation: "", category: "", frequency: 1, level: 1, familiarity: 0, exposures: 1, correct: 0, mistakes: 0, lastReviewed: null, nextReview: null, streak: 0 });
    await resetLearnerState(db, uid);
    const s = await loadLearnerState(db, uid);
    expect(s.words).toEqual({});
  });
});
```

`tests/serviceLearner.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb, createTestUser } from "@/tests/helpers/testDb";
import { applyWordResult, touchWordRow, setLessonProgress, updateProfile } from "@/lib/services/learnerService";

describe("learnerService", () => {
  let db: any; let uid: string;
  beforeEach(async () => { db = await createTestDb(); uid = await createTestUser(db, undefined, "l@b.c"); });
  afterEach(async () => { await dropTestDb(db); });

  it("applies an SRS result and returns the word", async () => {
    const w = await applyWordResult(db, uid, "halo", "correct");
    expect(w.id).toBe("halo");
    expect(w.streak).toBe(1);
    expect(w.nextReview).not.toBeNull();
  });
  it("touch records an exposure", async () => {
    const w = await touchWordRow(db, uid, "hai");
    expect(w.exposures).toBe(1);
    const w2 = await touchWordRow(db, uid, "hai");
    expect(w2.exposures).toBe(2);
  });
  it("sets lesson progress", async () => {
    await setLessonProgress(db, uid, "hello", "complete");
    const { loadLearnerState } = await import("@/lib/repo/learner");
    expect((await loadLearnerState(db, uid)).lessons["hello"].status).toBe("complete");
  });
  it("updates profile fields", async () => {
    await updateProfile(db, uid, { aiTutorOn: true, currentDifficulty: 3 });
    const { loadLearnerState } = await import("@/lib/repo/learner");
    const p = (await loadLearnerState(db, uid)).profile;
    expect(p.aiTutorOn).toBe(true);
    expect(p.currentDifficulty).toBe(3);
  });
});
```

> Real word ids come from `src/lib/data/words.ts` (e.g. `halo`, `hai`, `tidak`); real lesson ids from `src/lib/data/lessons.ts` (e.g. `hello`, `numbers`, `food`). Use real ids in service tests so `loadLearnerState` merges the bank entry.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/repoLearner.test.ts tests/serviceLearner.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `src/lib/repo/learner.ts`**

```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { profiles, learnerWords, learnerLessons, learnerGrammar, conversations, attempts, learningSessions } from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import type { LearnerState, LearningProfile, VocabularyWord, LessonProgress, GrammarConcept, Conversation, PracticeAttempt, LearningSession } from "@/lib/types";
import { createInitialState } from "@/lib/store/localStore";
import { WORD_BANK } from "@/lib/data/words";

const toBool = (s: string | null) => s === "true";
const toNum = (n: number | null) => n ?? 0;

export async function createProfileIfMissing(db: Db, userId: string): Promise<void> {
  const rows = await db.select({ id: profiles.userId }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (rows.length) return;
  await db.insert(profiles).values({ userId });
}

export async function getProfileRow(db: Db, userId: string): Promise<LearningProfile> {
  await createProfileIfMissing(db, userId);
  const rows = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const r = rows[0];
  return {
    level: toNum(r.level) as 0 | 1 | 2 | 3 | 4,
    translationMode: (r.translationMode as LearningProfile["translationMode"]),
    pronunciationOn: toBool(r.pronunciationOn),
    aiTutorOn: toBool(r.aiTutorOn),
    vocabKnowledge: toNum(r.vocabKnowledge),
    grammarKnowledge: toNum(r.grammarKnowledge),
    conversationAbility: toNum(r.conversationAbility),
    readingAbility: toNum(r.readingAbility),
    listeningAbility: toNum(r.listeningAbility),
    recentMistakes: (r.recentMistakes as number[]) ?? [],
    confidence: Number(r.confidence),
    currentDifficulty: toNum(r.currentDifficulty) as LearningProfile["currentDifficulty"],
    lastAnswerAccuracy: Number(r.lastAnswerAccuracy),
    consecutiveCorrect: toNum(r.consecutiveCorrect),
  };
}

export async function saveProfileRow(db: Db, userId: string, p: LearningProfile): Promise<void> {
  await createProfileIfMissing(db, userId);
  await db.update(profiles).set({
    level: p.level, translationMode: p.translationMode, pronunciationOn: String(p.pronunciationOn),
    aiTutorOn: String(p.aiTutorOn), vocabKnowledge: p.vocabKnowledge, grammarKnowledge: p.grammarKnowledge,
    conversationAbility: p.conversationAbility, readingAbility: p.readingAbility, listeningAbility: p.listeningAbility,
    recentMistakes: JSON.parse(JSON.stringify(p.recentMistakes)), confidence: String(p.confidence),
    currentDifficulty: p.currentDifficulty, lastAnswerAccuracy: String(p.lastAnswerAccuracy), consecutiveCorrect: p.consecutiveCorrect,
  }).where(eq(profiles.userId, userId));
}

export async function upsertWordRow(db: Db, userId: string, w: VocabularyWord): Promise<void> {
  await db.insert(learnerWords).values({
    userId, wordId: w.id, familiarity: w.familiarity, exposures: w.exposures, correct: w.correct,
    mistakes: w.mistakes, lastReviewed: w.lastReviewed, nextReview: w.nextReview, streak: w.streak,
  }).onConflictDoUpdate({
    target: [learnerWords.userId, learnerWords.wordId],
    set: { familiarity: w.familiarity, exposures: w.exposures, correct: w.correct, mistakes: w.mistakes, lastReviewed: w.lastReviewed, nextReview: w.nextReview, streak: w.streak },
  });
}

export async function upsertLessonRow(db: Db, userId: string, p: LessonProgress): Promise<void> {
  await db.insert(learnerLessons).values({ userId, lessonId: p.lessonId, status: p.status, completedAt: p.completedAt, attempts: p.attempts })
    .onConflictDoUpdate({ target: [learnerLessons.userId, learnerLessons.lessonId], set: { status: p.status, completedAt: p.completedAt, attempts: p.attempts } });
}

export async function upsertGrammarRow(db: Db, userId: string, g: GrammarConcept): Promise<void> {
  await db.insert(learnerGrammar).values({ userId, conceptId: g.id, exposedAt: g.exposedAt, mastered: String(g.mastered) })
    .onConflictDoUpdate({ target: [learnerGrammar.userId, learnerGrammar.conceptId], set: { exposedAt: g.exposedAt, mastered: String(g.mastered) } });
}

export async function appendAttemptRow(db: Db, userId: string, a: PracticeAttempt): Promise<void> {
  await db.insert(attempts).values({ id: a.id, userId, ts: a.ts, kind: a.kind, prompt: a.prompt, learnerAnswer: a.learnerAnswer, expected: a.expected, correct: String(a.correct), wordIds: JSON.parse(JSON.stringify(a.wordIds)) });
}

export async function appendSessionRow(db: Db, userId: string, s: LearningSession): Promise<void> {
  await db.insert(learningSessions).values({ id: s.id, userId, ts: s.ts, durationMin: s.durationMin, wordsReviewed: s.wordsReviewed, newWords: s.newWords, recallRate: String(s.recallRate) });
}

export async function upsertConversationRow(db: Db, userId: string, c: Conversation): Promise<void> {
  await db.insert(conversations).values({ id: c.id, userId, lessonId: c.lessonId ?? null, startedAt: c.startedAt, messages: JSON.parse(JSON.stringify(c.messages)) })
    .onConflictDoUpdate({ target: [conversations.id], set: { lessonId: c.lessonId ?? null, startedAt: c.startedAt, messages: JSON.parse(JSON.stringify(c.messages)) } });
}

export async function resetLearnerState(db: Db, userId: string): Promise<void> {
  await db.delete(profiles).where(eq(profiles.userId, userId));
  await db.delete(learnerWords).where(eq(learnerWords.userId, userId));
  await db.delete(learnerLessons).where(eq(learnerLessons.userId, userId));
  await db.delete(learnerGrammar).where(eq(learnerGrammar.userId, userId));
  await db.delete(conversations).where(eq(conversations.userId, userId));
  await db.delete(attempts).where(eq(attempts.userId, userId));
  await db.delete(learningSessions).where(eq(learningSessions.userId, userId));
}

export async function loadLearnerState(db: Db, userId: string): Promise<LearnerState> {
  await createProfileIfMissing(db, userId);
  const state = createInitialState("Learner");
  state.profile = await getProfileRow(db, userId);

  const wordRows = await db.select().from(learnerWords).where(eq(learnerWords.userId, userId));
  for (const r of wordRows) {
    const bank = WORD_BANK.find((w) => w.id === r.wordId);
    state.words[r.wordId] = {
      ...(bank ?? { id: r.wordId, indonesian: r.wordId, english: "", pronunciation: "", example: "", exampleTranslation: "", category: "", frequency: 0, level: 0 }),
      familiarity: toNum(r.familiarity), exposures: toNum(r.exposures), correct: toNum(r.correct), mistakes: toNum(r.mistakes),
      lastReviewed: r.lastReviewed, nextReview: r.nextReview, streak: toNum(r.streak),
    };
  }

  const lessonRows = await db.select().from(learnerLessons).where(eq(learnerLessons.userId, userId));
  for (const r of lessonRows) {
    state.lessons[r.lessonId] = { lessonId: r.lessonId, status: (r.status as LessonProgress["status"]), completedAt: r.completedAt, attempts: toNum(r.attempts) };
  }

  const grammarRows = await db.select().from(learnerGrammar).where(eq(learnerGrammar.userId, userId));
  for (const r of grammarRows) {
    state.grammar[r.conceptId] = { id: r.conceptId, name: r.conceptId, description: "", exposedAt: r.exposedAt, mastered: toBool(r.mastered) };
  }

  const convRows = await db.select().from(conversations).where(eq(conversations.userId, userId));
  state.conversations = convRows.map((r) => ({ id: r.id, lessonId: r.lessonId ?? undefined, startedAt: r.startedAt, messages: (r.messages as Conversation["messages"]) ?? [] }));

  const attemptRows = await db.select().from(attempts).where(eq(attempts.userId, userId));
  state.attempts = attemptRows.map((r) => ({ id: r.id, ts: r.ts, kind: r.kind as PracticeAttempt["kind"], prompt: r.prompt, learnerAnswer: r.learnerAnswer, expected: r.expected, correct: r.correct === "partial" ? "partial" : r.correct === "true", wordIds: (r.wordIds as string[]) ?? [] }));

  const sessionRows = await db.select().from(learningSessions).where(eq(learningSessions.userId, userId));
  state.sessions = sessionRows.map((r) => ({ id: r.id, ts: r.ts, durationMin: toNum(r.durationMin), wordsReviewed: toNum(r.wordsReviewed), newWords: toNum(r.newWords), recallRate: Number(r.recallRate) }));

  return state;
}
```

- [ ] **Step 4: Write `src/lib/services/learnerService.ts`**

```ts
import "server-only";
import { randomUUID } from "crypto";
import type { Db } from "@/lib/db";
import { getDb } from "@/lib/db";
import { scheduler } from "@/lib/srs/scheduler";
import { WORD_BANK } from "@/lib/data/words";
import type { LearnerState, LessonProgress, PracticeAttempt, LearningSession, Conversation, LearningProfile, VocabularyWord, LessonStatus } from "@/lib/types";
import { loadLearnerState, upsertWordRow, upsertLessonRow, upsertGrammarRow, appendAttemptRow, appendSessionRow, upsertConversationRow, saveProfileRow, resetLearnerState } from "@/lib/repo/learner";
import type { LearnerContext } from "@/lib/engine/openaiMessages";

export type WordResult = "correct" | "partial" | "wrong";

function emptyWord(id: string): VocabularyWord {
  const bank = WORD_BANK.find((w) => w.id === id);
  return {
    id, indonesian: bank?.indonesian ?? "", english: bank?.english ?? "", pronunciation: bank?.pronunciation ?? "",
    example: bank?.example ?? "", exampleTranslation: bank?.exampleTranslation ?? "", category: bank?.category ?? "",
    image: bank?.image, frequency: bank?.frequency ?? 0, level: bank?.level ?? 0,
    familiarity: 0, exposures: 0, correct: 0, mistakes: 0, lastReviewed: null, nextReview: null, streak: 0,
  };
}

export async function loadState(db: Db, userId: string): Promise<LearnerState> { return loadLearnerState(db, userId); }
export async function resetState(db: Db, userId: string): Promise<void> { await resetLearnerState(db, userId); }

export async function applyWordResult(db: Db, userId: string, wordId: string, result: WordResult): Promise<VocabularyWord> {
  const prev = (await loadLearnerState(db, userId)).words[wordId] ?? emptyWord(wordId);
  const next = scheduler.recordResult(prev, result);
  await upsertWordRow(db, userId, next);
  return next;
}

export async function touchWordRow(db: Db, userId: string, wordId: string): Promise<VocabularyWord> {
  const prev = (await loadLearnerState(db, userId)).words[wordId] ?? emptyWord(wordId);
  const next = { ...prev, lastReviewed: Date.now(), exposures: prev.exposures + 1 };
  await upsertWordRow(db, userId, next);
  return next;
}

export async function setLessonProgress(db: Db, userId: string, lessonId: string, status: LessonStatus): Promise<void> {
  const state = await loadLearnerState(db, userId);
  const prev = state.lessons[lessonId];
  const next: LessonProgress = {
    lessonId,
    status,
    completedAt: status === "complete" ? Date.now() : (prev?.completedAt ?? null),
    attempts: prev ? prev.attempts + 1 : 1,
  };
  await upsertLessonRow(db, userId, next);
}

export async function appendAttempt(db: Db, userId: string, a: PracticeAttempt): Promise<void> {
  await appendAttemptRow(db, userId, { ...a, id: a.id ?? randomUUID() });
}

export async function appendSession(db: Db, userId: string, s: LearningSession): Promise<void> {
  await appendSessionRow(db, userId, { ...s, id: s.id ?? randomUUID() });
}

export async function upsertConversation(db: Db, userId: string, c: Conversation): Promise<void> {
  await upsertConversationRow(db, userId, { ...c, id: c.id ?? randomUUID() });
}

export async function updateProfile(db: Db, userId: string, partial: Partial<LearningProfile>): Promise<void> {
  const current = await loadLearnerState(db, userId);
  const next = { ...current.profile, ...partial };
  await saveProfileRow(db, userId, next);
}

export async function buildTutorContext(db: Db, userId: string): Promise<LearnerContext> {
  const s = await loadLearnerState(db, userId);
  return {
    level: s.profile.level,
    translationMode: s.profile.translationMode,
    knownWords: Object.values(s.words).map((w) => w.indonesian).filter(Boolean).slice(-60),
  };
}
```

> Verify the exact shape of `LearnerContext` in `src/lib/engine/openaiMessages.ts` and match it exactly — adjust field names if the type differs.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/repoLearner.test.ts tests/serviceLearner.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full suite, typecheck, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/repo/learner.ts src/lib/services/learnerService.ts tests/repoLearner.test.ts tests/serviceLearner.test.ts
git commit -m "feat(data): learner state persistence and service layer"
```

---

### Task 7: Learner data API routes

**Files:**
- Create: `src/app/api/state/route.ts`, `src/app/api/words/route.ts`, `src/app/api/words/[wordId]/touch/route.ts`, `src/app/api/lessons/route.ts`, `src/app/api/attempts/route.ts`, `src/app/api/sessions/route.ts`, `src/app/api/conversations/route.ts`, `src/app/api/profile/route.ts`
- Test: `tests/api/learner.test.ts`

**Interfaces:**
- Consumes: `requireUser`, learnerService functions, zod schemas.
- Produces: thin JSON endpoints consumed by the client (Task 8).

- [ ] **Step 1: Write the failing test**

`tests/api/learner.test.ts` (exercises the service layer with `pg-mem`; route handlers are thin, so this verifies the service behavior the routes wrap):
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb, createTestUser } from "@/tests/helpers/testDb";
import { applyWordResult, touchWordRow, setLessonProgress, appendAttempt, appendSession, upsertConversation, updateProfile } from "@/lib/services/learnerService";
import { loadLearnerState } from "@/lib/repo/learner";

describe("learner API behavior", () => {
  let db: any; let uid: string;
  beforeEach(async () => { db = await createTestDb(); uid = await createTestUser(db, undefined, "l@b.c"); });
  afterEach(async () => { await dropTestDb(db); });

  it("persists a full learning session sequence", async () => {
    const w = await applyWordResult(db, uid, "halo", "correct");
    await touchWordRow(db, uid, "hai");
    await setLessonProgress(db, uid, "hello", "complete");
    await appendAttempt(db, uid, { id: "a1", ts: Date.now(), kind: "lesson", prompt: "p", learnerAnswer: "x", expected: "y", correct: true, wordIds: [w.id] });
    await appendSession(db, uid, { id: "s1", ts: Date.now(), durationMin: 3, wordsReviewed: 2, newWords: 2, recallRate: 1 });
    await upsertConversation(db, uid, { id: "c1", startedAt: Date.now(), messages: [{ id: "m1", kind: "tutor", content: "halo", timestamp: Date.now() }] });
    await updateProfile(db, uid, { aiTutorOn: true });

    const s = await loadLearnerState(db, uid);
    expect(Object.keys(s.words).length).toBe(2);
    expect(s.lessons["hello"].status).toBe("complete");
    expect(s.attempts).toHaveLength(1);
    expect(s.sessions).toHaveLength(1);
    expect(s.conversations[0].id).toBe("c1");
    expect(s.profile.aiTutorOn).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/learner.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write the route handlers**

Each handler: parse body with zod, call `requireUser(request)`, call the matching service with `getDb()`, return JSON, catch `HttpError` → `{ error }` + status, other errors → 400.

`src/app/api/state/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { loadState, resetState } from "@/lib/services/learnerService";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const state = await loadState(getDb(), user.id);
    return NextResponse.json(state);
  } catch (e) { if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    await resetState(getDb(), user.id);
    return NextResponse.json({ ok: true });
  } catch (e) { if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
}
```

`src/app/api/words/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { applyWordResult } from "@/lib/services/learnerService";
import { z } from "zod";

const bodySchema = z.object({ wordId: z.string().min(1).max(80), result: z.enum(["correct", "partial", "wrong"]) });

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = bodySchema.parse(await request.json());
    const word = await applyWordResult(getDb(), user.id, body.wordId, body.result);
    return NextResponse.json(word);
  } catch (e) { if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status }); return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
}
```

`src/app/api/words/[wordId]/touch/route.ts` — `POST` → `touchWordRow(getDb(), user.id, params.wordId)`.
`src/app/api/lessons/route.ts` — `POST` body `{ lessonId, status }` with `z.enum(["not_started","in_progress","complete"])` → `setLessonProgress`.
`src/app/api/attempts/route.ts` — `POST` body typed as `PracticeAttempt` (validate `kind` enum, strings non-empty) → `appendAttempt`.
`src/app/api/sessions/route.ts` — `POST` body typed as `LearningSession` (numbers) → `appendSession`.
`src/app/api/conversations/route.ts` — `PUT` body typed as `Conversation` → `upsertConversation`.
`src/app/api/profile/route.ts` — `PATCH` body `Partial<LearningProfile>` (validate known keys, `translationMode` enum, numbers in range) → `updateProfile`.

> The `[wordId]` route needs `params: { wordId: string }` in Next 15 route handler signature (second argument).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/learner.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite, typecheck, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: pass (build static-prerenders pages — the new API routes are dynamic by default).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/state src/app/api/words src/app/api/lessons src/app/api/attempts src/app/api/sessions src/app/api/conversations src/app/api/profile tests/api/learner.test.ts
git commit -m "feat(api): learner data REST endpoints"
```

---

### Task 8: Admin service + routes

**Files:**
- Create: `src/lib/services/adminService.ts`, `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[id]/route.ts`, `src/app/api/admin/users/[id]/reset-password/route.ts`
- Test: `tests/api/admin.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, users repo, `hashPassword`.
- Produces:
  - `listUsers(db): Promise<PublicUser[]>`
  - `setUserDisabled(db, adminId, userId, disabled: boolean): Promise<PublicUser>`
  - `resetUserPassword(db, adminId, userId, newPassword): Promise<void>`
  - Guard rules: cannot disable or reset yourself; cannot demote/destroy the last admin (no role-change endpoint in this build).

- [ ] **Step 1: Write the failing test**

`tests/api/admin.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb } from "@/tests/helpers/testDb";
import { register } from "@/lib/services/authService";
import { listUsers, setUserDisabled, resetUserPassword } from "@/lib/services/adminService";
import { findUserById } from "@/lib/repo/users";

describe("adminService", () => {
  let db: any;
  beforeEach(async () => { db = await createTestDb(); });
  afterEach(async () => { await dropTestDb(db); });

  it("lists users with public fields only", async () => {
    await register(db, { email: "a@b.c", name: "A", password: "password123" });
    await register(db, { email: "b@b.c", name: "B", password: "password123" });
    const users = await listUsers(db);
    expect(users).toHaveLength(2);
    expect(users[0]).not.toHaveProperty("passwordHash");
  });
  it("disables and re-enables a user", async () => {
    const s = await register(db, { email: "a@b.c", name: "A", password: "password123" });
    const admin = await register(db, { email: "ad@b.c", name: "Ad", password: "password123" });
    await setUserDisabled(db, admin.user.id, s.user.id, true);
    expect((await findUserById(db, s.user.id))!.disabledAt).not.toBeNull();
    await setUserDisabled(db, admin.user.id, s.user.id, false);
    expect((await findUserById(db, s.user.id))!.disabledAt).toBeNull();
  });
  it("refuses to disable yourself", async () => {
    const admin = await register(db, { email: "ad@b.c", name: "Ad", password: "password123" });
    await expect(setUserDisabled(db, admin.user.id, admin.user.id, true)).rejects.toMatchObject({ status: 400 });
  });
  it("resets a user password", async () => {
    const s = await register(db, { email: "a@b.c", name: "A", password: "password123" });
    const admin = await register(db, { email: "ad@b.c", name: "Ad", password: "password123" });
    await resetUserPassword(db, admin.user.id, s.user.id, "brand-new-pass-1");
    const { login } = await import("@/lib/services/authService");
    const sess = await login(db, { email: "a@b.c", password: "brand-new-pass-1", remember: false });
    expect(sess.user.id).toBe(s.user.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/admin.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/lib/services/adminService.ts`**

```ts
import "server-only";
import { HttpError } from "@/lib/auth/requireUser";
import type { Db } from "@/lib/db";
import { listUsers, findUserById, setUserDisabled as setDisabled, updateUserPassword } from "@/lib/repo/users";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllUserTokens } from "@/lib/repo/authTokens";
import type { PublicUser } from "@/lib/services/authService";

function toPublic(u: { id: string; email: string; name: string; role: string; createdAt: number; disabledAt: number | null }): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role === "admin" ? "admin" : "student", createdAt: u.createdAt, disabledAt: u.disabledAt };
}

export async function listUsersPublic(db: Db): Promise<PublicUser[]> {
  const rows = await listUsers(db);
  return rows.map(toPublic);
}

export async function setUserDisabled(db: Db, adminId: string, userId: string, disabled: boolean): Promise<PublicUser> {
  if (adminId === userId) throw new HttpError(400, "You cannot disable your own account");
  const target = await findUserById(db, userId);
  if (!target) throw new HttpError(404, "User not found");
  await setDisabled(db, userId, disabled ? Date.now() : null);
  if (disabled) await revokeAllUserTokens(db, userId);
  return toPublic({ ...target, disabledAt: disabled ? Date.now() : null });
}

export async function resetUserPassword(db: Db, adminId: string, userId: string, newPassword: string): Promise<void> {
  if (adminId === userId) throw new HttpError(400, "Use 'change password' for your own account");
  const target = await findUserById(db, userId);
  if (!target) throw new HttpError(404, "User not found");
  if (newPassword.length < 8) throw new HttpError(400, "New password must be at least 8 characters");
  await updateUserPassword(db, userId, await hashPassword(newPassword));
  await revokeAllUserTokens(db, userId);
}
```

- [ ] **Step 4: Write the admin route handlers**

`src/app/api/admin/users/route.ts` — `GET` → `requireAdmin(request)`, return `listUsersPublic(getDb())`.
`src/app/api/admin/users/[id]/route.ts` — `PATCH` body `{ disabled: boolean }` → `setUserDisabled(getDb(), admin.id, params.id, body.disabled)`.
`src/app/api/admin/users/[id]/reset-password/route.ts` — `POST` body `{ newPassword }` → `resetUserPassword(getDb(), admin.id, params.id, body.newPassword)`.

All use the standard try/catch + `HttpError` shape.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/api/admin.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full suite, typecheck, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/adminService.ts src/app/api/admin tests/api/admin.test.ts
git commit -m "feat(admin): user list, enable/disable, password reset API"
```

---

### Task 9: Client API client + server-backed store

**Files:**
- Create: `src/lib/api/client.ts`, `src/lib/api/actions.ts`
- Modify: `src/lib/store/useStore.ts`, `src/lib/store/localStore.ts` (repurpose to `serverStore` or delete), `src/components/Shell.tsx` (hydrate call stays), `src/components/SettingsPage.tsx` (`resetAll` behavior)
- Test: `tests/storeMappings.test.ts` (pure logic), plus existing suite must stay green.

**Interfaces:**
- Consumes: learnerService endpoints (Task 7), `useStore` action signatures (unchanged).
- Produces:
  - `apiFetch(path, { method?, body? }): Promise<any>` — same-origin, `x-kak-request: 1`, auto-refresh-and-retry on 401.
  - `loadStateFromServer()`, `saveWordResult(wordId, result)`, `touchWordOnServer(wordId)`, `saveLessonProgress(lessonId, status)`, `saveAttempt(a)`, `saveSession(s)`, `saveConversation(c)`, `saveProfile(patch)`, `resetStateOnServer()`.
  - `useStore`: `hydrate` becomes async and calls `loadStateFromServer()`; each mutation keeps its synchronous signature, optimistically updates `state`, then fires the server write; `resetAll` calls `resetStateOnServer()` then rehydrates.

- [ ] **Step 1: Write the failing test**

`tests/storeMappings.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mapResult, payloadForWordResult } from "@/lib/store/serverStore";

describe("store server mappings", () => {
  it("maps SRS results to payloads", () => {
    expect(payloadForWordResult("word_1", "correct")).toEqual({ wordId: "word_1", result: "correct" });
  });
  it("maps lesson progress", () => {
    expect(mapLessonPayload("lesson_1", "complete")).toEqual({ lessonId: "lesson_1", status: "complete" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storeMappings.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `src/lib/api/client.ts`**

```ts
"use client";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const res = await fetch(path, {
      method: opts.method ?? "GET",
      headers: {
        ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
        "x-kak-request": "1",
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
    });
    return res;
  };

  let res = await doFetch();
  if (res.status === 401 && (opts.method ?? "GET") !== "GET") {
    const refresh = await fetch("/api/auth/refresh", { method: "POST", headers: { "x-kak-request": "1" }, credentials: "same-origin" });
    if (refresh.ok) res = await doFetch();
  }
  if (res.status === 401 && (opts.method ?? "GET") === "GET") {
    const refresh = await fetch("/api/auth/refresh", { method: "POST", headers: { "x-kak-request": "1" }, credentials: "same-origin" });
    if (refresh.ok) res = await doFetch();
  }
  if (!res.ok) {
    let msg = "Request failed";
    try { const data = await res.json(); if (data && typeof data.error === "string") msg = data.error; } catch { /* ignore */ }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}
```

- [ ] **Step 4: Write `src/lib/api/actions.ts`**

```ts
"use client";
import { apiFetch } from "@/lib/api/client";
import type { LearnerState, VocabularyWord, PracticeAttempt, LearningSession, Conversation, LearningProfile, LessonStatus } from "@/lib/types";

export function loadStateFromServer(): Promise<LearnerState> { return apiFetch<LearnerState>("/api/state"); }
export function resetStateOnServer(): Promise<{ ok: true }> { return apiFetch("/api/state", { method: "DELETE" }); }
export function saveWordResult(wordId: string, result: "correct" | "partial" | "wrong"): Promise<VocabularyWord> {
  return apiFetch<VocabularyWord>("/api/words", { method: "POST", body: { wordId, result } });
}
export function touchWordOnServer(wordId: string): Promise<VocabularyWord> {
  return apiFetch<VocabularyWord>(`/api/words/${encodeURIComponent(wordId)}/touch`, { method: "POST" });
}
export function saveLessonProgress(lessonId: string, status: LessonStatus): Promise<{ ok: true }> {
  return apiFetch("/api/lessons", { method: "POST", body: { lessonId, status } });
}
export function saveAttempt(a: PracticeAttempt): Promise<{ ok: true }> { return apiFetch("/api/attempts", { method: "POST", body: a }); }
export function saveSession(s: LearningSession): Promise<{ ok: true }> { return apiFetch("/api/sessions", { method: "POST", body: s }); }
export function saveConversation(c: Conversation): Promise<{ ok: true }> { return apiFetch("/api/conversations", { method: "PUT", body: c }); }
export function saveProfile(patch: Partial<LearningProfile>): Promise<{ ok: true }> { return apiFetch("/api/profile", { method: "PATCH", body: patch }); }
```

- [ ] **Step 5: Rewrite `useStore` to be server-backed (optimistic)**

Keep the `TutorState` interface and every method name/signature identical to today. Changes:

```ts
// src/lib/store/useStore.ts
import { create } from "zustand";
import type { Conversation, LearningSession, LessonProgress, PracticeAttempt, VocabularyWord } from "@/lib/types";
import { createInitialState } from "@/lib/store/localStore";
import { scheduler } from "@/lib/srs/scheduler";
import { WORD_BANK } from "@/lib/data/words";
import { loadStateFromServer, saveWordResult, touchWordOnServer, saveLessonProgress, saveAttempt, saveSession, saveConversation, saveProfile, resetStateOnServer } from "@/lib/api/actions";

export type WordResult = "correct" | "partial" | "wrong";

interface TutorState {
  state: LearnerState;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setUser: (name: string) => void;
  updateProfile: (partial: Partial<LearnerState["profile"]>) => void;
  recordAttempt: (a: PracticeAttempt) => void;
  saveConversation: (c: Conversation) => void;
  addSession: (s: LearningSession) => void;
  setLessonProgress: (id: string, status: LessonProgress["status"]) => void;
  bumpWord: (id: string, result: WordResult) => void;
  touchWord: (id: string) => void;
  resetAll: () => Promise<void>;
}
```

Implementation notes (full code in the branch):
- `hydrate()`: `const s = await loadStateFromServer(); set({ state: s, hydrated: true });` — throws `ApiError(401)` when unauthenticated; the `Shell` catches it and shows the auth screen.
- `bumpWord(id, result)`: compute `next = scheduler.recordResult(state.words[id] ?? emptyWord(id), result)`; `set({ state: { ...state, profile, words: { ...state.words, [id]: next } } })`; then `void saveWordResult(id, result).then((server) => { if (server.streak !== next.streak) set((s) => ({ state: { ...s.state, words: { ...s.state.words, [id]: server } } })); }).catch(() => {})`.
- `touchWord`, `recordAttempt`, `addSession`, `saveConversation`, `setLessonProgress`, `updateProfile`: identical optimistic `set` + `void actions(...).catch(() => {})`.
- `setUser(name)`: optimistic `set` + `PATCH /api/auth/me`.
- `resetAll()`: `await resetStateOnServer(); await hydrate();`
- Keep `emptyWord` and `createInitialState` imports.

- [ ] **Step 6: Remove `localStore` persistence writes**

`src/lib/store/localStore.ts` keeps `createInitialState` and `loadState`/`localStore` for tests, but `useStore` no longer imports `localStore` for writes. (Keep the file — `createInitialState` is still used by repo tests.)

- [ ] **Step 7: Run the full suite, typecheck, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all pass. Existing `tests/engine.test.ts`, `tests/srs.test.ts`, etc. must stay green. `npm run build` must succeed (the store is client-side; it imports `@/lib/api/actions` which are client modules — no `server-only` modules leak into the client bundle).

- [ ] **Step 8: Commit**

```bash
git add src/lib/api/client.ts src/lib/api/actions.ts src/lib/store/useStore.ts src/lib/store/serverStore.ts tests/storeMappings.test.ts
git commit -m "feat(store): server-backed optimistic store with API client"
```

---

### Task 10: Auth gate UI — useAuth store, AuthPage, Shell gating

**Files:**
- Create: `src/lib/auth/useAuth.ts`, `src/components/AuthPage.tsx`
- Modify: `src/components/Shell.tsx`
- Test: e2e only (covered in Task 13); keep `npx tsc --noEmit` green.

**Interfaces:**
- Consumes: `/api/auth/*` endpoints, `loadStateFromServer` (via `useStore.hydrate`).
- Produces:
  - `useAuth` store: `{ status: "loading" | "guest" | "authed", user: PublicUser | null, init(): Promise<void>, login(email, password, remember): Promise<void>, register(email, name, password): Promise<void>, logout(): Promise<void> }`
  - `AuthPage` component (login/register tabs, remember-me, error display)

- [ ] **Step 1: Write `src/lib/auth/useAuth.ts`**

```ts
"use client";
import { create } from "zustand";
import { apiFetch } from "@/lib/api/client";

export interface PublicUser { id: string; email: string; name: string; role: "student" | "admin"; createdAt: number; disabledAt: number | null; }

interface AuthState {
  status: "loading" | "guest" | "authed";
  user: PublicUser | null;
  init: () => Promise<void>;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  status: "loading",
  user: null,
  init: async () => {
    try {
      const user = await apiFetch<PublicUser>("/api/auth/me");
      set({ status: "authed", user });
    } catch {
      set({ status: "guest", user: null });
    }
  },
  login: async (email, password, remember) => {
    const { user } = await apiFetch<{ user: PublicUser }>("/api/auth/login", { method: "POST", body: { email, password, remember } });
    set({ status: "authed", user });
  },
  register: async (email, name, password) => {
    const { user } = await apiFetch<{ user: PublicUser }>("/api/auth/register", { method: "POST", body: { email, name, password } });
    set({ status: "authed", user });
  },
  logout: async () => {
    try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    set({ status: "guest", user: null });
  },
  refreshUser: async () => {
    const user = await apiFetch<PublicUser>("/api/auth/me");
    set({ user });
  },
}));
```

- [ ] **Step 2: Write `src/components/AuthPage.tsx`**

A centered card in the app's design language ("tropical tutor": `paper`/`canopy`/`marigold`, Plus Jakarta Sans + Fraunces, waveform signature). Two tabs: **Masuk** (login) and **Daftar** (register). Fields:
- Register: name, email, password
- Login: email, password, remember-me checkbox
On submit: call the matching `useAuth` action; on error, show the message inline. Disable the button while pending. Link/logo at top (`Kak`).

- [ ] **Step 3: Rewrite `Shell` to gate on auth**

```tsx
"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useStore } from "@/lib/store/useStore";
import { useAuth } from "@/lib/auth/useAuth";
import { AuthPage } from "@/components/AuthPage";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const status = useAuth((s) => s.status);
  const init = useAuth((s) => s.init);

  useEffect(() => {
    void init().then(() => {
      if (useAuth.getState().status === "authed") void useStore.getState().hydrate();
    });
  }, [init]);

  if (status === "loading") return <div className="flex min-h-screen items-center justify-center text-muted">…</div>;
  if (status === "guest") return <AuthPage />;

  return (
    <div className="min-h-screen md:flex">
      <Sidebar />
      <main className="flex-1">
        <div key={pathname} className="mx-auto w-full max-w-3xl animate-fade-up px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Add a logout button + "Sesi" to the Sidebar**

Modify `src/components/Sidebar.tsx`: add a bottom "Keluar" (logout) action calling `useAuth.logout()`, and a small "Masuk sebagai {name}" line. Add a **Profile** link (`/profile`) and an **Admin** link (`/admin`) shown only when `user.role === "admin"`.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/useAuth.ts src/components/AuthPage.tsx src/components/Shell.tsx src/components/Sidebar.tsx
git commit -m "feat(auth): login/register gate in the app shell"
```

---

### Task 11: Profile page, change password, admin panel

**Files:**
- Create: `src/app/profile/page.tsx`, `src/components/ProfilePage.tsx`, `src/app/admin/page.tsx`, `src/components/AdminPage.tsx`
- Modify: `src/components/SettingsPage.tsx` (account section), `src/components/Sidebar.tsx` (links added in Task 10)
- Test: e2e in Task 13.

- [ ] **Step 1: Write `src/components/ProfilePage.tsx`**

Sections:
- **Account**: email (read-only), role, member since.
- **Ubah nama**: input + save → `PATCH /api/auth/me` via `useAuth.refreshUser()` + `useStore.setUser`.
- **Ubah kata sandi**: current, new, confirm; client-side check new === confirm; `POST /api/auth/change-password`; on success show toast + clear fields.

`src/app/profile/page.tsx` is a thin page rendering `<ProfilePage />` (client component).

- [ ] **Step 2: Write `src/components/AdminPage.tsx`**

- Guard: if `useAuth.user?.role !== "admin"` show a "Akses ditolak" state.
- On mount: `GET /api/admin/users` → table of users (name, email, role, status, created).
- Row actions: **Nonaktifkan/Aktifkan** toggle → `PATCH /api/admin/users/[id]`; **Reset sandi** → modal with new-password input → `POST /api/admin/users/[id]/reset-password`.
- Re-fetch the list after each action. Show errors inline.

`src/app/admin/page.tsx` renders `<AdminPage />`.

- [ ] **Step 3: Add an account section to `SettingsPage`**

Add a "Akun" card linking to `/profile` (name/email/change password) and keep the existing **Reset all data** (now calls `resetAll` → `DELETE /api/state` → rehydrate).

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/profile src/components/ProfilePage.tsx src/app/admin src/components/AdminPage.tsx src/components/SettingsPage.tsx
git commit -m "feat(ui): profile page, change password, admin panel"
```

---

### Task 12: Tutor route — auth + server-built context

**Files:**
- Modify: `src/app/api/tutor/route.ts`, `src/components/ConversationPage.tsx`
- Test: `tests/tutor.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `buildTutorContext`, existing `buildOpenAIMessages`/`parseTutorReply`.
- Produces: `/api/tutor` requires a session; context built server-side; client no longer sends `context`.

- [ ] **Step 1: Write the failing test**

`tests/tutor.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb, createTestUser } from "@/tests/helpers/testDb";
import { buildTutorContext } from "@/lib/services/learnerService";
import { applyWordResult } from "@/lib/services/learnerService";

describe("tutor context", () => {
  let db: any; let uid: string;
  beforeEach(async () => { db = await createTestDb(); uid = await createTestUser(db, undefined, "t@b.c"); });
  afterEach(async () => { await dropTestDb(db); });

  it("builds context from the user's own data", async () => {
    await applyWordResult(db, uid, "halo", "correct");
    const ctx = await buildTutorContext(db, uid);
    expect(typeof ctx.level).toBe("number");
    expect(Array.isArray(ctx.knownWords)).toBe(true);
    expect(typeof ctx.translationMode).toBe("string");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tutor.test.ts`
Expected: FAIL if `buildTutorContext` is missing/incorrect; if it already exists from Task 6, this test passes immediately — that is fine.

- [ ] **Step 3: Update `src/app/api/tutor/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth/requireUser";
import { buildOpenAIMessages, parseTutorReply } from "@/lib/engine/openaiMessages";
import { buildTutorContext } from "@/lib/services/learnerService";
import type { ConversationMessage } from "@/lib/types";

export const runtime = "nodejs";

function getConfig() {
  return {
    apiKey: process.env.OPENCODE_GO_API_KEY ?? "",
    baseUrl: (process.env.OPENCODE_GO_BASE_URL ?? "https://opencode.ai/zen/go/v1").replace(/\/+$/, ""),
    model: process.env.OPENCODE_GO_MODEL ?? "deepseek-v4-flash",
  };
}

export async function GET() {
  return NextResponse.json({ configured: Boolean(getConfig().apiKey) });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const { apiKey, baseUrl, model } = getConfig();
    if (!apiKey) return NextResponse.json({ error: "OPENCODE_GO_API_KEY not configured" }, { status: 501 });

    let body: { messages: ConversationMessage[]; input: string };
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
    if (!Array.isArray(body.messages) || typeof body.input !== "string") {
      return NextResponse.json({ error: "Missing messages or input" }, { status: 400 });
    }

    const context = await buildTutorContext(getDb(), user.id);
    const llmMessages = buildOpenAIMessages({ messages: body.messages, input: body.input, context });

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: llmMessages, temperature: 0.7, max_tokens: 2048 }),
      });
      if (!res.ok) return NextResponse.json({ error: `Provider error ${res.status}` }, { status: 502 });
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content ?? "";
      return NextResponse.json(parseTutorReply(content));
    } catch {
      return NextResponse.json({ error: "Failed to reach provider" }, { status: 502 });
    }
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
```

- [ ] **Step 4: Update `ConversationPage` to stop sending `context`**

Remove `context` from the `POST /api/tutor` body in `src/components/ConversationPage.tsx`; send only `{ messages, input }`. Also call `addSession` (existing behavior) — unchanged.

- [ ] **Step 5: Run test, typecheck, build**

Run: `npx vitest run tests/tutor.test.ts && npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/tutor/route.ts src/components/ConversationPage.tsx tests/tutor.test.ts
git commit -m "feat(tutor): auth-gated tutor with server-built learner context"
```

---

### Task 13: E2E tests + full verification (needs Docker Desktop)

> **Docker Desktop:** this is the moment to tell the user: *"Please start Docker Desktop now."* A Postgres container is required for the e2e suite and for manually running the app.

**Files:**
- Create: `docker-compose.dev.yml` (dev-only Postgres for e2e), `e2e/auth.spec.ts`
- Modify: `e2e/smoke.spec.ts`, `playwright.config.ts`, `.env.example`
- Test: full verification.

- [ ] **Step 1: Write `docker-compose.dev.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: kak
      POSTGRES_PASSWORD: kak
      POSTGRES_DB: kak
    ports:
      - "5432:5432"
    volumes:
      - kak_dev_pg:/var/lib/postgresql/data

volumes:
  kak_dev_pg:
```

- [ ] **Step 2: Start Postgres**

Run: `docker compose -f docker-compose.dev.yml up -d`
Expected: container healthy on `localhost:5432`.

- [ ] **Step 3: Configure the dev server**

`.env.local`:
```
DATABASE_URL=postgres://kak:kak@localhost:5432/kak
JWT_SECRET=<48 random chars>
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-123
APP_URL=http://localhost:3000
TRUST_PROXY=false
```

Run: `npm run dev` (migrations auto-run via `instrumentation.ts`; admin is seeded).

- [ ] **Step 4: Write `e2e/auth.spec.ts`**

Cover: register a new user → lands on dashboard; logout → login with wrong password fails; login with correct password succeeds; **second user isolation** — register User A, complete lesson 1, register User B, confirm User B's dashboard shows no completion for lesson 1; change password then re-login; admin login sees the Admin link and can list users.

> The smoke spec (existing) must be updated to register/login first. Playwright `webServer` command stays `npm run dev`; add `DATABASE_URL`/`JWT_SECRET` to its env. Reset Postgres between runs via `TRUNCATE users CASCADE` (dev only) so specs are deterministic.

- [ ] **Step 5: Run the e2e suite**

Run: `npm run test:e2e`
Expected: all pass.

- [ ] **Step 6: Full verification**

Run: `npx tsc --noEmit && npx vitest run && npm run build && npm run test:e2e`
Expected: all green.

- [ ] **Step 7: Manual smoke in the browser**

Open http://localhost:3000, register a user, complete a lesson, open Vocabulary + Review, open Settings → reset data, confirm data is wiped and rehydrated.

- [ ] **Step 8: Commit**

```bash
git add docker-compose.dev.yml e2e playwright.config.ts .env.example .env.local.example
git commit -m "test(e2e): auth flows, multi-user isolation, full verification"
```

---

## Self-Review

**Spec coverage:**
- §3 Architecture → Task 1 (DB/bootstrap), Task 9 (server store).
- §4 Data model → Task 1 schema, Task 6 repo.
- §5 Auth & sessions → Tasks 2, 3, 4, 5.
- §6 API surface & store integration → Tasks 5, 7, 9, 12.
- §7 Config & secrets → Task 1 (config.ts, .env.example).
- §8 Security hardening → Tasks 2 (bcrypt/JWT), 3 (CSRF header, rate limit), 5 (middleware origin/CSRF, rate limit), 4 (authorization), 5 (zod).
- §9 Testing → Tasks 1–8 (unit/integration), 10–11 (e2e in 13).

**Deferred by design (recorded in spec §10):** SMTP email flows (schema-ready only), email verification/MFA/social login implementation, teacher role, Docker/Portainer/CI/CD (Sub-project C), Piper TTS (Sub-project B), full docs/reports (Sub-project D).

**Note for the executor:** the plan references `@/lib/store/serverStore.ts` in Task 9's commit but implements its helpers inside `useStore.ts` (Task 9 Step 5) — commit both the mapping helpers and the rewired store.
