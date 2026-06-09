import { test, expect } from "@playwright/test";

test.describe("i18n and RTL", () => {
  test("locale switcher changes navigation labels", async ({ page, context }) => {
    await page.goto("/");
    await page.getByLabel("Language").selectOption("ar");
    await page.reload();

    await expect(page.getByRole("navigation", { name: "القائمة الرئيسية" }).getByRole("link", { name: "تصفح" })).toBeVisible();

    const dir = await page.locator("html").getAttribute("dir");
    expect(dir).toBe("rtl");

    await context.clearCookies();
  });

  test("Kurdish locale sets RTL direction", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Language").selectOption("ku");
    await page.reload();

    const dir = await page.locator("html").getAttribute("dir");
    expect(dir).toBe("rtl");
    await expect(page.getByRole("navigation", { name: "سەرەکی" }).getByRole("link", { name: "گەڕان" })).toBeVisible();
  });

  test("Arabic localizes browse page headings", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Language").selectOption("ar");
    await page.reload();
    await page.goto("/browse");

    await expect(page.getByRole("heading", { name: "تصفح العروض الموثّقة" })).toBeVisible();
    await expect(page.getByLabel("بحث")).toBeVisible();
  });

  test("Arabic localizes auth page", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Language").selectOption("ar");
    await page.reload();
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "تسجيل الدخول" })).toBeVisible();
  });
});
