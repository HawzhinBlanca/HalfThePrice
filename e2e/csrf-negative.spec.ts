import { test, expect } from "@playwright/test";

test.describe("CSRF Protection negative tests", () => {
  test("mutating POST request without CSRF token returns 403 Forbidden", async ({ request }) => {
    // Send a POST request to listings without x-csrf-token or cookies
    const response = await request.post("/api/listings", {
      data: {
        title: "Samsung Galaxy E2E Test",
        sellerPriceIqd: 100000,
        categoryId: "some-id",
        governorate: "Baghdad",
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("CSRF token");
  });
});
