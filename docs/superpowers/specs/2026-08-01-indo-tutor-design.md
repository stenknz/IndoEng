# Indonesian Tutor ("Kak") — Design Spec

**Date:** 2026-08-01
**Status:** Approved

## 1. Purpose

A polished, focused web app that acts as a personal Indonesian language tutor. It
teaches via natural, comprehensible conversation rather than worksheets, starts at
an extremely beginner level, and adapts difficulty to the learner. Version 1 is a
complete, usable learning loop; the architecture is built so a much more
sophisticated tutor (voice, AI providers, stories, culture, DB persistence) can be
layered on later without rewriting the UI.

### Non-goals for V1
- No Duolingo-style gamification (no avatars, coins, badges, energy systems).
- No AI API requirement — the app must work fully offline.
- No voice input / speech recognition (TTS pronunciation playback is included,
  optional, behind an abstraction).
- No user accounts, cloud sync, or server database (local persistence only).
- No advanced colloquial/slang/culture/story content (structure reserved only).

## 2. Core Experience

- The tutor, **Kak**, speaks extremely simple Indonesian (like speaking to a
  toddler learning first words), reuses known vocabulary, and only adds new
  material gradually.
- Feedback is useful, not empty praise: `Hampir! 😊 "Saya minum air." "Saya makan
  nasi."` followed by a fresh question. Mistakes are handled with a short
  correction, an example, and a retry — never a grammar lecture.
- English translations are shown for beginners and gradually reduced as the
  learner improves; the learner can always manually reveal a translation or a
  💡 hint.
- A session takes 5–15 minutes and follows a consistent lesson flow.

## 3. Tech Stack

- **Next.js 15** (App Router), **TypeScript**, **React 19**.
- **Tailwind CSS** for styling (no UI kit; hand-rolled components).
- **Zustand** for client state, hydrated from and written to local persistence.
- **Vitest** for unit tests (engine, SRS, difficulty). **Playwright** for a smoke
  test of core flows.
- No other runtime dependencies.

### Scripts
- `npm run dev` — start dev server.
- `npm run build` / `npm run start` — production build/run.
- `npm run test` — Vitest unit tests.
- `npm run test:e2e` — Playwright smoke test.

## 4. Directory Layout

```
src/
  app/                     # App Router routes
    layout.tsx             # root layout + sidebar shell
    page.tsx               # / — Dashboard (Learn)
    lesson/[id]/page.tsx   # /lesson/[id] — guided lesson flow
    conversation/page.tsx  # /conversation — chat with Kak
    vocabulary/page.tsx    # /vocabulary — word grid
    review/page.tsx        # /review — SRS recall queue
    progress/page.tsx      # /progress — stats
    settings/page.tsx      # /settings — name, translation mode, reset
  components/              # Sidebar, ChatWindow, WordCard, LessonStep, widgets
  lib/
    types/                 # all data-model interfaces
    data/
      words.ts             # full word bank (categorized, level-tagged)
      lessons.ts           # 12 authored lessons
      scenarios.ts         # scripted conversation scripts for lessons
      tutorPrompt.ts       # dedicated AI tutor system prompt (for later LLM use)
    store/                 # Store interface + LocalStorageStore + hydration
    srs/                   # spaced-repetition scheduler
    difficulty/            # learner model + simplification ladder
    engine/                # TutorEngine (lesson flow + free conversation)
    providers/             # LanguageModelProvider + Scripted + OpenAICompatible
    audio/                 # SpeechProvider + browser TTS implementation
    utils/                 # matching, formatting, small helpers
tests/                     # vitest specs
e2e/                       # playwright smoke spec
```

## 5. Data Model

All types in `src/lib/types/`. Plain TS interfaces, serializable, versioned under
a single store key for future migration.

- **User**: `{ name, createdAt }`.
- **LearningProfile**: level (0–3+), translationMode (`beginner|intermediate|advanced`),
  learner-model stats: `vocabKnowledge, grammarKnowledge, conversationAbility,
  readingAbility, listeningAbility, recentMistakes, confidence, currentDifficulty,
  lastAnswerAccuracy, consecutiveCorrect`.
- **VocabularyWord**: `{ id, indonesian, english, pronunciation, example,
  exampleTranslation, category, level, familiarity (0–1), exposures, correct,
  mistakes, lastReviewed, nextReview, streak }`.
