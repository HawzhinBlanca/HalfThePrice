import { describe, expect, it, vi, beforeEach } from "vitest";
import { refreshRetailReferencesForTitle } from "./retail-refresh";
import { prisma } from "./client";
import { isDatabaseFeatureEnabled } from "./features";
import { fetchRetailReferences } from "@htp/retail-crawler";

vi.mock("./client", () => {
  return {
    prisma: {
      canonicalProduct: {
        findMany: vi.fn(),
      },
      retailReference: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

vi.mock("./features", () => {
  return {
    isDatabaseFeatureEnabled: vi.fn(),
  };
});

vi.mock("@htp/retail-crawler", () => {
  return {
    fetchRetailReferences: vi.fn(),
  };
});

describe("refreshRetailReferencesForTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null if product is not found in database", async () => {
    vi.mocked(prisma.canonicalProduct.findMany).mockResolvedValue([]);

    const result = await refreshRetailReferencesForTitle("Samsung Galaxy");
    expect(result).toBeNull();
  });

  it("returns zero inserts if CRAWLER_LIVE feature flag is disabled", async () => {
    vi.mocked(prisma.canonicalProduct.findMany).mockResolvedValue([
      { id: "prod1", brand: "Samsung", model: "Galaxy" },
    ] as any);
    vi.mocked(isDatabaseFeatureEnabled).mockResolvedValue(false);

    const result = await refreshRetailReferencesForTitle("Samsung Galaxy", "prod1");
    expect(result).not.toBeNull();
    expect(result?.inserted).toBe(0);
    expect(result?.sources).toEqual([]);
  });

  it("crawls and inserts references if new, skipping existing ones", async () => {
    vi.mocked(prisma.canonicalProduct.findMany).mockResolvedValue([
      { id: "prod1", brand: "Samsung", model: "Galaxy" },
    ] as any);
    vi.mocked(isDatabaseFeatureEnabled).mockResolvedValue(true);

    vi.mocked(fetchRetailReferences).mockResolvedValue([
      {
        sourceName: "Elryan",
        sourceUrl: "http://elryan.com/prod",
        observedPriceIqd: 1000000,
        stockState: "IN_STOCK",
        parserVersion: "1.0.0",
      },
      {
        sourceName: "Miswag",
        sourceUrl: "http://miswag.com/prod",
        observedPriceIqd: 1050000,
        stockState: "IN_STOCK",
        parserVersion: "1.0.0",
      },
    ] as any);

    // Mock existing reference for Elryan, but not Miswag
    vi.mocked(prisma.retailReference.findFirst)
      .mockResolvedValueOnce({ id: "existing1" } as any) // first call (Elryan)
      .mockResolvedValueOnce(null); // second call (Miswag)

    const result = await refreshRetailReferencesForTitle("Samsung Galaxy", "prod1");

    expect(fetchRetailReferences).toHaveBeenCalledWith("Samsung Galaxy");
    expect(prisma.retailReference.create).toHaveBeenCalledTimes(1);
    expect(result?.inserted).toBe(1);
    expect(result?.sources).toContain("Elryan");
    expect(result?.sources).toContain("Miswag");
  });
});
