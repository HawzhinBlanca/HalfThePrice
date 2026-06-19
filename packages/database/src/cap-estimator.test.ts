import { describe, expect, it, vi, beforeEach } from "vitest";
import { estimateCap } from "./cap-estimator";
import { prisma } from "./client";

vi.mock("./client", () => {
  return {
    prisma: {
      category: {
        findUnique: vi.fn(),
      },
      canonicalProduct: {
        findMany: vi.fn(),
      },
    },
  };
});

describe("price cap estimation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when category is missing or inactive", async () => {
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null);

    const result = await estimateCap("Samsung S24", "cat1");
    expect(result).toBeNull();
  });

  it("returns info message when no product candidate matches", async () => {
    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: "cat1",
      slug: "phones",
      nameEn: "Phones",
      whitelistStatus: "ACTIVE",
      retailTtlDays: 30,
    } as any);

    vi.mocked(prisma.canonicalProduct.findMany).mockResolvedValue([
      {
        id: "prod1",
        brand: "Apple",
        model: "iPhone 15 Pro",
        retailReferences: [],
      },
    ] as any);

    const result = await estimateCap("Unknown brand new phone", "cat1");
    expect(result).not.toBeNull();
    expect(result?.matchedProduct).toBeNull();
    expect(result?.message).toContain("No confident product match");
  });

  it("returns matched product but no fresh reference if references are stale or missing", async () => {
    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: "cat1",
      slug: "phones",
      nameEn: "Phones",
      whitelistStatus: "ACTIVE",
      retailTtlDays: 30,
    } as any);

    vi.mocked(prisma.canonicalProduct.findMany).mockResolvedValue([
      {
        id: "prod1",
        brand: "Samsung",
        model: "Galaxy S24",
        retailReferences: [
          {
            id: "ref1",
            sourceName: "Elryan",
            stockState: "IN_STOCK",
            observedPriceIqd: 1_000_000,
            observedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days old (stale)
            sourceUrl: "http://example.com",
            nativeCurrency: "IQD",
            nativeAmount: 1_000_000,
            exchangeRate: 1.0,
          },
        ],
      },
    ] as any);

    const result = await estimateCap("Samsung Galaxy S24 phone", "cat1");
    expect(result).not.toBeNull();
    expect(result?.matchedProduct?.brand).toBe("Samsung");
    expect(result?.verifiedRetailIqd).toBeNull();
    expect(result?.message).toContain("no fresh retail evidence available");
  });

  it("returns full cap estimate when matching product and fresh references exist", async () => {
    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: "cat1",
      slug: "phones",
      nameEn: "Phones",
      whitelistStatus: "ACTIVE",
      retailTtlDays: 30,
    } as any);

    vi.mocked(prisma.canonicalProduct.findMany).mockResolvedValue([
      {
        id: "prod1",
        brand: "Samsung",
        model: "Galaxy S24",
        retailReferences: [
          {
            id: "ref1",
            sourceName: "Elryan",
            stockState: "IN_STOCK",
            observedPriceIqd: 1_000_000,
            observedAt: new Date(),
            sourceUrl: "http://example.com",
            nativeCurrency: "IQD",
            nativeAmount: 1_000_000,
            exchangeRate: 1.0,
          },
        ],
      },
    ] as any);

    const result = await estimateCap("Samsung Galaxy S24 phone", "cat1");
    expect(result).not.toBeNull();
    expect(result?.matchedProduct?.brand).toBe("Samsung");
    expect(result?.verifiedRetailIqd).toBe(1_000_000);
    expect(result?.computedCapIqd).toBe(500_000);
    expect(result?.retailSources).toContain("Elryan");
    expect(result?.message).toContain("Estimated cap: 500,000 IQD");
  });
});
