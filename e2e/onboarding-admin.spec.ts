import { test, expect } from "@playwright/test";

test.describe("seller onboarding and admin audit", () => {
  test("pending seller sees onboarding form", async ({ page }) => {
    await page.goto("/login?redirect=/seller");
    await page.getByLabel("Email").fill("pending-seller@half-the-price.iq");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL("/seller");
    await expect(page.getByRole("heading", { name: /seller onboarding/i })).toBeVisible();
    await expect(page.getByLabel("Legal business name")).toBeVisible();
  });

  test("admin sees audit trail section", async ({ page }) => {
    await page.goto("/login?redirect=/admin");
    await page.getByLabel("Email").fill("admin@half-the-price.iq");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL("/admin");
    await expect(page.getByRole("heading", { name: /admin console/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /audit trail/i })).toBeVisible();
    await expect(page.getByText(/SEED_COMPLETE|VERIFICATION_SUBMITTED|ADMIN_OVERRIDE/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("admin moderation queue shows SLA indicator", async ({ page }) => {
    await page.goto("/login?redirect=/admin");
    await page.getByLabel("Email").fill("admin@half-the-price.iq");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("/admin");

    await expect(page.getByText(/SLA breached|Within SLA|\d+h waiting/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
