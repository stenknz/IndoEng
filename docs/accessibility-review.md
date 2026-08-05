# Accessibility Review

**Date:** 2026-08-05
**Scope:** WCAG 2.1 AA conformance review of the Kak app after the learning-core and UX work.

## Done in this pass

- **Language of content (3.1.1 / 3.1.2):** every Indonesian utterance is wrapped in `lang="id"` (chat bubbles, lesson new-word cards, warmup words). The UI chrome remains `lang="en"` (`<html lang="en">`), which is correct since the interface is English.
- **Input labels (1.3.1 / 4.1.2):** every text input now has an `aria-label` — practice, recall, review, conversation, vocabulary search, translate search.
- **Keyboard navigation:** all interactive elements are native `<button>`/`<Link>`/`<input>` (focusable by default); focus-visible rings are defined globally in `globals.css`.
- **Reduced motion:** global `@media (prefers-reduced-motion: reduce)` disables animations/transitions.
- **Contrast:** brand colors were audited during the redesign — `canopy-600` (#0E6B55) on white ≈ 7.5:1; `muted` (#5F736B) on white ≈ 5:1; amber text uses `marigold-700` (#A16207, ≈ 4.5:1 on light backgrounds). `text-muted` on `mist` panels remains a documented caution (see below).
- **Images:** all `WordImage`s have `alt` = English meaning; decorative `Icon`s and `Waveform` marks are `aria-hidden`.

## Known remaining gaps (future work)

1. **Live region for TTS/speech:** speak actions are not announced via an aria-live region; a "listening" announcement would help screen-reader users.
2. **Contrast on `text-muted` over `bg-mist/70`:** some small secondary text (e.g., example translations, dashboard stats) may fall slightly below 4.5:1 on `mist` panels. Risk is low (muted ≈ 4.9:1 on white) but should be re-verified with a contrast tool.
3. **Focus management in the Modal** (settings reset): focus is not trapped/returned after close. Should add a focus-trap or return focus to the trigger.
4. **`autoFocus` on review input** is convenient but can be disorienting for screen-reader users; consider removing or making it configurable.
5. **Audio fallback:** `SpeakButton` renders `null` when no `id-ID` TTS voice exists — the audio affordance silently disappears. A recorded-native-audio fallback (or a disabled-but-visible button) is planned.
6. **Touch targets:** small text chips (synonyms/related words in Translate) are ~24px; the WCAG 2.2 target-size AA (24px minimum) is borderline.

## Verification method
Contrast values computed from the `tailwind.config.ts` palette. Keyboard reachability and label presence confirmed via code review; a full axe/Pa11y automated scan is recommended before release.
