import { describe, expect, it } from "vitest";
import { checkPriceCap, computePriceCap, PRICE_CAP_RATIO } from "@htp/contracts";
import {
  runVerification,
  selectVerifiedRetailPrice,
  validateOfferAmount,
  computeMatchConfidence,
  toVerificationSummary,
  hashEvidence,
} from "./verification";

describe("price cap calculation", () => {
  it("computes 50% cap with floor", () => {
    expect(computePriceCap(1_850_000)).toBe(925_000);
    expect(computePriceCap(999_999)).toBe(499_999);
  });

  it("property test: cap <= retail / 2 for all retail in [MIN_PRICE, MAX_PRICE]", () => {
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

  it("fails early if category is not approved", () => {
    const decision = runVerification({
      listing: { id: "l1", sellerPriceIqd: 900_000, title: "Samsung" },
      category: { ...baseCategory, whitelistStatus: "BLOCKED" },
      canonicalProduct: { brand: "Samsung", model: "Galaxy" },
      retailReferences: [],
      matchConfidence: 0.95,
    });
    expect(decision.result).toBe("FAIL");
  });

  it("returns MANUAL_REVIEW if canonicalProduct is missing", () => {
    const decision = runVerification({
      listing: { id: "l1", sellerPriceIqd: 900_000, title: "Samsung" },
      category: baseCategory,
      canonicalProduct: null,
      retailReferences: [],
      matchConfidence: 0.95,
    });
    expect(decision.result).toBe("MANUAL_REVIEW");
  });

  it("passes when price is under cap with high confidence and quorum met", () => {
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
    expect(decision.sourceCount).toBe(2);
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

    expect(decision.result).toBe("FAIL");
    expect(decision.sourceCount).toBe(2);
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
    expect(decision.sourceCount).toBe(0);
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
    expect(decision.sourceCount).toBe(1);
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

  it("rejects offers with zero or negative amounts", () => {
    expect(validateOfferAmount(0, 925_000).valid).toBe(false);
    expect(validateOfferAmount(-100, 925_000).valid).toBe(false);
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

describe("verification summary helper", () => {
  it("converts a decision to a summary correctly", () => {
    const summary = toVerificationSummary({
      result: "PASS",
      matchConfidence: 0.95,
      verifiedRetailIqd: 1000,
      computedCapIqd: 500,
      selectedReferenceId: "ref1",
      message: "Success",
    });
    expect(summary.result).toBe("PASS");
    expect(summary.computedCapIqd).toBe(500);
    expect(summary.verifiedRetailIqd).toBe(1000);
    expect(summary.message).toBe("Success");
  });
});

describe("hash evidence helper", () => {
  it("creates a stable hash", () => {
    const h = hashEvidence("http://test.com", 1000, new Date("2026-06-19T12:00:00Z"));
    expect(h).toBeDefined();
    expect(typeof h).toBe("string");
  });
});

describe("stale exchange rates warning check", () => {
  const now = new Date();
  const staleDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days old
  const baseCategory = {
    whitelistStatus: "ACTIVE" as const,
    matchConfidenceThreshold: 0.85,
    retailTtlDays: 30,
  };

  it("appends warning message if exchange rates are older than 7 days", () => {
    const decision = runVerification({
      listing: { id: "l1", sellerPriceIqd: 400, title: "Samsung Galaxy S24 Ultra 256GB" },
      category: baseCategory,
      canonicalProduct: { brand: "Samsung", model: "Galaxy S24 Ultra 256GB" },
      retailReferences: [
        {
          id: "ref1",
          observedPriceIqd: 1000,
          observedAt: now,
          stockState: "IN_STOCK",
          sourceName: "Elryan",
          nativeCurrency: "USD",
          nativeAmount: 0.7,
          exchangeRate: 1450,
          rateTimestamp: staleDate,
        },
        {
          id: "ref2",
          observedPriceIqd: 1000,
          observedAt: now,
          stockState: "IN_STOCK",
          sourceName: "Miswag",
          nativeCurrency: "IQD",
          nativeAmount: 1000,
          exchangeRate: 1.0,
          rateTimestamp: now,
        },
      ],
      matchConfidence: 0.95,
    });
    expect(decision.message).toContain("Warning: Stale exchange rates used");
  });
});
