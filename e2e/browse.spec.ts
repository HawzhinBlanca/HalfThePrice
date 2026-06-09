import { test, expect } from "@playwright/test";

test.describe("buyer browse journey", () => {
  test("home page shows verified marketplace messaging", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /half the price/i })).toBeVisible();
    await expect(page.getByText(/verified ≤50%/i).first()).toBeVisible();
  });

  test("browse page lists live verified listings", async ({ page }) => {
    await page.goto("/browse");
    await expect(page.getByRole("heading", { name: /browse verified deals/i })).toBeVisible();
    await expect(page.getByText(/live listing/i)).toBeVisible();
    const cards = page.locator('a[href^="/listings/"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  });

  test("listing detail shows verification panel", async ({ page }) => {
    await page.goto("/browse");
    const firstCard = page.locator('a[href^="/listings/"]').first();
    await firstCard.click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /price verification/i })).toBeVisible();
    await expect(page.getByText(/retail evidence sources/i)).toBeVisible();
  });

  test("search filters listings", async ({ page }) => {
    await page.goto("/browse");
    await page.getByLabel("Search").fill("Samsung");
    await page.waitForURL(/q=Samsung/);
    await expect(page.getByText(/Samsung/i).first()).toBeVisible();
  });

  test("fuzzy search tolerates typos", async ({ page }) => {
    await page.goto("/browse");
    await page.getByLabel("Search").fill("Samsun");
    await page.waitForURL(/q=Samsun/);
    await expect(page.getByText(/Samsung/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("active filter chips appear and clear", async ({ page }) => {
    await page.goto("/browse?q=Samsung");
    await expect(page.getByRole("button", { name: /Remove Search/i })).toBeVisible();
    await page.getByRole("button", { name: /Clear all filters/i }).click();
    await page.waitForURL("/browse");
  });
});

