# Kak — Research-Backed Evaluation, Comparison & Prioritized Plan

**Date:** 2026-08-05
**Scope:** Audit of the current Indonesian tutor app, evidence-based learning-science brief, competitor analysis, and a prioritized implementation plan.

---

## 1. Verdict

Kak is **moderately effective** today: strong for very-early A1 vocabulary and habit formation, weak for durable retention, adaptive difficulty, and spoken competence. The lesson micro-cycle (present → practice → produce → retrieve → review) is scientifically sound; the content is well-curated and thematically grouped. The weaknesses are concentrated in the spaced-repetition core, the disconnected AI conversation, and the absence of real listening/speaking practice.

## 2. Audit findings (evidence in code)

| Dimension | Rating | Key findings |
|---|---|---|
| Learning flow | ★★★★☆ | Sound 6-step cycle (`LessonFlow.tsx`): warmup → new words → input → guided production → retrieval → review. Cumulative curriculum, enforced by tests. Fixed linear path though. |
| Difficulty progression | ★★☆☆☆ | `currentDifficulty` only widens a sentence word-budget; never changes content. All words `level:0`. `sameMistakeCount` computed but unused. |
| Motivation / habits | ★★★☆☆ | Non-punitive streak + 5-min goal (Fogg-style). BUT AI conversation creates no sessions → chatting counts as "0 minutes". |
| Memory retention | ★★☆☆☆ | Real expanding intervals `[0,1,3,7,14,30]`, but `INTERVALS[0]=0` schedules first re-check next-day; `partial` doesn't reset streak; familiarity has no time decay; no priority ordering or daily cap; failed words never re-tested in-session. |
| Speaking / listening | ★★☆☆☆ | Reading+writing real. Listening = manual per-utterance TTS only, no autoplay/shadowing/listen-first. **No ASR** — "speaking" is typing. `SpeakButton` returns `null` without an `id-ID` voice. |
| Vocabulary | ★★★☆☆ | Thematic, contextual, images, pronunciation, examples — excellent base. No frequency ordering; no spaced *introduction*. |
| Grammar | ★★★☆☆ | Implicit-by-design (smart for Indonesian), but notes are word glosses; genuinely tricky structures (tidak/bukan, di/ke/dari, meN- verbs, -nya) never covered. `state.grammar` is dead code. |
| Pronunciation | ★★★☆☆ | Curated pronunciation strings + TTS. No minimal-pair drilling; OS-dependent. |
| Review & testing | ★★☆☆☆ | Mistakes tracked but not recycled; `recentMistakes` cap 5, used for nothing. `partial` inflates streaks. |
| Progress tracking | ★★★☆☆ | Honest daily stats. "learned" (touched) vs "strength" (familiarity) conflated; 6 profile fields initialized but never updated. |
| Navigation / UX / a11y | ★★★☆☆ | Polished, cohesive UI. Gaps: `<html lang="en">`; inputs are placeholder-only (no labels); decorative waveform read as audio; muted-on-mist contrast risks. |
| AI tutor | ★★★★☆ prompt / ★★☆☆☆ loop | Exemplary gentle prompt + real learner context. **Broken loop:** `expectedWords` from AI replies are never parsed → conversation produces no attempts, no SRS bumps, no sessions, no adaptation. |

## 3. Learning-science evidence summary (selected)

- **Spaced retrieval** — strongest general effect (Cepeda et al., 2006, *Psych. Bulletin*); SM-2 (Wozniak 1990) / FSRS are the practical standards. **Highest-priority fix.**
- **Retrieval practice / testing effect** — Roediger & Karpicke (2006); Karpicke & Roediger (2008, *Science*). Make exercises productive, not recognition.
- **Error-driven restudy** — Rowland (2014): re-testing errors within a session is one of the strongest retention effects. → in-session recycling.
- **Interleaving** — Rohrer & Taylor (2007); mix patterns/items in review.
- **Comprehensible input is necessary, not sufficient** — Krashen (1985) vs Swain (1985) output hypothesis; pair input with production + feedback.
- **Frequency-based vocabulary** — Nation (2006): top ~1,000 families ≈ 70–85% of text; 2,000–3,000 for basic conversation. Order content by frequency.
- **Chunks / formulaic sequences** — Pawley & Syder (1983), Wray (2002): teach phrases as units; make phrases the SRS unit.
- **Explicit grammar helps adults** — Norris & Ortega (2000) meta-analysis; brief just-in-time bites, never standalone lectures.
- **Selective prompt-based error correction** — Lyster & Ranta (1997); Li (2010): recasts underused; gentle prompts better.
- **Shadowing** — Arnaud (1974), interpreter training; modest but useful for prosody.
- **Habits** — Lally et al. (2010) ~66 days; streaks drive consistency, not retention; keep non-punitive.
- **Cognitive load** — Sweller (1988), Mayer (2009): one concept per screen, synchronized audio/text, no seductive detail.
- **Adults are not toddlers** — DeKeyser (2000), Newport (1990): adults need explicit+implicit blend, not input-only immersion.
- **Ignore:** learning styles (Pashler et al., 2008 — myth); heavy gamification as core (Deci 1971; Hamari et al., 2014); grammar-translation-only; recognition-only multiple choice as the main task.

