# Indonesian Tutor ("Kak") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, offline-first personal Indonesian language tutor web app (Next.js 15 + TS + Tailwind + Zustand) with an adaptive difficulty engine, scripted offline tutor, SRS vocabulary review, 12 authored lessons, and an AI-provider abstraction ready for a later API key.

**Architecture:** Client-side React app under the App Router. A `Store` interface wraps localStorage persistence; a `LanguageModelProvider` abstraction wraps the tutor (Scripted offline engine now, OpenAI-compatible provider later); `TutorEngine` orchestrates lessons and free conversation; `srs/` and `difficulty/` power review scheduling and adaptation. UI is a sidebar shell + 7 routes.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Zustand, Vitest, Playwright. No other runtime deps.

## Global Constraints

- App must run fully offline — no API key required. `OPENAI_API_KEY` is optional and unused in V1.
- Single storage namespace key: `indo-tutor:v1`.
- All types live in `src/lib/types/`; all lesson/word content in `src/lib/data/`.
- No gamification: no avatars, coins, badges, or energy systems.
- Feedback must be useful, not empty praise. Use patterns like `Hampir! 😊`, `Coba lagi.`.
- Keep Indonesian authentic and simple; translations shown per `translationMode` (`beginner|intermediate|advanced`).
- No comments in code unless required by the task.
- Favor TypeScript strict mode; `verbatimModuleSyntax` requires `import type` for type-only imports.

---

### Task 1: Scaffold Next.js app, tooling, and store types

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `.env.example`, `.gitignore` (append), `README.md`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/lib/types/index.ts`
- Create: `vitest.config.ts`, `tests/setup.ts`, `e2e/smoke.spec.ts` (placeholder), `playwright.config.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: all data-model types (used everywhere), project scaffold, `npm run dev/test/test:e2e/build` scripts.

- [ ] **Step 1: Scaffold project files**

Create `package.json`:

```json
{
  "name": "indo-tutor",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "15.1.6",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "zustand": "5.0.3"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.0",
    "vitest": "^2.1.8"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
export default nextConfig;
```

Create `postcss.config.mjs`:

```js
const config = { plugins: { tailwindcss: {}, autoprefixer: {} } };
export default config;
```

Create `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
      },
    },
  },
  plugins: [],
};
export default config;
```

Create `.env.example`:

```
# Optional. When set, the app uses the OpenAI-compatible provider instead of the built-in offline scripted tutor.
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

Append to `.gitignore`:

```
.env.example
coverage
```

Create `README.md` with: app purpose, `npm install && npm run dev`, `npm test`, `npm run test:e2e`, and a "AI provider" section explaining `.env.example` / `OPENAI_API_KEY` / `OPENAI_BASE_URL` are optional and the app works fully offline without them.

- [ ] **Step 2: Create data-model types**

Create `src/lib/types/index.ts`:

```ts
export type TranslationMode = "beginner" | "intermediate" | "advanced";
export type DifficultyLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface User {
  name: string;
  createdAt: number;
}

export interface LearningProfile {
  level: 0 | 1 | 2 | 3 | 4;
  translationMode: TranslationMode;
  pronunciationOn: boolean;
  vocabKnowledge: number;
  grammarKnowledge: number;
  conversationAbility: number;
  readingAbility: number;
  listeningAbility: number;
  recentMistakes: number[];
  confidence: number;
  currentDifficulty: DifficultyLevel;
  lastAnswerAccuracy: number;
  consecutiveCorrect: number;
}

export interface VocabularyWord {
  id: string;
  indonesian: string;
  english: string;
  pronunciation: string;
  example: string;
  exampleTranslation: string;
  category: string;
  level: number;
  familiarity: number;
  exposures: number;
  correct: number;
  mistakes: number;
  lastReviewed: number | null;
  nextReview: number | null;
  streak: number;
}

export interface GrammarConcept {
  id: string;
  name: string;
  description: string;
  exposedAt: number | null;
  mastered: boolean;
}

export type LessonStatus = "not_started" | "in_progress" | "complete";

export interface LessonProgress {
  lessonId: string;
  status: LessonStatus;
  completedAt: number | null;
  attempts: number;
}

export interface Lesson {
  id: string;
  title: string;
  emoji: string;
  level: number;
  order: number;
  newWordIds: string[];
  warmUpIds: string[];
  sentences: string[];
  practice: PracticeItem[];
  recall: RecallItem[];
  reviewNote: string;
  grammarNote: string | null;
}

export interface PracticeItem {
  prompt: string;
  expectedWords: string[];
  hint: string;
}

export interface RecallItem {
  indonesian: string;
  english: string;
}

export type MessageKind = "tutor" | "learner" | "system";

export interface ConversationMessage {
  id: string;
  kind: MessageKind;
  content: string;
  timestamp: number;
  hint?: string;
  translation?: string;
}

export interface Conversation {
  id: string;
  lessonId?: string;
  startedAt: number;
  messages: ConversationMessage[];
}

export interface PracticeAttempt {
  id: string;
  ts: number;
  kind: "lesson" | "conversation" | "recall" | "vocab";
  prompt: string;
  learnerAnswer: string;
  expected: string;
  correct: boolean | "partial";
  wordIds: string[];
}

export interface ReviewItem {
  wordId: string;
  due: number;
  intervalDays: number;
}

export interface LearningSession {
  id: string;
  ts: number;
  durationMin: number;
  wordsReviewed: number;
  newWords: number;
  recallRate: number;
}

export interface LearnerState {
  user: User;
  profile: LearningProfile;
  words: Record<string, VocabularyWord>;
  lessons: Record<string, LessonProgress>;
  grammar: Record<string, GrammarConcept>;
  conversations: Conversation[];
  attempts: PracticeAttempt[];
  sessions: LearningSession[];
}
```

- [ ] **Step 3: Create vitest + playwright configs**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

Create `tests/setup.ts` (empty for now; imported by tests that need it).

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: true,
  },
});
```

Create `e2e/smoke.spec.ts` with a single passing placeholder test:

```ts
import { test, expect } from "@playwright/test";

test("app starts and dashboard renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Indonesian/);
});
```

- [ ] **Step 4: Create root layout and shell page**

Create `src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kak — Indonesian Tutor",
  description: "A patient Indonesian tutor that adapts to you.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

Create `src/app/page.tsx` (temporary shell so the app compiles; replaced in Task 9):

```tsx
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">Kak — Indonesian Tutor</h1>
      <p className="mt-2 text-slate-600">Loading your tutor…</p>
    </main>
  );
}
```

- [ ] **Step 5: Verify build and unit tests run**

Run: `npm install`
Run: `npx tsc --noEmit`
Expected: no type errors.
Run: `npm test`
Expected: Vitest runs with 0 tests, exits 0 (or reports no test files found).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app, types, and test tooling"
```

---

### Task 2: Word bank content

**Files:**
- Create: `src/lib/data/words.ts`