- **GrammarConcept**: `{ id, name, description, exposedAt, mastered }` (reserved
  for future implicit→explicit grammar).
- **Lesson**: `{ id, title, emoji, level, order, newWordIds[], warmUpIds[],
  sentences[], script[], practice[], recall[], reviewNote }`.
- **LessonProgress**: `{ lessonId, status: 'not_started'|'in_progress'|'complete',
  completedAt, attempts }`.
- **Conversation / ConversationMessage**: chat transcript; message has
  `kind` (`tutor|learner|system`), optional `hint`, `translation`.
- **PracticeAttempt**: `{ id, ts, kind: 'lesson'|'conversation'|'recall'|'vocab',
  prompt, learnerAnswer, expected, correct: boolean|'partial', wordId? }`.
- **ReviewItem**: `{ wordId, due, intervalDays }`.
- **LearningSession**: `{ id, ts, durationMin, wordsReviewed, newWords, recallRate }`.

## 6. Persistence

A single `Store` interface exposes all reads/writes (profile, words, lessons,
progress, sessions, conversations, attempts). `LocalStorageStore` implements it
behind a namespaced key (e.g. `indo-tutor:v1`). A `useStore` Zustand hook holds
the reactive copy; mutations go through store methods and persist synchronously.
Replacing local storage with a DB later = new `Store` implementation; consumers
are unchanged.

## 7. Tutor Engine

### Provider abstraction
```
LanguageModelProvider.generate(ctx: TutorContext): Promise<TutorResponse>
```
- **ScriptedProvider** (V1 default): deterministic, offline, fully testable.
  - *Lesson scenarios:* authored `scenario` scripts per lesson with branching
    steps; each step may expect a learner answer and is evaluated by the matcher.
  - *Free conversation:* template-based generation. Builds questions from
    vocabulary the learner actually knows (familiarity ≥ threshold), e.g.
    `Ini apa?`, `Kamu suka X?`, `Kamu makan apa?`. Parses learner answers for
    yes/no (ya/tidak), vocabulary hits, and partial matches.
  - *Mistake handling:* partial-credit matching → `Hampir!` + minimal
    correction + one more example + a retry prompt.
- **OpenAICompatibleProvider**: reserved; selected when `OPENAI_API_KEY` is set.
  Uses `OPENAI_BASE_URL` (OpenAI-compatible endpoints) via `fetch`. No UI changes
  required to enable. `tutorPrompt.ts` provides the system prompt.

### TutorPrompt
A dedicated system prompt (`lib/data/tutorPrompt.ts`) encoding the tutor
personality: level-appropriate Indonesian, gradual vocabulary, gentle corrections,
active recall, reuse of known words, no grammar lectures, never overwhelming.

## 8. Difficulty Engine

`lib/difficulty/`:
- **LearnerModel**: computes `vocabSize` (familiarity ≥ 0.5), average familiarity,
  recent accuracy, same-mistake streak, average answer length, translation
  reliance. Produces `currentDifficulty` (0–5) and target sentence complexity.
- **SimplificationLadder**: collapses a target utterance step by step when the
  learner struggles — e.g.
  `Apa yang biasanya kamu lakukan setelah pulang kerja?` → `Kamu kerja?` →
  `Setelah kerja, kamu makan?` → `Kamu makan apa?`.
- Difficulty only **increases after consistent performance** (e.g. ≥ 3 correct in
  a row on current level) and drops immediately after repeated mistakes.

## 9. Spaced Repetition

`lib/srs/`: SM-2-flavoured scheduler.
- Correct → familiarity up, streak up, interval grows (1d → 3d → 7d → 14d → 30d).
- Partial/wrong → familiarity down, nextReview = today/tomorrow, word marked for
  review and re-exposed in upcoming conversation.
- `dueToday` powers the Review queue and the dashboard "Words to Review" list.

## 10. Lessons & Content

