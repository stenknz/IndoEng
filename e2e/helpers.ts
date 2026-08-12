import { expect, type Page } from "@playwright/test";

export function makeEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
}

export async function register(
  page: Page,
  email: string,
  password: string,
  name = "E2E User",
): Promise<void> {
  await page.goto("/");
  await page.locator('button[type="button"]').filter({ hasText: "Daftar" }).click();
  await page.fill("#auth-name", name);
  await page.fill("#auth-email", email);
  await page.fill("#auth-password", password);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("link", { name: "Learn" })).toBeVisible();
}

export async function login(
  page: Page,
  email: string,
  password: string,
  remember = false,
): Promise<void> {
  await page.goto("/");
  await page.fill("#auth-email", email);
  await page.fill("#auth-password", password);
  if (remember) await page.getByRole("checkbox").check();
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("link", { name: "Learn" })).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Keluar" }).first().click();
  await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
}

export async function completeHelloLesson(page: Page): Promise<void> {
  await page.goto("/lesson/hello");
  await expect(page.getByRole("heading", { name: /Hello/i })).toBeVisible();
  await expect(page.getByText(/Langkah 1 dari 6/)).toBeVisible();

  await page.getByRole("button", { name: /Let's begin/i }).click();
  await page.getByRole("button", { name: /Lanjut/i }).click();
  await page.getByRole("button", { name: /Sekarang saya coba/i }).click();

  const practiceInput = page.getByPlaceholder(/Tulis dalam bahasa Indonesia/);

  await expect(page.getByText("Selamat pagi!", { exact: true })).toBeVisible();
  await practiceInput.fill("selamat pagi");
  await practiceInput.press("Enter");
  await expect(page.getByText(/Bagus/i).first()).toBeVisible();

  await expect(page.getByText("Terima kasih!", { exact: true })).toBeVisible();
  await practiceInput.fill("sama sama");
  await practiceInput.press("Enter");
  await expect(page.getByText(/Bagus/i).first()).toBeVisible();

  await expect(
    page.getByText("Halo, selamat pagi!", { exact: true }),
  ).toBeVisible();
  await practiceInput.fill("halo selamat pagi");
  await practiceInput.press("Enter");
  await expect(page.getByText(/Bagus/i).first()).toBeVisible();

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

  await expect(page.getByRole("button", { name: /Selesai/i })).toBeVisible();
  await page.getByRole("button", { name: /Selesai/i }).click();
}