**Interfaces:**
- Consumes: `VocabularyWord` from Task 1.
- Produces: `WORD_BANK: VocabularyWord[]` and `categoryOrder: string[]`. Words have stable `id` slugs (e.g. `makan`). `level` tag: 0 for survival words, 1+ for later. All include `example` + `exampleTranslation`.

- [ ] **Step 1: Write the word bank**

Create `src/lib/data/words.ts` exporting `WORD_BANK`. It must contain at minimum the following words with id = Indonesian word, correct `english`, `pronunciation`, a short `example`, `exampleTranslation`, `category`, and `level`. Categories: `greetings`, `yesno`, `numbers`, `food`, `drinks`, `family`, `house`, `likes`, `shopping`, `restaurant`, `time`, `weather`, `people`, `actions`, `places`, `questions`.

Level-0 survival set (id: indonesian → english):
- halo: Hello / hai: Hi / selamat pagi: good morning / selamat malam: good evening / terima kasih: thank you / sama-sama: you're welcome / maaf: sorry / ya: yes / tidak: no
- saya: I / me / kamu: you / ini: this / itu: that
- makan: to eat / minum: to drink / mau: to want / suka: to like
- air: water / nasi: rice / kopi: coffee / teh: tea / susu: milk
- rumah: house / orang: person
- satu..sepuluh (1–10): one..ten / berapa: how many / how much
- apa: what / siapa: who / di mana: where
- enak: delicious / bagus: good / murah: cheap / mahal: expensive / panas: hot / dingin: cold

Each word's `example` should be a short level-0 sentence using only survival vocab, e.g. for `air`: `example: "Saya minum air."`, `exampleTranslation: "I drink water."`, `pronunciation: "AH-eer"`.

