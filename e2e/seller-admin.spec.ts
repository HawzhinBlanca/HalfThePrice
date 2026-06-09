import { test, expect } from "@playwright/test";

test.describe("seller and admin journeys", () => {
  test("seller can access dashboard and see listings", async ({ page }) => {
    await page.goto("/login?redirect=/seller");
    await page.getByLabel("Email").fill("seller@half-the-price.iq");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL("/seller");
    await expect(page.getByRole("heading", { name: /seller dashboard/i })).toBeVisible();
    await expect(page.getByText(/live listings/i)).toBeVisible();
  });

  test("admin can view moderation queue", async ({ page }) => {
    await page.goto("/login?redirect=/admin");
    await page.getByLabel("Email").fill("admin@half-the-price.iq");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL("/admin");
    await expect(page.getByRole("heading", { name: /admin console/i })).toBeVisible();
    await expect(page.getByText(/awaiting review/i)).toBeVisible();
  });
});
