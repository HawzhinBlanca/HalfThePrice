import { test, expect } from "@playwright/test";

test.describe("buyer browse journey", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log("BROWSER CONSOLE:", msg.text()));
    page.on("pageerror", (err) => console.log("BROWSER ERROR:", err.stack || err.message));
  });
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
    await page.waitForLoadState("networkidle");
    await page.waitForSelector('form[data-hydrated="true"]');
    await page.getByLabel("Search").pressSequentially("Samsung", { delay: 50 });
    await expect(page).toHaveURL(/q=Samsung/, { timeout: 15_000 });
    await expect(page.getByText(/Samsung/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("fuzzy search tolerates typos", async ({ page }) => {
    await page.goto("/browse");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector('form[data-hydrated="true"]');
    await page.getByLabel("Search").pressSequentially("Samsun", { delay: 50 });
    await expect(page).toHaveURL(/q=Samsun/, { timeout: 15_000 });
    await expect(page.getByText(/Samsung/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("active filter chips appear and clear", async ({ page }) => {
    await page.goto("/browse?q=Samsung");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector('form[data-hydrated="true"]');
    await expect(page.getByRole("button", { name: /Remove Search/i })).toBeVisible();
    await page.getByRole("link", { name: /Clear all filters/i }).click();
    await expect(page).toHaveURL(/\/browse$/);
  });
});

