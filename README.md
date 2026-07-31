# Indo Tutor

A patient Indonesian tutor that adapts to you. Built with Next.js, TypeScript, Tailwind CSS, and Zustand.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## Tests

Unit tests (Vitest):

```bash
npm test
```

End-to-end tests (Playwright):

```bash
npm run test:e2e
```

## AI provider

The app works fully offline using a built-in scripted tutor — no configuration required.

Optionally, it can use an OpenAI-compatible provider. Copy `.env.example` to `.env.local` and fill in:

- `OPENAI_API_KEY` — your API key
- `OPENAI_BASE_URL` — the provider base URL (defaults to `https://api.openai.com/v1`)
- `OPENAI_MODEL` — the model name (defaults to `gpt-4o-mini`)

These variables are optional. When not set, the app uses the built-in offline scripted tutor.
