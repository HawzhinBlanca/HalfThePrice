import { describe, expect, it } from "vitest";
import {
  checkPriceCap,
  computePriceCap,
  PRICE_CAP_RATIO,
} from "@htp/contracts";
import {
  runVerification,
  selectVerifiedRetailPrice,
  validateOfferAmount,
  computeMatchConfidence,
} from "@htp/database";

describe("price cap calculation", () => {
  it("computes 50% cap with floor", () => {
    expect(computePriceCap(1_850_000)).toBe(925_000);
    expect(computePriceCap(999_999)).toBe(499_999);
  });

  it("property test: cap <= retail / 2 for all retail in [MIN_PRICE, MAX_PRICE]", () => {
    // Check various retail prices in the range of 1 to 5,000,000 IQD
    for (let retail = 1; retail <= 5_000_000; retail += 1007) {
      const cap = computePriceCap(retail);
      expect(cap).toBeLessThanOrEqual(retail / 2);
    }
  });

  it("checks seller price against cap", () => {
    const pass = checkPriceCap(900_000, 1_850_000);
    expect(pass.passesCap).toBe(true);
    expect(pass.computedCapIqd).toBe(925_000);

    const fail = checkPriceCap(950_000, 1_850_000);
    expect(fail.passesCap).toBe(false);
  });

  it("uses correct ratio constant", () => {
    expect(PRICE_CAP_RATIO).toBe(0.5);
  });
});

describe("retail reference selection", () => {
  const now = new Date();

  it("selects median from fresh in-stock references", () => {
    const result = selectVerifiedRetailPrice(
      [
        {
          id: "ref1",
          observedPriceIqd: 1_850_000,
          observedAt: now,
          stockState: "IN_STOCK",
          sourceName: "Elryan",
          nativeCurrency: "IQD",
          nativeAmount: 1_850_000,
          exchangeRate: 1.0,
          rateTimestamp: null,
        },
        {
          id: "ref2",
          observedPriceIqd: 1_920_000,
          observedAt: now,
          stockState: "IN_STOCK",
          sourceName: "Miswag",
          nativeCurrency: "IQD",
          nativeAmount: 1_920_000,
          exchangeRate: 1.0,
          rateTimestamp: null,
        },
      ],
      30,
    );

    expect(result).not.toBeNull();
    expect(result?.price).toBe(1_885_000);
  });

  it("returns null when no fresh references", () => {
    const stale = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const result = selectVerifiedRetailPrice(
      [
        {
          id: "ref1",
          observedPriceIqd: 1_000_000,
          observedAt: stale,
          stockState: "IN_STOCK",
          sourceName: "Elryan",
          nativeCurrency: "IQD",
          nativeAmount: 1_000_000,
          exchangeRate: 1.0,
          rateTimestamp: null,
        },
      ],
      30,
    );
    expect(result).toBeNull();
  });
});

describe("verification engine", () => {
  const now = new Date();
  const baseCategory = {
    whitelistStatus: "ACTIVE" as const,
    matchConfidenceThreshold: 0.85,
    retailTtlDays: 30,
  };

  it("passes when price is under cap with high confidence", () => {
    const decision = runVerification({
      listing: { id: "l1", sellerPriceIqd: 900_000, title: "Samsung Galaxy S24 Ultra 256GB" },
      category: baseCategory,
      canonicalProduct: { brand: "Samsung", model: "Galaxy S24 Ultra 256GB" },
      retailReferences: [
        {
          id: "ref1",
          observedPriceIqd: 1_850_000,
          observedAt: now,
          stockState: "IN_STOCK",
          sourceName: "Elryan",
          nativeCurrency: "IQD",
          nativeAmount: 1_850_000,
          exchangeRate: 1.0,
          rateTimestamp: null,
        },
        {
          id: "ref2",
          observedPriceIqd: 1_850_000,
          observedAt: now,
          stockState: "IN_STOCK",
          sourceName: "Miswag",
          nativeCurrency: "IQD",
          nativeAmount: 1_850_000,
          exchangeRate: 1.0,
          rateTimestamp: null,
        },
      ],
      matchConfidence: 0.95,
    });

    expect(decision.result).toBe("PASS");
    expect(decision.computedCapIqd).toBe(925_000);
  });

  it("fails when price exceeds cap", () => {
    const decision = runVerification({
      listing: { id: "l1", sellerPriceIqd: 1_000_000, title: "Samsung Galaxy S24 Ultra 256GB" },
      category: baseCategory,
      canonicalProduct: { brand: "Samsung", model: "Galaxy S24 Ultra 256GB" },
      retailReferences: [
        {
          id: "ref1",
          observedPriceIqd: 1_850_000,
          observedAt: now,
          stockState: "IN_STOCK",
          sourceName: "Elryan",
          nativeCurrency: "IQD",
          nativeAmount: 1_850_000,
          exchangeRate: 1.0,
          rateTimestamp: null,
        },
      ],
      matchConfidence: 0.95,
    });

    expect(decision.result).toBe("FAIL");
  });

  it("sends to manual review when confidence is low", () => {
    const decision = runVerification({
      listing: { id: "l1", sellerPriceIqd: 500_000, title: "Unknown phone" },
      category: baseCategory,
      canonicalProduct: { brand: "Samsung", model: "Galaxy S24 Ultra 256GB" },
      retailReferences: [],
      matchConfidence: 0.5,
    });

    expect(decision.result).toBe("MANUAL_REVIEW");
  });

  it("sends to manual review when quorum is not met (only 1 source)", () => {
    const decision = runVerification({
      listing: { id: "l1", sellerPriceIqd: 900_000, title: "Samsung Galaxy S24 Ultra 256GB" },
      category: baseCategory,
      canonicalProduct: { brand: "Samsung", model: "Galaxy S24 Ultra 256GB" },
      retailReferences: [
        {
          id: "ref1",
          observedPriceIqd: 1_850_000,
          observedAt: now,
          stockState: "IN_STOCK",
          sourceName: "Elryan",
          nativeCurrency: "IQD",
          nativeAmount: 1_850_000,
          exchangeRate: 1.0,
          rateTimestamp: null,
        },
      ],
      matchConfidence: 0.95,
    });

    expect(decision.result).toBe("MANUAL_REVIEW");
    expect(decision.message).toContain("Quorum not met");
  });
});

describe("offer validation", () => {
  it("rejects offers above cap", () => {
    const result = validateOfferAmount(1_000_000, 925_000);
    expect(result.valid).toBe(false);
  });

  it("accepts offers at or below cap", () => {
    expect(validateOfferAmount(925_000, 925_000).valid).toBe(true);
    expect(validateOfferAmount(800_000, 925_000).valid).toBe(true);
  });
});

describe("match confidence", () => {
  it("scores exact title matches highly", () => {
    const score = computeMatchConfidence(
      "Samsung Galaxy S24 Ultra 256GB - Like New",
      { brand: "Samsung", model: "Galaxy S24 Ultra 256GB" },
    );
    expect(score).toBeGreaterThanOrEqual(0.85);
  });
});
