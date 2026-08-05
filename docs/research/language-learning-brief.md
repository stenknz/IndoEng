# Evidence-Based Language Learning: Research Brief

**Date:** 2026-08-05
**Purpose:** Ground every design/implementation decision for the Kak Indonesian tutor in established learning science. Compiled from published research (citations inline).

## Techniques graded by evidence strength

| Technique | Evidence | Key citations | Application in Kak |
|---|---|---|---|
| Spaced repetition / spaced retrieval | Strong | Cepeda et al. 2006 (*Psych. Bulletin*, 317-experiment meta); Cepeda et al. 2008 (optimal gap ~10–20% of retention interval); SM-2 (Wozniak 1990); FSRS | `src/lib/srs/scheduler.ts` — expanding intervals, same-day re-check, retention estimate |
| Retrieval practice / testing effect | Strong | Roediger & Karpicke 2006 (*Psych. Science*); Karpicke & Roediger 2008 (*Science*) | Productive typed recall in Review, recall step, warmup self-test |
| Interleaving | Moderate | Rohrer & Taylor 2007; Kornell & Bjork 2008 | Mixed weak/strong due queue ordering |
| Comprehensible input (i+1) | Moderate (necessary, not sufficient) | Krashen 1985; critique: Swain 1985, Long 1996 | Scripted conversation, graded sentences; always paired with output |
| Output hypothesis | Moderate-Strong | Swain 1985/1995 | Every lesson ends in forced production; conversation graded into SRS |
| Shadowing / listen-and-repeat | Moderate | Arnaud 1974 (interpreter training) | TTS repeat buttons; future ASR listen-and-repeat |
| Listening-first / phonological priming | Moderate | Pimsleur 1967 audio-first design | `SpeakButton` TTS; future listen-first mode |
| Frequency-based vocabulary | Strong | Nation 2006 (top ~1,000 families ≈ 70–85% of text); Adolphs & Schmitt 2003; van Zeeland & Schmitt 2013 | `frequency` rank on all words; "Paling sering" sort |
| Chunks / formulaic sequences | Strong for fluency | Pawley & Syder 1983; Wray 2002; Ellis 1996 | Phrases taught as units; dictionary phrases |
| Sentence mining / contextual learning | Moderate | LingQ/Clozemaster practice | Every word has example sentence; cloze-in-context future |
| Explicit grammar for adults | Moderate-Strong | Norris & Ortega 2000 meta-analysis; Ellis 2006 | Just-in-time `grammarNote` bites, never standalone lectures |
| Selective, prompt-based error correction | Moderate | Lyster & Ranta 1997 (recasts produce least uptake); Li 2010; Truscott 1996 | Gentle prompts ("Hampir! Coba lagi"), low-anxiety |
| Visual / imagery mnemonics | Moderate for vocab, weak for transfer | Paivio 1986; Atkinson 1975; Dunlosky et al. 2013 | Word photos for concrete nouns only |
| Habit formation & streaks | Moderate | Lally et al. 2010 (~66 days); streaks drive consistency not retention | Non-punitive streak, 5-min goal |
| Motivation (SDT) | Moderate-Strong | Deci & Ryan 2000; Locke & Latham 2002 goals; Deci 1971 (external rewards can backfire) | Competence progress, no XP/coins/leagues |
| Micro-learning / session length | Moderate | Cepeda et al. 2006 distributed practice | 5-min daily goal, short sessions |
| Cognitive load reduction | Strong for presentation | Sweller 1988; Mayer 2009 | One concept per screen, synchronized audio/text, progressive disclosure |
| Toddler principles | Do NOT copy for adults | DeKeyser 2000; Newport 1990; Chomsky/Lenneberg critical period | Adults need explicit + implicit blend, not input-only |
| Forgetting curve & daily review | Strong | Ebbinghaus 1885; Murre & Dros 2015 | Daily review queue; missed day is recoverable |

## Weak / negative evidence (ignored)
- Grammar-translation-only methods (weak for communication).
- **Learning styles** personalization (Pashler et al. 2008 — myth).
- Heavy gamification as the core mechanic (Deci 1971; Hamari et al. 2014).
- Input-only "immersion" for adults; rote single-word lists without context.
- Recognition-only multiple choice as the primary exercise (gameable, no production).

## Recommended core loop (10 min/day), as implemented
1. **Review due SRS items** (retrieval practice + spacing) — weakest-retention first, missed words recycled in-session.
2. **New content**: sentence-level input at i+1 with TTS + translation.
3. **Produce**: forced typed production, then graded.
4. **Retrieve**: recall step re-tests the session's words.
5. **Adapt**: `currentDifficulty`/`level` follow recent accuracy.

## References
See the inline citations above; full bibliographic details for each are standard in the field (Cepeda 2006, Roediger & Karpicke 2006, Norris & Ortega 2000, Nation 2006, Swain 1985, Lyster & Ranta 1997, Wozniak SM-2, Dunlosky 2013, Lally 2010, Mayer 2009, Pashler 2008).
