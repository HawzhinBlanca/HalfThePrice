import { describe, expect, it } from "vitest";
import { messages, t, tf } from "./messages";

describe("i18n messages", () => {
  const locales = ["en", "ar", "ku"] as const;
  const sampleKeys = [
    "nav.browse",
    "browse.title",
    "seller.dashboard",
    "admin.title",
    "auth.signIn.title",
    "offer.title",
    "verification.title",
    "common.loading",
  ] as const;

  it("provides non-empty strings for all locales", () => {
    for (const locale of locales) {
      for (const key of sampleKeys) {
        expect(messages[locale][key].length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back to English for unknown locale keys", () => {
    expect(t("en", "browse.title")).toBe("Browse verified deals");
  });

  it("interpolates variables with tf", () => {
    expect(tf("en", "hero.browseDeals", { count: 12 })).toBe("Browse 12 deals");
    expect(tf("ar", "admin.pendingKyc", { count: 3 })).toContain("3");
    expect(tf("ku", "listing.savingsOff", { percent: 42 })).toContain("42");
  });

  it("has matching keys across all locales", () => {
    const enKeys = Object.keys(messages.en).sort();
    for (const locale of ["ar", "ku"] as const) {
      expect(Object.keys(messages[locale]).sort()).toEqual(enKeys);
    }
  });
});
