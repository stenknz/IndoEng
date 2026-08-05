# Feature Documentation

**Date:** 2026-08-05

## Spaced-Repetition Engine (`src/lib/srs/scheduler.ts`)

- Expanding intervals `[0,1,3,7,14,30]` days. `streak 1` schedules a **same-day re-check** (~4h later) instead of tomorrow — the highest-value retrieval opportunity.
- `partial` and `wrong` answers **reset the streak**, so intervals can't inflate from imperfect performance.
- `retentionOf(word, now)` estimates predicted retention in [0,1]: stored familiarity decays exponentially with a **streak-scaled half-life** (12h → 30d). `dueItems` orders the due queue **weakest-first** (FSRS-style) and supports a daily cap.
- Consumed by `ReviewPage` (priority-ordered queue) and `bumpWord` in `useStore`.

## Within-Session Recycling

- **Review (`ReviewPage`)**: a word missed on its first attempt is re-queued to the end of today's session and re-tested before the session ends (error-driven restudy).
- **Lesson recall (`LessonFlow`)**: the same for the recall step, via a mutable working queue seeded from `lesson.recall`.
- Guarded by a per-session Set so a word is recycled at most once (no infinite loops).

## Matcher Negation Guard (`src/lib/engine/matcher.ts`)

- If the learner's answer contains a negation word (`tidak`, `bukan`, `nggak`, `gak`, `jangan`) that was **not** part of the expected answer, the answer is graded `wrong` even if the expected tokens are present ("Saya **tidak** makan ayam" ≠ "makan ayam").
- Negation is allowed when the expected answer is itself negative ("tidak").

## AI Tutor → SRS Loop

- `parseTutorReply` now extracts `expectedWords` from the AI's JSON reply; `openaiCompatibleProvider` forwards them.
- `TutorEngine.respond` filters expected words to known word-bank ids (no SRS pollution), grades the learner's message with the matcher, and returns attempts + word results.
- `ConversationPage` records attempts, bumps SRS words, and now calls `addSession` on leaving the page if the learner sent at least one message — so chat time counts toward the daily goal and streak.

## Quick Translate (`/translate`)

- Mini-dictionary over `src/lib/data/dictionary.ts`: the 85-word bank enriched with word class, synonyms, antonyms, formal/casual register, common expressions, usage notes, and related words, plus ~45 high-frequency phrases (`apa kabar`, `sudah`/`belum`, `bisa`/`boleh`, `pergi`/`pulang`, `di`/`ke`/`dari`, `tolong`, `silakan`, time words…).
- `searchDictionary(q)` is bilingual (matches Indonesian, English, synonyms, alternatives, expressions), ranks exact → startsWith → substring, and dedupes.
- Result cards show pronunciation, word class, meaning + alternatives, example + translation, expression, register, and tappable related/synonym chips that re-search.

## Frequency-Ranked Vocabulary

- Every `VocabularyWord` has a unique `frequency` rank (1 = most frequent, approximating Indonesian corpus frequency for this set).
- `Vocabulary` page adds a **"Paling sering" / "Kategori"** sort toggle (default frequency-first, per Nation 2006).

## Grammar Bites

- `grammarNote` per lesson rewritten from word glosses into genuine pattern explanations: no copula, no tense conjugation, optional plurals, `kakak`/`adik` by age, `mau` + verb, `minta`/`tagihan`, `di`/`ke`/`dari`, possession order.

## Active Warmup

- Warmup rows hide the English meaning; the learner must recall first, then tap to reveal (active retrieval before feedback). ARIA `aria-expanded` on the reveal control.
