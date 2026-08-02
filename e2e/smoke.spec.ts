import { test, expect } from "@playwright/test";

test("app starts and dashboard renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Indonesian/);
  await expect(page.getByText("Today's Learning")).toBeVisible();
});

test("learner completes lesson 1, unlocks the dashboard and conversation", async ({
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

  // 4. Practice: answer every item correctly (reading the prompts on screen).
  const practiceInput = page.getByPlaceholder(/Tulis dalam bahasa Indonesia/);

  // Item 1: "Selamat pagi!"
  await expect(page.getByText("Selamat pagi!", { exact: true })).toBeVisible();
  await practiceInput.fill("selamat pagi");
  await practiceInput.press("Enter");
  await expect(page.getByText(/Bagus/i).first()).toBeVisible();

  // Item 2: "Terima kasih!" -> reply "sama sama" (no hyphen)
  await expect(page.getByText("Terima kasih!", { exact: true })).toBeVisible();
  await practiceInput.fill("sama sama");
  await practiceInput.press("Enter");
  await expect(page.getByText(/Bagus/i).first()).toBeVisible();

  // Item 3: "Halo, selamat pagi!"
  await expect(
    page.getByText("Halo, selamat pagi!", { exact: true }),
  ).toBeVisible();
  await practiceInput.fill("halo selamat pagi");
  await practiceInput.press("Enter");
  await expect(page.getByText(/Bagus/i).first()).toBeVisible();

  // 5. Recall: answer every item correctly (with a hyphen this time).
  const recallInput = page.getByPlaceholder(/Ketik jawaban/);

  await expect(page.getByText("hello", { exact: true })).toBeVisible();
  await recallInput.fill("halo");
  await recallInput.press("Enter");

  await expect(page.getByText("thank you", { exact: true })).toBeVisible();
  await recallInput.fill("terima kasih");
  await recallInput.press("Enter");

  await expect(
    page.getByText("you're welcome", { exact: true }),
  ).toBeVisible();
  await recallInput.fill("sama-sama");
  await recallInput.press("Enter");

  // 6. Review step: finish the lesson.
  await expect(page.getByRole("button", { name: /Selesai/i })).toBeVisible();
  await page.getByRole("button", { name: /Selesai/i }).click();

  // 7. Dashboard now shows Continue Learning -> lesson 2, not the first-run hero.
  await expect(page.getByText("Continue Learning")).toBeVisible();
  await expect(page.getByText("Halo! Selamat datang")).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: /Continue →/ }),
  ).toHaveAttribute("href", "/lesson/my-name");

  // 8. Conversation gate is gone — the chat input is available.
  await page.goto("/conversation");
  await expect(page.getByText("Ngobrol dengan Kak")).toBeVisible();
  await expect(
    page.getByPlaceholder(/Tulis dalam bahasa Indonesia/),
  ).toBeVisible();

  // 9. Vocabulary page shows the bumped word as learned, and it persists.
  await page.goto("/vocabulary");
  const card = page.locator("article").filter({ hasText: "selamat pagi" });
  await expect(card.getByRole("heading", { name: "selamat pagi" })).toBeVisible();
  await expect(card.getByText("Learned")).toBeVisible();

  await page.reload();
  await expect(
    page.locator("article").filter({ hasText: "selamat pagi" }).getByText("Learned"),
  ).toBeVisible();
});
