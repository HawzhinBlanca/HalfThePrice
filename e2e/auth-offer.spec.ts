import { test, expect } from "@playwright/test";

test.describe("buyer auth and offer flow", () => {
  test("buyer can login and see offer form on listing", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("buyer@half-the-price.iq");
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL("/");
    await page.goto("/browse");
    await page.locator('a[href^="/listings/"]').first().click();

    await expect(page.getByRole("heading", { name: /make an offer/i })).toBeVisible();
    await expect(page.getByLabel(/your offer/i)).toBeVisible();
  });

  test("buyer can submit a valid offer", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("buyer@half-the-price.iq");
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("/");

    await page.goto("/browse");
    await page.locator('a[href^="/listings/"]').first().click();

    const offerInput = page.getByLabel(/your offer/i);
    await offerInput.fill("400000");
    await page.getByRole("button", { name: /submit offer/i }).click();

    await expect(page.getByText(/offer submitted successfully/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
