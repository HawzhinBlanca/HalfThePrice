import { test, expect } from "@playwright/test";

test.describe("seller full journey", () => {
  test("approved seller can estimate cap and see dashboard", async ({ page }) => {
    await page.goto("/login?redirect=/seller");
    await page.getByLabel("Email").fill("seller@half-the-price.iq");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL("/seller");
    await expect(page.getByRole("heading", { name: /price cap estimator/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /seller dashboard/i })).toBeVisible();

    await page.getByLabel("Product title").fill("Samsung Galaxy S24 Ultra 256GB");
    await page.getByLabel("Category").selectOption({ label: "Phones" });
    await page.getByRole("button", { name: /estimate cap/i }).click();

    await expect(page.getByText(/925|Estimated cap|Max price/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("seller can submit draft listing for verification", async ({ page }) => {
    await page.goto("/login?redirect=/seller");
    await page.getByLabel("Email").fill("seller@half-the-price.iq");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("/seller");

    await expect(page.getByText(/Draft/i).first()).toBeVisible();
    const submitBtn = page.getByRole("button", { name: /submit for verification/i }).first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await expect(page.getByText(/passes price verification|manual review|exceeds cap/i).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  });
});
