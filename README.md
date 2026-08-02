# Kak — Indonesian Tutor

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
npx playwright install
npm run test:e2e
```

## AI provider

The app runs fully offline on a built-in scripted tutor. That is the default and requires no configuration.

The codebase defines a `LanguageModelProvider` seam (`src/lib/engine/provider.ts`) that is ready for an OpenAI-compatible provider later. Wiring one in would require a server-side route (or proxy) so the API key never ships in the client bundle. No such provider is implemented today, and setting an `OPENAI_API_KEY` in your environment does not activate anything.