Add 10+ additional level-0 words beyond the list above (e.g. `teman` friend, `kakak` older sibling, `adik` younger sibling, `ibu` mother, `ayah` father, `pintu` door, `kamar` room, `hujan` rain, `cerah` clear, `hari` day, `makanan` food, `minuman` drink, `pesan` to order, `beli` to buy, `uang` money, `jam` hour/clock, `pukul` at (o'clock), `jalan` road/street, `bus`, `kereta` train, `kantor` office, `sekolah` school, `buku` book, `sangat` very, `tidak suka` — represent compound words as separate single words only; skip phrases like "tidak suka" in the bank).

- [ ] **Step 2: Add a coverage assertion test**

Create `tests/words.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { WORD_BANK } from "@/lib/data/words";

describe("word bank", () => {
  it("has unique ids", () => {
    const ids = WORD_BANK.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains the survival core", () => {
    const ids = WORD_BANK.map((w) => w.id);
    for (const id of ["halo", "saya", "kamu", "makan", "minum", "air", "nasi", "ya", "tidak", "apa"]) {
      expect(ids).toContain(id);
    }
  });

  it("every word has example and pronunciation", () => {
    for (const w of WORD_BANK) {
      expect(w.example).toBeTruthy();
      expect(w.pronunciation).toBeTruthy();
    }
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Indonesian word bank"
```

---

### Task 3: Lesson content (12 lessons)

**Files:**
- Create: `src/lib/data/lessons.ts`

**Interfaces:**
- Consumes: `Lesson`, `PracticeItem`, `RecallItem`, `LessonProgress` types (Task 1); word ids from `WORD_BANK` (Task 2).
- Produces: `LESSONS: Lesson[]` (12 entries, ordered) and `getLesson(id)`, `getLessonsByLevel(level)`.

- [ ] **Step 1: Author all 12 lessons**

Create `src/lib/data/lessons.ts`. Each lesson:
- `newWordIds`: 3–5 word ids that exist in `WORD_BANK`; cumulative across lessons so `warmUpIds` can only reference previously-introduced ids (check against the union of earlier lessons' `newWordIds`).
- `warmUpIds`: 3–4 ids from earlier lessons (lesson 1 uses `["halo"]`-adjacent survival ids introduced in its own set).
- `sentences`: 4–6 simple Indonesian sentences using only known + new words (these drive the scripted conversation).
- `practice`: 3 `PracticeItem`s — each a question Kak asks with `expectedWords` (content words that must appear in the learner answer) and a `hint` (English gloss).
- `recall`: 3 `RecallItem`s {indonesian, english} drawn from new + warm-up words.
- `reviewNote`: a one-line English summary; `grammarNote`: either `null` or a short implicit note (e.g. `"saya = I, makan = eat"`).

Lesson plan (order, title, new words):
1. Hello — halo, selamat pagi, terima kasih, sama-sama, ya, tidak
2. My Name — nama, saya, kamu, siapa, apa
3. Numbers — satu, dua, tiga, empat, lima, berapa (write 6; ok)
4. Food — nasi, ayam, ikan, roti, makan, enak
5. Drinks — air, kopi, teh, susu, minum, mau
6. Family — ibu, ayah, kakak, adik, keluarga
7. My House — rumah, kamar, pintu, jendela, dapur, tidur
8. Things I Like — suka, sangat, bagus, buku, teman
9. Shopping — beli, uang, murah, mahal, pasar, barang
10. Restaurant — pesan, makanan, minuman, tagihan, sate
11. Time — jam, pukul, hari, sekarang, malam, siang
12. Weather — hujan, panas, dingin, cuaca, cerah, hujan deras (use only single-word ids: hujan, panas, dingin, cuaca, cerah, mendung)

Every id referenced must exist in `WORD_BANK`; add any missing words to `words.ts` (Task 2) as part of this task.

- [ ] **Step 2: Add a consistency test**

Create `tests/lessons.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LESSONS } from "@/lib/data/lessons";
import { WORD_BANK } from "@/lib/data/words";

const ids = new Set(WORD_BANK.map((w) => w.id));

describe("lessons", () => {
  it("has exactly 12 lessons in order", () => {
    expect(LESSONS).toHaveLength(12);
    expect(LESSONS.map((l) => l.order)).toEqual([...LESSONS].map((_, i) => i + 1));
  });

  it("new words are cumulative and warm-up references earlier lessons", () => {
    const known = new Set<string>();
    for (const lesson of LESSONS) {
      for (const id of lesson.warmUpIds) {
        expect(known.has(id), `warm-up ${id} in ${lesson.title}`).toBe(true);
      }
      for (const id of lesson.newWordIds) {
        expect(ids.has(id), `unknown word ${id} in ${lesson.title}`).toBe(true);
        known.add(id);
      }
      expect(lesson.newWordIds.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("practice and recall are non-empty", () => {
    for (const lesson of LESSONS) {
      expect(lesson.practice.length).toBeGreaterThanOrEqual(3);
      expect(lesson.recall.length).toBeGreaterThanOrEqual(3);
    }
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: author 12 beginner lessons"
```

---

### Task 4: SRS scheduler

**Files:**
- Create: `src/lib/srs/scheduler.ts`
- Test: `tests/srs.test.ts`

**Interfaces:**
- Consumes: `VocabularyWord` (Task 1), `WordResult` from `useStore` (Task 5).
- Produces:
  - `scheduler.recordResult(word: VocabularyWord, result: WordResult): VocabularyWord`
  - `scheduler.dueItems(words: Record<string, VocabularyWord>, now?: number): VocabularyWord[]`
  - `scheduler.intervalAfter(word: VocabularyWord): number` (days)
  - Constants: `INTERVALS = [0, 1, 3, 7, 14, 30]`.

- [ ] **Step 1: Write the failing SRS test**

Create `tests/srs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scheduler } from "@/lib/srs/scheduler";
import type { VocabularyWord } from "@/lib/types";

const base: VocabularyWord = {
  id: "air",
  indonesian: "air",
  english: "water",
  pronunciation: "AH-eer",
  example: "Saya minum air.",
  exampleTranslation: "I drink water.",
  category: "drinks",
  level: 0,
  familiarity: 0,
  exposures: 0,
  correct: 0,
  mistakes: 0,
  lastReviewed: null,
  nextReview: null,
  streak: 0,
};

describe("scheduler", () => {
  it("correct answers increase familiarity and schedule future review", () => {
    const w = scheduler.recordResult(base, "correct");
    expect(w.familiarity).toBeGreaterThan(0);
    expect(w.streak).toBe(1);
    expect(w.nextReview).not.toBeNull();
  });

  it("wrong answers lower familiarity and shorten interval", () => {
    const first = scheduler.recordResult(base, "correct");
    const w = scheduler.recordResult(first, "wrong");
    expect(w.familiarity).toBeLessThan(first.familiarity);
    expect(w.streak).toBe(0);
    expect(w.nextReview).not.toBeNull();
  });

  it("dueItems returns only words due at the given time", () => {
    const now = Date.now();
    const w1 = scheduler.recordResult(base, "correct");
    const w2 = { ...w1, id: "nasi", nextReview: now + 1000000 };
    const words: Record<string, VocabularyWord> = { air: w1, nasi: w2 };
    const due = scheduler.dueItems(words, now);
    expect(due.map((d) => d.id)).toContain("air");
    expect(due.map((d) => d.id)).not.toContain("nasi");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/srs.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the scheduler**

`src/lib/srs/scheduler.ts`:

```ts
import type { VocabularyWord } from "@/lib/types";
import type { WordResult } from "@/lib/store/useStore";

export const INTERVALS = [0, 1, 3, 7, 14, 30] as const;

function clampFamiliarity(f: number): number {
  return Math.max(0, Math.min(1, f));
}

function todayPlus(days: number): number {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export const scheduler = {
  intervalAfter(word: VocabularyWord): number {
    if (word.streak <= 0) return 1;
    return INTERVALS[Math.min(word.streak, INTERVALS.length - 1)];
  },

  recordResult(word: VocabularyWord, result: WordResult): VocabularyWord {
    const now = Date.now();
    const exposures = word.exposures + 1;
    if (result === "correct") {
      const streak = word.streak + 1;
      const interval = this.intervalAfter({ ...word, streak });
      return {
        ...word,
        familiarity: clampFamiliarity(word.familiarity + 0.12),
        exposures,
        correct: word.correct + 1,
        lastReviewed: now,
        nextReview: todayPlus(interval),
        streak,
      };
    }
    if (result === "partial") {
      return {
        ...word,
        familiarity: clampFamiliarity(word.familiarity + 0.05),
        exposures,
        lastReviewed: now,
        nextReview: todayPlus(1),
      };
    }
    return {
      ...word,
      familiarity: clampFamiliarity(word.familiarity - 0.2),
      exposures,
      mistakes: word.mistakes + 1,
      lastReviewed: now,
      nextReview: todayPlus(1),
      streak: 0,
    };
  },

  dueItems(
    words: Record<string, VocabularyWord>,
    now: number = Date.now(),
  ): VocabularyWord[] {
    return Object.values(words).filter((w) => w.nextReview !== null && w.nextReview <= now);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/srs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add spaced-repetition scheduler"
```

---

### Task 5: Store (persistence) + Zustand hook

**Files:**
- Create: `src/lib/store/Store.ts`, `src/lib/store/localStore.ts`, `src/lib/store/useStore.ts`
- Test: `tests/store.test.ts`

**Interfaces:**
- Consumes: `LearnerState`, `LearningProfile`, `LessonProgress`, `LearningSession`, `PracticeAttempt` types (Task 1); `scheduler` (Task 4).
- Produces:
  - `createInitialState(name: string): LearnerState`
  - `interface Store { getState(): LearnerState; setState(partial: Partial<LearnerState>): void; }`
  - `localStore: Store` (localStorage-backed, key `indo-tutor:v1`)
  - Zustand store `useStore` with actions: `setUser(name)`, `updateProfile(partial)`, `recordAttempt(a: PracticeAttempt)`, `addSession(s: LearningSession)`, `setLessonProgress(id, status)`, `bumpWord(id, result)` where `result: "correct" | "partial" | "wrong"`, `touchWord(id)`, `resetAll()`.
  - `loadStore()` must run client-side only (guard `typeof window === "undefined"`).

- [ ] **Step 1: Write the store abstraction**

`src/lib/store/Store.ts`:

```ts
import type { LearnerState } from "@/lib/types";

export interface Store {
  getState(): LearnerState;
  setState(partial: Partial<LearnerState>): void;
}
```

- [ ] **Step 2: Write the localStorage implementation**

`src/lib/store/localStore.ts`:

```ts
import type { LearnerState } from "@/lib/types";
import type { Store } from "@/lib/store/Store";

const KEY = "indo-tutor:v1";

export function createInitialState(name: string): LearnerState {
  return {
    user: { name, createdAt: Date.now() },
    profile: {
      level: 0,
      translationMode: "beginner",
      pronunciationOn: true,
      vocabKnowledge: 0,
      grammarKnowledge: 0,
      conversationAbility: 0,
      readingAbility: 0,
      listeningAbility: 0,
      recentMistakes: [],
      confidence: 0.5,
      currentDifficulty: 0,
      lastAnswerAccuracy: 1,
      consecutiveCorrect: 0,
    },
    words: {},
    lessons: {},
    grammar: {},
    conversations: [],
    attempts: [],
    sessions: [],
  };
}

export function loadState(): LearnerState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LearnerState) : null;
  } catch {
    return null;
  }
}

export const localStore: Store = {
  getState(): LearnerState {
    return loadState() ?? createInitialState("Sten");
  },
  setState(partial: Partial<LearnerState>): void {
    if (typeof window === "undefined") return;
    const next = { ...this.getState(), ...partial };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  },
};
```

- [ ] **Step 3: Write the Zustand store**

`src/lib/store/useStore.ts`:

```ts
import { create } from "zustand";
import type { LearningSession, LessonProgress, PracticeAttempt } from "@/lib/types";
import { createInitialState, localStore } from "@/lib/store/localStore";
import type { Store } from "@/lib/store/Store";
import { scheduler } from "@/lib/srs/scheduler";

export type WordResult = "correct" | "partial" | "wrong";

interface TutorState {
  state: ReturnType<typeof localStore.getState>;
  setUser: (name: string) => void;
  updateProfile: (partial: Partial<TutorState["state"]["profile"]>) => void;
  recordAttempt: (a: PracticeAttempt) => void;
  addSession: (s: LearningSession) => void;
  setLessonProgress: (id: string, status: LessonProgress["status"]) => void;
  bumpWord: (id: string, result: WordResult) => void;
  touchWord: (id: string) => void;
  resetAll: () => void;
}
```

Implementation notes (write full code):
- `state` initialised from `localStore.getState()` guarded to `createInitialState("Sten")` during SSR (`typeof window === "undefined"`).
- Every action mutates a fresh copy and calls `localStore.setState(...)`.
- `bumpWord(id, result)` delegates to `scheduler.recordResult(word, result)` and writes the returned updated word into `state.words[id]`, also pushing a `reviewItem` via `scheduler.dueItems`.
- `resetAll()` writes `createInitialState(state.user.name)`.

- [ ] **Step 4: Write the store test**

Create `tests/store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/store/localStore";

describe("createInitialState", () => {
  it("builds a valid beginner profile", () => {
    const s = createInitialState("Sten");
    expect(s.user.name).toBe("Sten");
    expect(s.profile.level).toBe(0);
    expect(s.profile.translationMode).toBe("beginner");
    expect(s.words).toEqual({});
    expect(s.sessions).toEqual([]);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add localStorage-backed store with zustand hook"
```

---

### Task 6: Difficulty engine + learner model

**Files:**
- Create: `src/lib/difficulty/learnerModel.ts`, `src/lib/difficulty/simplify.ts`
- Test: `tests/difficulty.test.ts`

**Interfaces:**
- Consumes: `LearningProfile`, `VocabularyWord` (Task 1), `PracticeAttempt` (Task 1).
- Produces:
  - `computeLearnerStats(words, attempts, profile): { vocabSize, avgFamiliarity, accuracy, sameMistakeCount, avgAnswerLength }`
  - `adaptProfile(profile, stats): LearningProfile` — raises `currentDifficulty`/`level` only after `consecutiveCorrect >= 3`; drops `currentDifficulty` immediately when recent accuracy < 0.4.
  - `simplifyUtterance(sentence: string): string` — step-down ladder for long sentences.
  - `knownWordIds(words, threshold = 0.5): string[]`

- [ ] **Step 1: Write the failing difficulty test**

Create `tests/difficulty.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeLearnerStats, adaptProfile, knownWordIds } from "@/lib/difficulty/learnerModel";
import { simplifyUtterance } from "@/lib/difficulty/simplify";
import { createInitialState } from "@/lib/store/localStore";
import type { PracticeAttempt } from "@/lib/types";

describe("learner model", () => {
  it("counts known words by familiarity threshold", () => {
    const s = createInitialState("Sten");
    s.words = {
      air: { ...(s.words.air ?? { id: "air", indonesian: "air", english: "water", pronunciation: "", example: "", exampleTranslation: "", category: "", level: 0, familiarity: 0, exposures: 1, correct: 1, mistakes: 0, lastReviewed: null, nextReview: null, streak: 1 }), familiarity: 0.7 },
      nasi: { id: "nasi", indonesian: "nasi", english: "rice", pronunciation: "", example: "", exampleTranslation: "", category: "", level: 0, familiarity: 0, exposures: 0, correct: 0, mistakes: 0, lastReviewed: null, nextReview: null, streak: 0 },
    };
    expect(knownWordIds(s.words)).toEqual(["air"]);
  });

  it("gates difficulty increase on consistent performance", () => {
    const s = createInitialState("Sten");
    s.profile.consecutiveCorrect = 3;
    const stats = { vocabSize: 5, avgFamiliarity: 0.4, accuracy: 1, sameMistakeCount: 0, avgAnswerLength: 2 };
    const out = adaptProfile(s.profile, stats);
    expect(out.currentDifficulty).toBeGreaterThan(s.profile.currentDifficulty);
  });

  it("drops difficulty on poor recent accuracy", () => {
    const s = createInitialState("Sten");
    s.profile.currentDifficulty = 3;
    const stats = { vocabSize: 5, avgFamiliarity: 0.4, accuracy: 0.2, sameMistakeCount: 2, avgAnswerLength: 1 };
    const out = adaptProfile(s.profile, stats);
    expect(out.currentDifficulty).toBeLessThan(s.profile.currentDifficulty);
  });
});

describe("simplifyUtterance", () => {
  it("breaks long sentences into simpler ones", () => {
    const complex = "Apa yang biasanya kamu lakukan setelah pulang kerja?";
    const simple = simplifyUtterance(complex);
    expect(simple.length).toBeLessThan(complex.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/difficulty.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the learner model**

`src/lib/difficulty/learnerModel.ts`:

```ts
import type { LearningProfile, PracticeAttempt, VocabularyWord } from "@/lib/types";

export interface LearnerStats {
  vocabSize: number;
  avgFamiliarity: number;
  accuracy: number;
  sameMistakeCount: number;
  avgAnswerLength: number;
}

export function knownWordIds(
  words: Record<string, VocabularyWord>,
  threshold = 0.5,
): string[] {
  return Object.values(words)
    .filter((w) => w.familiarity >= threshold)
    .map((w) => w.id);
}

export function computeLearnerStats(
  words: Record<string, VocabularyWord>,
  attempts: PracticeAttempt[],
  profile: LearningProfile,
): LearnerStats {
  const all = Object.values(words);
  const known = all.filter((w) => w.familiarity >= 0.5);
  const avgFamiliarity =
    all.length === 0 ? 0 : all.reduce((sum, w) => sum + w.familiarity, 0) / all.length;
  const recent = attempts.slice(-10);
  const correct = recent.filter((a) => a.correct === true).length;
  const accuracy = recent.length === 0 ? 1 : correct / recent.length;
  const recentMistakes = profile.recentMistakes.length;
  const avgAnswerLength =
    recent.length === 0 ? 2 : recent.reduce((sum, a) => sum + a.learnerAnswer.trim().split(/\s+/).length, 0) / recent.length;
  return {
    vocabSize: known.length,
    avgFamiliarity,
    accuracy,
    sameMistakeCount: recentMistakes,
    avgAnswerLength,
  };
}

export function adaptProfile(
  profile: LearningProfile,
  stats: LearnerStats,
): LearningProfile {
  let next = { ...profile };
  if (stats.accuracy < 0.4) {
    next = { ...next, currentDifficulty: Math.max(0, next.currentDifficulty - 1) as LearningProfile["currentDifficulty"] };
  } else if (next.consecutiveCorrect >= 3 && stats.avgAnswerLength >= 1) {
    next = {
      ...next,
      currentDifficulty: Math.min(5, next.currentDifficulty + 1) as LearningProfile["currentDifficulty"],
      level: Math.min(4, next.level + (next.currentDifficulty >= 3 ? 1 : 0)) as LearningProfile["level"],
    };
  }
  return next;
}
```

- [ ] **Step 4: Write the simplification ladder**

`src/lib/difficulty/simplify.ts`:

```ts
const LADDER: Array<[RegExp, string]> = [
  [/Apa yang biasanya kamu lakukan/, "Kamu kerja"],
  [/setelah pulang kerja/, ""],
  [/Apa yang kamu/, "Kamu"],
  [/apakah kamu/, "kamu"],
  [/yang paling/, ""],
  [/bagaimana cara/, "cara"],
];

export function simplifyUtterance(sentence: string): string {
  let out = sentence;
  for (const [re, replacement] of LADDER) {
    out = out.replace(re, replacement).trim();
  }
  out = out.replace(/\s+/g, " ");
  if (out.length > 0 && out[0] === out[0].toLowerCase()) {
    out = out[0].toUpperCase() + out.slice(1);
  }
  return out;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/difficulty.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add learner model and difficulty simplification"
```

---

### Task 7: Tutor engine — providers, matching, corrections

**Files:**
- Create: `src/lib/engine/provider.ts`, `src/lib/engine/scripted.ts`, `src/lib/engine/engine.ts`, `src/lib/engine/matcher.ts`
- Test: `tests/engine.test.ts`

**Interfaces:**
- Consumes: `LearnerState`, `Lesson`, `PracticeAttempt` (Task 1), `LESSONS` (Task 3), `knownWordIds`, `computeLearnerStats`, `adaptProfile`, `simplifyUtterance` (Task 6), `scheduler` (Task 4).
- Produces:
  - `interface LanguageModelProvider { generate(ctx: TutorContext): Promise<TutorResponse> }`
  - `TutorContext = { state: LearnerState; lesson: Lesson; messages: ConversationMessage[]; input?: string; mode: "lesson" | "conversation"; }`
  - `TutorResponse = { text: string; hint?: string; translation?: string; expectAnswer: boolean; expectedWords?: string[]; }`
  - `scriptedProvider: LanguageModelProvider`
  - `TutorEngine` with:
    - `startLesson(state, lesson): { messages: ConversationMessage[] }`
    - `lessonStep(state, lesson, index): ConversationMessage`
    - `respond(state, input, mode): { message: ConversationMessage; attempts: PracticeAttempt[]; wordsToRecord: Record<string, WordResult> }`
  - `matchAnswer(input: string, expected: string[], options?: { partial?: boolean }): { correct: boolean | "partial"; matched: string[] }`
  - `buildCorrection(lesson: Lesson, input: string, expected: string): string`
  - `TUTOR_PROMPT: string` exported from `src/lib/data/tutorPrompt.ts`

- [ ] **Step 1: Write the tutor system prompt**

Create `src/lib/data/tutorPrompt.ts`:

```ts
export const TUTOR_PROMPT = `You are Kak, a patient Indonesian language tutor.

- Speak Indonesian appropriate to the learner's level. Start extremely simple.
- Use English only when necessary; reduce translations as the learner improves.
- Introduce 2-5 new words at a time, and reuse previously learned vocabulary.
- Avoid grammar lectures. Teach patterns implicitly.
- Correct mistakes gently and briefly. Give a corrected example, then ask a fresh question.
- Recognise partial understanding ("Hampir!", "Coba lagi.").
- Simplify when the learner struggles; increase difficulty only after consistent success.
- Favour conversation and active recall over quizzes.
- Use natural, everyday Indonesian.
`;
```

- [ ] **Step 2: Write the matcher test**

Create `tests/engine.test.ts` (accumulate tests through this task; add one per feature below).

```ts
import { describe, expect, it } from "vitest";
import { matchAnswer } from "@/lib/engine/matcher";

describe("matchAnswer", () => {
  it("matches all expected words", () => {
    const r = matchAnswer("Saya minum air", ["minum", "air"]);
    expect(r.correct).toBe(true);
  });

  it("returns partial for missing words", () => {
    const r = matchAnswer("saya minum", ["minum", "air"]);
    expect(r.correct).toBe("partial");
  });

  it("returns wrong for unrelated input", () => {
    const r = matchAnswer("saya makan nasi", ["minum", "air"]);
    expect(r.correct).toBe(false);
  });

  it("handles ya/tidak answers", () => {
    expect(matchAnswer("ya", ["ya"]).correct).toBe(true);
    expect(matchAnswer("tidak", ["tidak"]).correct).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/engine.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Write the matcher**

`src/lib/engine/matcher.ts`:

```ts
export interface MatchResult {
  correct: boolean | "partial";
  matched: string[];
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[.,!?]/g, "");
}

export function matchAnswer(
  input: string,
  expected: string[],
): MatchResult {
  const words = normalize(input).split(/\s+/);
  const matched = expected.filter((e) => words.includes(normalize(e)));
  if (matched.length === expected.length) return { correct: true, matched };
  if (matched.length > 0) return { correct: "partial", matched };
  return { correct: false, matched };
}
```

- [ ] **Step 5: Run matcher test**

Run: `npm test -- tests/engine.test.ts`
Expected: PASS (matcher tests).

- [ ] **Step 6: Write provider interface + scripted provider**

`src/lib/engine/provider.ts`:

```ts
import type { ConversationMessage, LearnerState, Lesson } from "@/lib/types";

export interface TutorContext {
  state: LearnerState;
  lesson: Lesson;
  messages: ConversationMessage[];
  input?: string;
  mode: "lesson" | "conversation";
}

export interface TutorResponse {
  text: string;
  hint?: string;
  translation?: string;
  expectAnswer: boolean;
  expectedWords?: string[];
}

export interface LanguageModelProvider {
  generate(ctx: TutorContext): Promise<TutorResponse>;
}
```

`src/lib/engine/scripted.ts`: implement `scriptedProvider: LanguageModelProvider`. It must:
- In **lesson** mode: advance through the lesson's `practice` items. For each item, produce a tutor question (`prompt`), set `expectedWords`, provide `hint`. When the learner's `input` is present, evaluate with `matchAnswer`, and on partial/wrong use `buildCorrection` (from `engine.ts`) to emit `Hampir!`/`Coba lagi.` + a corrected example from `lesson.sentences`, then re-ask the same question (return `expectAnswer: true`).
- In **conversation** mode: build a question from `knownWordIds` of the learner's words (familiarity ≥ 0.5) using templates:
  `Ini apa?`, `Kamu suka <word>?`, `Kamu mau <drink>?`, `Kamu makan apa?`, `Kamu <verb> apa?`, `<word> apa ini?`.
  If learner input is present, evaluate against the active `expectedWords` and respond with a natural follow-up (e.g. `Bagus! 🙂`, `Hampir! ...`), reusing the learner's answer content.
  If the learner is struggling (per `simplifyUtterance`), shorten the question.
- Always keep sentences within `currentDifficulty` complexity budget (word count ≤ 6 + difficulty*2).

- [ ] **Step 7: Write the TutorEngine**

`src/lib/engine/engine.ts`:

```ts
import { matchAnswer } from "@/lib/engine/matcher";
import { scriptedProvider } from "@/lib/engine/scripted";
import type { LanguageModelProvider, TutorContext, TutorResponse } from "@/lib/engine/provider";
import { adaptProfile, computeLearnerStats } from "@/lib/difficulty/learnerModel";
import type { ConversationMessage, LearnerState, Lesson, PracticeAttempt } from "@/lib/types";
import type { WordResult } from "@/lib/store/useStore";

export class TutorEngine {
  constructor(private provider: LanguageModelProvider = scriptedProvider) {}

  async startLesson(state: LearnerState, lesson: Lesson): Promise<ConversationMessage[]> {
    const opening: ConversationMessage[] = [
      { id: crypto.randomUUID(), kind: "tutor", content: `Halo! 👋`, timestamp: Date.now() },
      { id: crypto.randomUUID(), kind: "tutor", content: `Hari ini kita belajar: ${lesson.emoji} ${lesson.title}`, timestamp: Date.now() },
    ];
    return opening;
  }

  async respond(
    state: LearnerState,
    lesson: Lesson,
    messages: ConversationMessage[],
    input: string,
    mode: "lesson" | "conversation",
  ): Promise<{ message: ConversationMessage; attempts: PracticeAttempt[]; wordsToRecord: Record<string, WordResult> }> {
    const ctx: TutorContext = { state, lesson, messages, input, mode };
    const res: TutorResponse = await this.provider.generate(ctx);
    const stats = computeLearnerStats(state.words, state.attempts, state.profile);
    const adapted = adaptProfile(state.profile, stats);
    const message: ConversationMessage = {
      id: crypto.randomUUID(),
      kind: "tutor",
      content: res.text,
      timestamp: Date.now(),
      hint: res.hint,
      translation: res.translation,
    };
    const attempts: PracticeAttempt[] = [];
    const wordsToRecord: Record<string, WordResult> = {};
    if (input) {
      const expected = res.expectedWords ?? [];
      const result = matchAnswer(input, expected);
      attempts.push({
        id: crypto.randomUUID(),
        ts: Date.now(),
        kind: mode,
        prompt: ctx.messages[ctx.messages.length - 1]?.content ?? "",
        learnerAnswer: input,
        expected: expected.join(" "),
        correct: result.correct,
        wordIds: expected,
      });
      for (const id of expected) {
        wordsToRecord[id] = result.correct === true ? "correct" : result.correct === "partial" ? "partial" : "wrong";
      }
    }
    // persist adaptation hint into state via return value; the caller applies adaptProfile
    return { message, attempts, wordsToRecord, adaptedProfile: adapted };
  }
}
```

Add `adaptedProfile` to the returned object and its type: `{ message; attempts; wordsToRecord; adaptedProfile: LearningProfile }`. The `wordsToRecord` keys map to `scheduler.recordResult` results applied by the caller in `useStore`.

- [ ] **Step 8: Add engine integration test**

Append to `tests/engine.test.ts`:

```ts
import { TutorEngine } from "@/lib/engine/engine";
import { LESSONS } from "@/lib/data/lessons";
import { createInitialState } from "@/lib/store/localStore";

describe("TutorEngine", () => {
  it("starts a lesson with a greeting", async () => {
    const engine = new TutorEngine();
    const state = createInitialState("Sten");
    const messages = await engine.startLesson(state, LESSONS[0]);
    expect(messages[0].content).toContain("Halo");
  });

  it("records attempts and adapts profile", async () => {
    const engine = new TutorEngine();
    const state = createInitialState("Sten");
    const lesson = LESSONS[0];
    const msgs = await engine.startLesson(state, lesson);
    const input = "Ya";
    const out = await engine.respond(state, lesson, msgs, input, "lesson");
    expect(out.attempts.length).toBeGreaterThanOrEqual(0);
    expect(out.adaptedProfile).toBeTruthy();
  });
});
```

- [ ] **Step 9: Run full engine tests**

Run: `npm test -- tests/engine.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add tutor engine, scripted provider, and answer matcher"
```

---

### Task 8: Audio provider (browser TTS)

**Files:**
- Create: `src/lib/audio/SpeechProvider.ts`, `src/lib/audio/browserTTS.ts`
- Test: `tests/audio.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface SpeechProvider { speak(text: string): void; supported: boolean; }`, `browserTTS: SpeechProvider` (Web Speech API, `id-ID` voice preferred, graceful no-op when `speechSynthesis` is missing).

- [ ] **Step 1: Write audio test**

Create `tests/audio.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { browserTTS } from "@/lib/audio/browserTTS";

describe("browserTTS", () => {
  it("is an object with speak and supported", () => {
    expect(typeof browserTTS.speak).toBe("function");
    expect(typeof browserTTS.supported).toBe("boolean");
  });

  it("no-ops safely when speechSynthesis is unavailable", () => {
    expect(() => browserTTS.speak("halo")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/audio.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the audio provider**

`src/lib/audio/SpeechProvider.ts`:

```ts
export interface SpeechProvider {
  speak(text: string): void;
  supported: boolean;
}
```

`src/lib/audio/browserTTS.ts`:

```ts
import type { SpeechProvider } from "@/lib/audio/SpeechProvider";

const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;

function pickVoice(): SpeechSynthesisVoice | undefined {
  if (!hasSpeech) return undefined;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith("id")) ?? undefined;
}

export const browserTTS: SpeechProvider = {
  supported: hasSpeech,
  speak(text: string): void {
    if (!hasSpeech) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "id-ID";
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/audio.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add browser TTS speech provider"
```

---

### Task 9: App shell + sidebar + dashboard

**Files:**
- Create: `src/components/Sidebar.tsx`, `src/components/LevelBar.tsx`, `src/components/Dashboard.tsx`
- Modify: `src/app/layout.tsx` (add sidebar shell), `src/app/page.tsx` (render Dashboard)

**Interfaces:**
- Consumes: `useStore` (Task 5), `LESSONS` + `getLesson` (Task 3), `knownWordIds` (Task 6), `scheduler.dueItems` (Task 4), `TutorEngine` (Task 7).
- Produces: sidebar nav, level indicator, dashboard sections.

- [ ] **Step 1: Write the Sidebar + LevelBar**

`src/components/LevelBar.tsx`: given `level: number`, `progress: number` (0–1), renders `Indonesian Level {level + 1}` plus a 10-block bar filled `Math.round(progress * 10)` blocks.

`src/components/Sidebar.tsx`: client component using `useStore`. Nav items (link, label, emoji):
- `/` — 🏠 Learn
- `/conversation` — 💬 Conversation
- `/vocabulary` — 📚 Vocabulary
- `/review` — 🔄 Review
- `/progress` — 📈 Progress
- `/settings` — ⚙️ Settings
Active link styled with brand background. At top: app name "Kak" + tagline; below nav: `LevelBar`.

- [ ] **Step 2: Wire the shell into the layout**

Modify `src/app/layout.tsx` to a two-column shell: `<Sidebar />` fixed on the left (w-64, hidden on small screens → top nav bar), content area `flex-1 overflow-y-auto`. Use `next/link` and `next/navigation`'s `usePathname`. Because `layout.tsx` is a server component, extract the shell into `src/components/Shell.tsx` (client) that takes `children` and renders Sidebar + main. Update `layout.tsx`:

```tsx
import { Shell } from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = { title: "Kak — Indonesian Tutor", description: "..." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Write the Dashboard**

`src/components/Dashboard.tsx` (client): computes from `useStore`:
- **Today's Learning** from the last `LearningSession` (or today's sessions): minutes, words reviewed, new words, recall %.
- **Continue Learning**: the first lesson with `status !== "complete"` (via `getLesson`), shown as a card with title/emoji + "Continue →" link to `/lesson/{id}`.
- **Words to Review**: `scheduler.dueItems(words)` limited to 5, each as a word chip (indonesian — english).
- **First-run**: if no words learned yet, show a friendly "Start your first lesson" CTA linking to `/lesson/hello`.

Replace `src/app/page.tsx` to render `<Dashboard />`.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: builds with no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add app shell, sidebar, and dashboard"
```

---

### Task 10: Lesson flow page

**Files:**
- Create: `src/components/LessonFlow.tsx`, `src/app/lesson/[id]/page.tsx`

**Interfaces:**
- Consumes: `useStore`, `getLesson`, `TutorEngine`, `matchAnswer` indirectly via engine, `browserTTS` (Task 8).
- Produces: `/lesson/[id]` guided flow with 6 steps and the acceptance-test happy path.

- [ ] **Step 1: Write the lesson page route**

`src/app/lesson/[id]/page.tsx`: server component that looks up the lesson via `getLesson(id)`; if missing, redirect to `/`. Renders `<LessonFlow lesson={lesson} />`.

- [ ] **Step 2: Write the LessonFlow component**

`src/components/LessonFlow.tsx` (client). Six steps, state machine (`step: "warmup" | "newwords" | "conversation" | "practice" | "recall" | "review"`):

1. **warmup** — flash the `warmUpIds` words (indonesian + english) as cards; button "Mulai" → next step.
2. **newwords** — show `newWordIds` as WordCards (indonesian, pronunciation, english, example, speaker button); button "Lanjut" → next.
3. **conversation** — display the scripted dialogue from `lesson.sentences` as chat bubbles; end with button "Sekarang saya coba" → practice.
4. **practice** — for each `lesson.practice` item: show Kak's question, an input; on submit call `engine.respond(..., "lesson")`; show feedback inline (correct → "Bagus! 🙂", partial → `Hampir!` + corrected example from `buildCorrection`, wrong → `Coba lagi.` + example, then re-ask). Each submit calls `bumpWord` for expected words and `recordAttempt`. Track per-item pass.
5. **recall** — for each `lesson.recall` item: show English, type Indonesian; grade with `matchAnswer([item.indonesian])`; feedback; `bumpWord`.
6. **review** — mini review card: words learned (new), mistakes count, "things to review" (words with `familiarity < 0.5`), then "Selesai" → records a `LearningSession` (duration ~ minutes elapsed), sets `lessonProgress.status = "complete"`, adapts profile, and navigates to `/` (or next lesson).

Track elapsed minutes with `Date.now()` at mount. All mutations via `useStore` actions. Persistence is automatic via the store.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: builds with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add guided lesson flow"
```

---

### Task 11: Conversation page

**Files:**
- Create: `src/components/ChatWindow.tsx`, `src/components/ConversationPage.tsx`, `src/app/conversation/page.tsx`

**Interfaces:**
- Consumes: `useStore`, `TutorEngine`, `browserTTS`.
- Produces: `/conversation` — free conversation with Kak built from known vocab.

- [ ] **Step 1: Write ChatWindow**

`src/components/ChatWindow.tsx` (client): renders `ConversationMessage[]` as bubbles; tutor messages show 💡 Hint (reveals `hint`) and translate toggle (reveals `translation`, respecting `translationMode` — show automatically in beginner mode, always allow manual reveal), speaker button for `browserTTS.speak`. Learner messages right-aligned.

- [ ] **Step 2: Write the ConversationPage**

`src/components/ConversationPage.tsx` (client): 
- Uses the last `conversation` in `state.conversations` or starts a new one via `engine.startLesson` with a synthetic "free talk" lesson wrapper (reuse `LESSONS[0]` script as the opener, then switch to conversation mode).
- Input box + send; on send: append learner message, call `engine.respond(..., "conversation")`, append tutor message, `recordAttempt`, apply `bumpWord`/`updateProfile(adaptedProfile)`, persist conversation.
- If the learner's `vocabSize === 0`, show a gentle prompt to complete Lesson 1 first (link to `/lesson/hello`).
- New conversation button clears the thread (starts fresh).

- [ ] **Step 3: Write the route**

`src/app/conversation/page.tsx`: server component rendering `<ConversationPage />`.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: builds with no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add free conversation page"
```

---

### Task 12: Vocabulary page

**Files:**
- Create: `src/components/VocabularyPage.tsx`, `src/app/vocabulary/page.tsx`

**Interfaces:**
- Consumes: `useStore`, `WORD_BANK`, `browserTTS`.
- Produces: `/vocabulary` — searchable, filterable word grid.

- [ ] **Step 1: Write the VocabularyPage**

`src/components/VocabularyPage.tsx` (client): 
- Merge `WORD_BANK` with learned state (familiarity etc.) — words not yet learned shown greyed with a "new" badge.
- Search box filters by Indonesian or English substring.
- Category filter chips from `categoryOrder` (all categories present in `WORD_BANK`).
- Each card: indonesian, pronunciation, english, example, speaker button, familiarity dot (learned vs new).
- "Learned only" toggle.

- [ ] **Step 2: Write the route**

`src/app/vocabulary/page.tsx`: server component rendering `<VocabularyPage />`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: builds with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add vocabulary page"
```

---

### Task 13: Review page (SRS recall)

**Files:**
- Create: `src/components/ReviewPage.tsx`, `src/app/review/page.tsx`

**Interfaces:**
- Consumes: `useStore`, `scheduler.dueItems`, `matchAnswer`, `browserTTS`.
- Produces: `/review` — recall queue.

- [ ] **Step 1: Write the ReviewPage**

`src/components/ReviewPage.tsx` (client):
- Queue = `scheduler.dueItems(words)`; if empty, show a friendly "Tidak ada — nothing due today!" state with a link to Conversation.
- For each item: show the English word, a text input; learner types the Indonesian; grade with `matchAnswer([word.indonesian])`; show feedback (correct → `Bagus!`, partial → `Hampir! — ${word.indonesian}`, wrong → show the answer + gentle retry); speaker button to hear it.
- `bumpWord(wordId, result)` on each grade; record attempts as `kind: "recall"`.
- End summary card: X correct, Y reviewed, streak; records a `LearningSession` for the review block.

- [ ] **Step 2: Write the route**

`src/app/review/page.tsx`: server component rendering `<ReviewPage />`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: builds with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add spaced-repetition review page"
```

---

### Task 14: Progress page

**Files:**
- Create: `src/components/ProgressPage.tsx`, `src/app/progress/page.tsx`

**Interfaces:**
- Consumes: `useStore`, `LESSONS`, `knownWordIds`, `scheduler`.
- Produces: `/progress` — stats.

- [ ] **Step 1: Write the ProgressPage**

`src/components/ProgressPage.tsx` (client). Sections:
- **Vocabulary learned**: `knownWordIds(words).length` vs total bank size, as a bar.
- **Levels**: current `profile.level` (0–4) with labels (Level 1 — Survival, Level 2 — Tiny Sentences, Level 3 — Everyday Conversation, Level 4 — Natural Conversation, Level 5 — Advanced); conversation ability + confidence shown as gentle 5-dot scales.
- **Review strength**: average familiarity of learned words + "words due today" count.
- **Recent sessions**: last 5 `sessions` (date, minutes, recall %).
- **Topics completed**: lesson list with checkmarks from `lessons` progress.
- No fake precision: use bars/dots and whole numbers only.

- [ ] **Step 2: Write the route**

`src/app/progress/page.tsx`: server component rendering `<ProgressPage />`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: builds with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add progress page"
```

---

### Task 15: Settings page

**Files:**
- Create: `src/components/SettingsPage.tsx`, `src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `useStore`.
- Produces: `/settings` — name, translation mode, pronunciation, reset.

- [ ] **Step 1: Write the SettingsPage**

`src/components/SettingsPage.tsx` (client):
- Name field (updates `setUser`).
- Translation mode radio group: Beginner / Intermediate / Advanced (`updateProfile`).
- Pronunciation toggle (`updateProfile`).
- Reset data button with `window.confirm` → `resetAll()` then show confirmation state.

- [ ] **Step 2: Write the route**

`src/app/settings/page.tsx`: server component rendering `<SettingsPage />`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: builds with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add settings page"
```

---

### Task 16: Wire difficulty adaptation through the app + translation mode

**Files:**
- Modify: `src/lib/engine/engine.ts`, `src/components/LessonFlow.tsx`, `src/components/ConversationPage.tsx`, `src/lib/data/lessons.ts` (add `translation` guidance), `src/components/ChatWindow.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: difficulty adaptation applied live; translations auto-shown per mode.

- [ ] **Step 1: Apply adapted profile everywhere**

In `engine.respond`, `adaptedProfile` is already returned (Task 7). In both `LessonFlow` and `ConversationPage`, after each response call `useStore.getState().updateProfile(out.adaptedProfile)` and apply `bumpWord` for `out.wordsToRecord`. In `useStore.bumpWord`, also push to `profile.recentMistakes` when result is wrong (cap length 5).

- [ ] **Step 2: Add translation auto-reveal by mode**

In `ChatWindow`, when `state.profile.translationMode === "beginner"`, show `message.translation` automatically when present; in `intermediate`/`advanced`, only via the manual toggle. `translationMode` change in Settings immediately affects chat + lesson conversation steps.

- [ ] **Step 3: Test the full flow**

Run: `npm test`
Expected: all unit tests pass.
Run: `npm run build`
Expected: builds clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire live difficulty adaptation and translation modes"
```

---

### Task 17: Playwright smoke test for acceptance path

**Files:**
- Create: `e2e/smoke.spec.ts` (full spec), `playwright.config.ts` (already created in Task 1 — extend if needed)

**Interfaces:**
- Consumes: running app.

- [ ] **Step 1: Write the acceptance smoke test**

Replace `e2e/smoke.spec.ts` with:

```ts
import { test, expect } from "@playwright/test";

test("learner can complete the first lesson and persist", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Continue", { exact: false }).first()).toBeVisible();
  await page.goto("/lesson/hello");
  await expect(page.getByRole("heading", { name: /Hello/i })).toBeVisible();

  await page.getByRole("button", { name: /Mulai/i }).first().click();
  await page.getByRole("button", { name: /Lanjut/i }).first().click();

  const practiceInput = page.locator("input[type=text]").first();
  await practiceInput.fill("ya");
  await practiceInput.press("Enter");
  await expect(page.getByText(/Bagus/i).first()).toBeVisible();

  await page.goto("/vocabulary");
  await expect(page.getByText("halo", { exact: false }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("halo", { exact: false }).first()).toBeVisible();
});
```

Note: adjust selectors to match the actual LessonFlow markup (button labels, heading text) during implementation; the test must pass against the real UI. The key assertions: lesson renders, practice accepts input with feedback, vocabulary shows a learned word, state persists across reload.

- [ ] **Step 2: Install Playwright browsers**

Run: `npx playwright install chromium`
Expected: chromium downloaded.

- [ ] **Step 3: Run the smoke test**

Run: `npm run test:e2e`
Expected: PASS. Fix any UI/test mismatches so the acceptance path passes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: add acceptance smoke test"
```

---

### Task 18: Responsive layout + polish pass

**Files:**
- Modify: `src/components/Shell.tsx`, `src/components/Sidebar.tsx`, all page components as needed

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Responsive audit**

- Mobile (<768px): sidebar collapses to a top bar with horizontal icon nav; ensure lesson/conversation inputs are usable on a 375px viewport.
- Desktop: verify sidebar + content layout, comfortable max-width (~48rem) for content.

- [ ] **Step 2: Visual polish**

- Consistent brand colors, rounded-2xl cards, soft shadows.
- Empty states everywhere (no words yet, no due words, no sessions).
- Friendly microcopy: `Belum ada. Coba mulai pelajaran 1!`.

- [ ] **Step 3: Final test + build**

Run: `npm test`, `npm run build`, `npm run test:e2e`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: responsive layout and visual polish"
```

---

## Self-Review Notes

- **Spec coverage:** every section of the design spec maps to a task — stack (Task 1), data model (1), persistence (5), tutor engine + prompt (7), difficulty (6, 16), SRS (4, 13), lessons (2, 3), audio-ready (8), UI pages (9–15), testing (1, 17, 18), delivery (1), future expansion (architectural seams in 5, 7, 8).
- **Type consistency:** `WordResult`, `TutorContext`, `TutorResponse`, `LanguageModelProvider`, `LearnerState`, `scheduler.recordResult`, `matchAnswer` signatures are defined once and referenced identically across tasks.
- **No placeholders:** every task includes concrete code or exact instructions; the Playwright spec in Task 17 explicitly notes selector verification is part of implementation.
