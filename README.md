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

## AI tutor (optional)

The app runs fully offline on a built-in scripted tutor — that is the default and
requires no configuration.

You can optionally power free conversation with an **AI tutor via OpenCode Go**
(an OpenAI-compatible endpoint). Set these in a `.env.local` file (never commit
the key), then restart the dev server:

```
OPENCODE_GO_API_KEY=your-opencode-go-api-key
OPENCODE_GO_BASE_URL=https://opencode.ai/zen/go/v1
OPENCODE_GO_MODEL=deepseek-v4-flash
```

- Get a key by subscribing to OpenCode Go at https://opencode.ai/go.
- `OPENCODE_GO_BASE_URL` and `OPENCODE_GO_MODEL` are optional — the values above
  are the defaults.
- The key is only ever read server-side by the `/api/tutor` route; it is never
  shipped to the browser.
- After setting the key and restarting, open **Settings** and switch on **AI
  Tutor**. Free conversation (💬 Conversation) is then handled by the AI; the
  guided lessons stay scripted so progression and word tracking remain reliable.
- If the key is missing, the AI is off, or the provider errors, the app silently
  falls back to the scripted tutor — it never breaks offline.
