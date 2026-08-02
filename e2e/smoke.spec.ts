import { test, expect } from "@playwright/test";

test("app starts and dashboard renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Indonesian/);
  await expect(page.getByText("Today's Learning")).toBeVisible();
});

test("learner can answer the first practice item and state persists", async ({
  page,
}) => {
  // 1. Dashboard renders the first-run hero.
  await page.goto("/");
  await expect(page.getByText("Halo! Selamat datang")).toBeVisible();

  // 2. Lesson page renders with the lesson title and progress.
  await page.goto("/lesson/hello");
  await expect(page.getByRole("heading", { name: /Hello/i })).toBeVisible();
  await expect(page.getByText(/Langkah 1 dari 6/)).toBeVisible();

  // 3. Advance warmup -> newwords -> conversation.
  await page.getByRole("button", { name: /Let's begin/i }).click();
  await page.getByRole("button", { name: /Lanjut/i }).click();
  await page.getByRole("button", { name: /Sekarang saya coba/i }).click();

  // 4. Practice: answer the first item ("Selamat pagi!") correctly.
  const practiceInput = page.getByPlaceholder(/Tulis dalam bahasa Indonesia/);
  await practiceInput.fill("selamat pagi");
  await practiceInput.press("Enter");
  await expect(page.getByText(/Bagus/i).first()).toBeVisible();

  // 5. Vocabulary page shows the bumped word as learned.
  await page.goto("/vocabulary");
  const card = page.locator("article").filter({ hasText: "selamat pagi" });
  await expect(card.getByRole("heading", { name: "selamat pagi" })).toBeVisible();
  await expect(card.getByText("Learned")).toBeVisible();

  // 6. Reload — the learned status persists from local storage.
  await page.reload();
  await expect(
    page.locator("article").filter({ hasText: "selamat pagi" }).getByText("Learned"),
  ).toBeVisible();
});