Twelve fully-authored beginner lessons (ordered, cumulative vocabulary):
1. Hello (`halo`, `selamat pagi`, `terima kasih`, `sama-sama`, `ya`, `tidak`)
2. My Name (`nama`, `saya`, `kamu`, `siapa`)
3. Numbers 1–10 (`satu`…`sepuluh`, `berapa`)
4. Food (`nasi`, `roti`, `ayam`, `ikan`, `sate`, `makan`, `enak`)
5. Drinks (`air`, `kopi`, `teh`, `susu`, `jus`, `minum`, `mau`)
6. Family (`ibu`, `ayah`, `kakak`, `adik`, `keluarga`)
7. My House (`rumah`, `kamar`, `pintu`, `jendela`, `kamar mandi`, `dapur`)
8. Things I Like (`suka`, `sangat`, `tidak suka`, adjectives)
9. Shopping (`beli`, `berapa harganya`, `murah`, `mahal`, `uang`)
10. Restaurant (`pesan`, `menu`, `makanan`, `minuman`, `tagihan`)
11. Time (`jam`, `pukul`, `hari`, `sekarang`, days)
12. Weather (`hujan`, `panas`, `dingin`, `cuaca`, `cerah`)

Each lesson flow: **Warm-up** (review 3–5 familiar words) → **New Words** (2–5,
each with pronunciation + example) → **Comprehensible Conversation** (scripted
dialog using only known + new words) → **Practice** (simple questions) →
**Recall** (show English → type Indonesian) → **Mini Review** (words learned,
mistakes, progress). Grammar stays implicit; an occasional inline note
(`saya = I`, `makan = eat`) is the most explicit it gets in V1.

## 11. Audio Readiness

`lib/audio/` exposes `SpeechProvider` (`speak(text)`, `supported`). A browser TTS
implementation using the Web Speech API is included (works offline; gracefully
disabled where unsupported). Speaker buttons appear on tutor messages. Later,
speech recognition / pronunciation scoring slot into the same interface.

## 12. UI / Pages

Friendly, modern language-learning-app look. Hand-rolled components, rounded
cards, soft palette, generous whitespace. No enterprise dashboard feel.

- **Shell**: left sidebar — 🏠 Learn, 💬 Conversation, 📚 Vocabulary, 🔄 Review,
  📈 Progress, ⚙️ Settings. Level indicator at top of sidebar:
  `Indonesian Level 1 ███████░░░ 70%`.
- **Dashboard (`/`)**: Today's Learning (minutes, words reviewed, new words,
  recall %), Continue Learning card (next lesson, →), Words to Review list.
- **Lesson (`/lesson/[id]`)**: guided 6-step flow with progress, per-word cards,
  scripted dialog, practice questions, recall input, end-of-lesson mini review
  and "Continue" into next lesson.
- **Conversation (`/conversation`)**: chat with Kak. Free conversation built from
  known vocab. 💡 Hint and translation-reveal affordances; speaker button.
- **Vocabulary (`/vocabulary`)**: searchable, category-filtered grid of learned +
  bank words with familiarity states and example sentences.
- **Review (`/review`)**: recall queue of due words ("water" → type "air"),
  gentle feedback, session end summary.
- **Progress (`/progress`)**: vocabulary learned, current level, conversation
  level, review strength, recent sessions, topics completed. Understandable
  levels, no fake precision.
- **Settings (`/settings`)**: name, translation mode (Beginner/Intermediate/
  Advanced), pronunciation on/off, reset-data with confirmation.

## 13. Testing

- **Vitest (unit):** SRS scheduler math; difficulty adapter (ladder
  simplification, consistent-performance gating); scripted engine matching
  (exact/partial/yes-no), correction output, translation-mode behaviour.
- **Playwright (smoke, one spec):** app starts → dashboard renders → start a
  lesson → complete the new-words + practice steps → vocabulary page shows new
  word → conversation accepts an answer → progress reflects a session →
  reload persists state.
- Manual check: responsive layout at desktop + mobile widths.

## 14. Delivery

- `README.md`: what it is, how to run (`npm install && npm run dev`), how to test,
  how the provider abstraction works, how to add an API key later.
- `.env.example`: `OPENAI_API_KEY`, `OPENAI_BASE_URL` (documented as optional).

## 15. Future Expansion (reserved, not built)

AI providers (OpenAI-compatible, Ollama), AI voice conversations, speech
recognition, pronunciation scoring, stories, images, roleplay/travel modes,
colloquial + regional content, news/YouTube learning, reading/writing practice,
custom/imported vocabulary, culture lessons, multiple languages, accounts, cloud
sync, DB persistence, advanced SRS, personalised curriculum. The provider/store/
audio abstractions above are the seams these attach to.
