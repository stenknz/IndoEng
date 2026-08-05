# Competitor Analysis — Leading Language Platforms

**Date:** 2026-08-05
**Purpose:** Extract the strongest underlying learning mechanics (never the interfaces) for the Kak Indonesian tutor.

## Per-app mechanics

| App | Effective mechanism | Where it fails | Strongest stealable idea |
|---|---|---|---|
| Duolingo | Short daily sessions; interleaved old+new retrieval; streak habit | Recognition-heavy, shallow; progress via pattern-gaming; XP/leagues drive activity not learning | Interleaving mixed old+new in short sessions — keep production, not MC |
| Babbel | Real-world dialogues; revision manager (SRS); explicit grammar bites in context | Self-study can't force spontaneous speech; phrase-level ceiling | Grammar as 30-second bites attached to a concrete dialogue |
| Busuu | Community/peer feedback on learner production | Asynchronous, inconsistent quality | Human/AI feedback on one production per day |
| LingQ | Mass i+1 input; tap-to-save unknown words → SRS | Zero structured output; speaking lags | Known-word counter feeding SRS |
| Pimsleur | Audio-first; anticipate-then-verify; graduated-interval in-session recall | Slow vocab growth; grammar unexplained | Within-session spacing of spoken reps + "say it before you hear it" |
| Rosetta Stone | Direct image→word mapping | Can't picture abstract grammar/morphology | Image-mapping for concrete nouns only |
| Memrise | Native-video models for pronunciation + shadowing; mnemonic hooks | Mems decay/mis-cue; leaderboards encouraged cheating | Native-audio models for pronunciation |
| Anki | Pure per-card SRS (SM-2 → FSRS) | Cold cards lack context | The scheduling algorithm itself |
| Clozemaster | Cloze (fill-in-the-blank) retrieval in real sentences | Still recognition-leaning; no speech | Cloze as the core exercise — ideal for Indonesian affixes |

## Synthesis — the 10 strongest concepts to adopt
1. **SRS at the core** (Anki/Pimsleur/Memrise/Babbel) → implemented in `scheduler.ts`.
2. **Anticipation/production before reveal** (Pimsleur) → warmup self-test, typed recall.
3. **Cloze-in-sentence-context** (Clozemaster) → recommended next exercise type for `me-/ber-/ter-` morphology.
4. **i+1 input with tap-to-save** (LingQ) → dictionary + conversation reuse.
5. **Grammar as contextual bites** (Babbel) → `grammarNote` pattern tips.
6. **Streaks for habit, not points** (Duolingo) → non-punitive streak, 5-min goal, no XP.
7. **Native-audio shadowing** (Memrise/Pimsleur) → TTS; ASR listen-and-repeat forward-compatible.
8. **Feedback on production** (Busuu) → AI tutor grades conversation into SRS.
9. **Image-mapping for concrete nouns** (Rosetta Stone) → 47 word photos.
10. **Interleaving** (Duolingo) → priority-ordered mixed review queue.

## Weakest ideas to ignore
- Recognition-only multiple choice as the main exercise.
- XP/leagues/hearts gamification.
- Mnemonic "mems" as a primary strategy.
- Learning-style personalization.
- Translation-free purism for morphology (Indonesian affixes need L1 explanations).

## Indonesian-specific implications
- Near-phonetic orthography → teach reading immediately (big motivational win).
- No verb conjugation/gender/plurals → learners can produce grammatical sentences very early → output + feedback loops are unusually high-return.
- Real difficulty is Austronesian morphology (`me-/ber-/ter-/di-`, `-kan/-i`, reduplication) → root-family cloze drills multiply vocabulary fastest; `jalan` vs `jalan-jalan` type pairs belong in the dictionary.
