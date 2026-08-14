import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

test("server TTS endpoint returns audio and Settings shows Piper", async ({
  page,
}) => {
  const email = `voice-${Date.now()}@example.com`;
  await registerUser(page, email, "password123");

  const res = await page.request.post("/api/tts", {
    headers: { "x-kak-request": "1" },
    data: { text: "Selamat pagi", voice: "id_ID-news_tts-medium" },
  });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("audio/wav");
  const body = await res.body();
  expect(body.length).toBeGreaterThan(100); // a real WAV header + samples

  // A second identical request is served from the server-side cache.
  const cached = await page.request.post("/api/tts", {
    headers: { "x-kak-request": "1" },
    data: { text: "Selamat pagi", voice: "id_ID-news_tts-medium" },
  });
  expect(cached.status()).toBe(200);

  const info = await page.request.get("/api/tts/info", {
    headers: { "x-kak-request": "1" },
  });
  expect(info.status()).toBe(200);
  const infoJson = await info.json();
  expect(infoJson.provider).toBe("piper");
  expect(infoJson.configured).toBe(true);

  // The Settings page renders the Piper server status for the logged-in user.
  await page.goto("/settings");
  await expect(page.getByText("Suara Piper (server)")).toBeVisible();
});
