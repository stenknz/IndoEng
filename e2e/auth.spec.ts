import { test, expect } from "@playwright/test";
import { makeEmail, register, login, logout, completeHelloLesson } from "./helpers";

test("register a fresh user lands on the dashboard", async ({ page }) => {
  await register(page, makeEmail("auth-register"), "password123", "Reg User");
  await expect(page.getByRole("link", { name: "Learn" })).toBeVisible();
  await expect(page.getByText("Halo! Selamat datang")).toBeVisible();
  await expect(page.getByText("Today's Learning")).toBeVisible();
});

test("logout, wrong password shows inline error, correct password logs in", async ({
  page,
}) => {
  const email = makeEmail("auth-logout");
  await register(page, email, "password123", "Logout User");

  await logout(page);
  await expect(page.locator('button[type="submit"]')).toBeVisible();

  await page.fill("#auth-email", email);
  await page.fill("#auth-password", "wrong-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await expect(page.getByRole("link", { name: "Learn" })).not.toBeVisible();

  await login(page, email, "password123");
  await expect(page.getByText("Halo! Selamat datang")).toBeVisible();
});

test("login with remember-me sets a long-lived refresh cookie", async ({ page }) => {
  const email = makeEmail("auth-remember");
  await register(page, email, "password123", "Remember User");
  await logout(page);

  await login(page, email, "password123", true);
  await expect(page.getByRole("link", { name: "Learn" })).toBeVisible();

  const cookies = await page.context().cookies("http://localhost:3000");
  const refresh = cookies.find((c) => c.name === "kak_refresh");
  expect(refresh).toBeTruthy();
  const maxAge = (refresh!.expires ?? -1) - Date.now() / 1000;
  expect(maxAge).toBeGreaterThan(24 * 3600);
});

test("multi-user isolation: User B starts fresh, User A keeps progress", async ({
  page,
}) => {
  const aEmail = makeEmail("iso-a");
  const aPass = "password123";
  const bEmail = makeEmail("iso-b");

  // User A registers and completes lesson 1.
  await register(page, aEmail, aPass, "User A");
  await completeHelloLesson(page);
  await expect(page.getByText("Continue Learning")).toBeVisible();

  // Persist is proven by a reload: the dashboard re-hydrates from the server.
  // Give the fire-and-forget saves a beat to land before re-hydrating.
  await expect(page.getByText("Continue Learning")).toBeVisible();
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByText("Continue Learning")).toBeVisible();
  await expect(page.getByText("Halo! Selamat datang")).not.toBeVisible();

  // Logout and register User B — B must start completely fresh.
  await logout(page);
  await register(page, bEmail, "password123", "User B");
  await expect(page.getByText("Halo! Selamat datang")).toBeVisible();
  await expect(page.getByText("Continue Learning")).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: /Continue →/ }),
  ).not.toBeVisible();

  // Back to User A — progress is intact.
  await logout(page);
  await login(page, aEmail, aPass);
  await expect(page.getByText("Continue Learning")).toBeVisible();
  await expect(page.getByText("Halo! Selamat datang")).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: /Continue →/ }),
  ).toHaveAttribute("href", "/lesson/my-name");
});

test("change password then re-login with the new password", async ({ page }) => {
  const email = makeEmail("auth-changepw");
  const oldPass = "password123";
  const newPass = "brand-new-pass-1";
  await register(page, email, oldPass, "ChangePw User");

  await page.goto("/profile");
  await page.fill("#profile-current-password", oldPass);
  await page.fill("#profile-new-password", newPass);
  await page.fill("#profile-confirm-password", newPass);
  await page.locator("form").last().getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Kata sandi diubah")).toBeVisible();

  await logout(page);

  // New password works.
  await login(page, email, newPass);
  await expect(page.getByRole("link", { name: "Learn" })).toBeVisible();
  await logout(page);

  // Old password is rejected.
  await page.fill("#auth-email", email);
  await page.fill("#auth-password", oldPass);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await expect(page.getByRole("link", { name: "Learn" })).not.toBeVisible();
});

test("admin sees the Admin panel; students and anonymous are blocked", async ({
  page,
  request,
}) => {
  // A student registered through the UI.
  const studentEmail = makeEmail("auth-student");
  await register(page, studentEmail, "password123", "Student User");

  // A student request to the admin API is forbidden (403).
  const asStudent = await page.request.get("/api/admin/users");
  expect(asStudent.status()).toBe(403);

  // An anonymous (cookie-less) request is unauthorized (401).
  const asAnonymous = await request.get("/api/admin/users");
  expect(asAnonymous.status()).toBe(401);

  // Logout the student, then log in as the seeded admin.
  await logout(page);
  await login(page, "admin@example.com", "change-me-123");

  // The Admin nav link is visible for the admin.
  await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();

  // The admin panel lists the just-created student.
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await expect(page.getByText(studentEmail)).toBeVisible();
  await expect(page.getByText("admin@example.com")).toBeVisible();
});
