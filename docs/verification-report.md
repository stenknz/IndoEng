# Verification Report

**Date:** 2026-08-05
**Scope:** Final verification of the learning-core, curriculum, and Quick Translate work.

## Test results

| Check | Command | Result |
|---|---|---|
| Type check | `npx tsc --noEmit` | ✅ clean |
| Unit tests | `npx vitest run` | ✅ **84 passed** (13 files) |
| Production build | `npm run build` | ✅ clean (13 routes) |
| E2E smoke | `npm run test:e2e` | ✅ 2/2 passed (dashboard + lesson completion flow) |

## New tests added

- `tests/srs.test.ts` — same-day re-check interval, partial resets streak, retention decay, weakest-first ordering, daily cap.
- `tests/engine.test.ts` — negation guard (negated answer not correct; negative expected allowed).
- `tests/openaiMessages.test.ts` — `expectedWords` parsed from AI replies; malformed values ignored.
- `tests/dictionary.test.ts` — bilingual search, exact-match ranking, synonym/alternative matching, empty/limit behavior.
- `tests/words.test.ts` — unique frequency ranks within [1, 85].
- `tests/wordImages.integrity.test.ts` — every concrete word has an image, abstract words don't, all paths resolve, no orphans (added in the image feature).

## Performance

- Word images: 47 photos ≤800px, ~16 MB total in `public/images`, all `loading="lazy"` + `decoding="async"` via `next/image`.
- Dictionary: 130 entries, linear scan per keystroke — trivial (<1 ms) at this size; memoized in the page via `useMemo`.
- App bundle unchanged structurally; static prerender for all routes except lesson/conversation pages.

## Compatibility (Phase 9)

- No guiding copy changed; `e2e/smoke.spec.ts` untouched and green.
- Existing store, provider, and lesson-data contracts preserved; `frequency`/`image` fields are additive with defaults in `emptyWord`.
- `localStorage` persistence architecture unchanged (older saved states remain readable).

## Known trade-offs / future work

1. **Retention model is FSRS-lite**, not full FSRS: no per-card stability/elapsed tracking; the exponential decay uses streak-scaled half-lives. Good enough to order the queue; a full FSRS port is a clear next step.
2. **AI-graded conversation** grades against `expectedWords` only when the model emits them (prompt mandates it, but fallback to no grading is safe).
3. **Adaptive content**: `currentDifficulty` still widens sentence budget rather than reshaping lesson content; per-word `level` is populated but unused for selection. Wiring level into lesson/word selection is the natural next increment.
4. **Listening/speaking**: TTS-only today; an ASR (Web Speech API) listen-and-repeat mode and recorded native audio are the highest-value additions next.
