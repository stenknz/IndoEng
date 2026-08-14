import { expect, type Page } from "@playwright/test";

export function makeEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
}

export async function registerUser(
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
