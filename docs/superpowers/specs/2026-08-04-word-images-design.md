# Word Images Design

**Date:** 2026-08-04
**Status:** Approved

## Goal

Add curated photos for the concrete vocabulary words in the "Kak" Indonesian
tutor app, shown across the core learning surfaces, with an emoji-chip fallback
for abstract words.

## Decisions (from brainstorming)

- **Source:** curated local photos in `public/images/` (no runtime network calls).
- **Surfaces:** lesson new-word cards, vocabulary page cards, and the
  recall/review prompt panel.
- **Abstract words** (numbers, greetings, likes, questions, yesno) keep the
  existing emoji chip; no forced photos.

## Data model

- Add optional `image?: string` to `VocabularyWord`
  (`src/lib/types/index.ts`), e.g. `"/images/food/nasi.jpg"`.
- ~56 concrete words across 10 categories get an `image` path in
  `src/lib/data/words.ts`: food, drinks, house, places, weather, people,
  family, actions, shopping, restaurant, time.
- `RecallItem` has no `id`; the recall step resolves the image via the existing
  `indonesian -> WORD_BANK` lookup (`src/components/LessonFlow.tsx`).

## Assets

- Images fetched from Wikimedia Commons (CC-licensed) during implementation,
  downscaled to ~640px, saved as `public/images/<category>/<id>.jpg`.
- `public/images/LICENSE.txt` records word -> file -> Commons page -> license.
- Wikimedia Commons fallback path (no API key required, reliable, attribution
  documented) replaces the originally-proposed Unsplash Source (deprecated).

## Component

- New `src/components/WordImage.tsx`:
  - Props: `src?: string`, `alt: string`, `aspect?: "video" | "square"`,
    `className?: string`.
  - `next/image` with `fill` in a fixed-aspect-ratio wrapper (no CLS),
    `loading="lazy"`, `decoding="async"`, shimmer placeholder + subtle
    fade-in (respects `prefers-reduced-motion`), `rounded-xl/2xl` + subtle
    border matching the Card design language.
  - Renders `null` when `src` is undefined; callers keep the emoji fallback.

## Surface integration

1. **Lesson new-word cards** (`LessonFlow.tsx`): full-width
   `aspect-video` image replaces the emoji chip when the word has an image.
2. **Vocabulary cards** (`VocabularyPage.tsx`): `aspect-square` thumbnail
   beside the word heading.
3. **Recall/review prompt** (`LessonFlow.tsx` + `ReviewPage.tsx`): centered
   image inside the existing `bg-mist/70` panel above the English prompt.

## Testing

- Unit: `WordImage` renders `<img>` with src, `null` without, correct alt/aspect.
- Data integrity: concrete words all have `image`; abstract words none; every
  path resolves to an existing file in `public/images/`.
- Existing e2e must remain green (no guiding copy changes); `tsc`, unit tests,
  and production build clean.

## Non-goals

- No image changes to chat bubbles, warmup rows, or dashboard chips.
- No gamification or animation beyond the existing fade-in.