## 4. Competitor synthesis (what to take / ignore)

**Strongest stealable mechanisms:** (1) SRS at the core (Anki/Pimsleur/Memrise/Babbel); (2) anticipate-then-verify production before reveal (Pimsleur); (3) cloze-in-sentence-context for words AND morphology (Clozemaster — perfect for Indonesian `me-/ber-/ter-`); (4) i+1 input with tap-to-save → SRS (LingQ); (5) grammar as contextual bites (Babbel); (6) streaks for habit, not points (Duolingo's habit layer only); (7) image→word mapping for concrete nouns only (Rosetta Stone); (8) native-audio shadowing (Memrise); (9) peer/AI feedback on production (Busuu); (10) interleaving (Duolingo).

**Ignore:** recognition-only MC as primary; XP/leagues/hearts; mnemonic "mems" as primary strategy; learning-style personalization; translation-free purism for morphology.

**Indonesian-specific:** orthography is near-phonetic → start print early (motivational win). No conjugation/gender → early production possible → output+feedback loops are high-return. Real difficulty is Austronesian morphology (`me-/ber-/ter-/di-`, `-kan/-i`, reduplication) → root-family cloze drills multiply vocabulary fastest.

## 5. Prioritized implementation plan

**P0 — Learning core (implement now):**
1. SRS engine overhaul: same-day first re-check, `partial` resets streak, time-decayed retention estimate + priority-ordered due queue + daily cap (FSRS-lite).
2. Within-session recycling of missed words (ReviewPage + LessonFlow recall).
3. Matcher negation/near-miss detection.
4. Close the AI→SRS loop (parse `expectedWords`, grade attempts, `addSession` from conversation).

**P1 — Curriculum depth (implement now):**
5. Frequency ranks + levels on words; order vocabulary and prioritize introductions.
6. Active warmup (self-test before reveal) + interleaved prior-lesson words in recall.
7. Real grammar notes for the genuinely confusing structures (tidak vs bukan, di/ke/dari, meN-, -nya, reduplication).
8. Conversation sessions counted in habits (streak/goal).

**P2 — Features:**
9. Quick Translate page (mini-dictionary over word bank + AI fallback).
10. Listening-first/shadowing scaffold + ASR-ready architecture (Web Speech API) — forward-compatible.

**P3 — Polish:**
11. A11y: `lang="id"` on Indonesian text, labels on inputs, contrast fixes.
12. Delete or compute dead profile fields; honest "learned" vs "strong" metrics.

---

## 6. Deliverables status

- [x] Audit report (this doc §2; full brief in `docs/research/language-learning-brief.md`)
- [x] Research summary with citations (this doc §3; full in `docs/research/language-learning-brief.md`)
- [x] Comparison against leading platforms (§4; full in `docs/research/competitor-comparison.md`)
- [x] Prioritized implementation plan (§5)
- [x] Completed code changes — P0 (SRS overhaul, in-session recycling, negation guard, AI→SRS loop), P1 (frequency ranks, active warmup, grammar bites), Quick Translate
- [x] Documentation for every major feature (`docs/features/learning-system.md`)
- [x] Test results + performance benchmarks (`docs/verification-report.md`)
- [x] Accessibility review (`docs/accessibility-review.md`)
- [x] Future enhancement suggestions (verification report §Known trade-offs; audit-and-plan §5 P2/P3)
