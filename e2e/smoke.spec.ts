import { test, expect } from "@playwright/test";

test("app starts and dashboard renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Indonesian/);
});
