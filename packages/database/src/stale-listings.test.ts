import { describe, expect, it, vi, beforeEach } from "vitest";
import { processStaleListings } from "./stale-listings";
import { prisma } from "./client";
import { runVerification } from "./verification";
import { acquireAdvisoryLock } from "./locks";

vi.mock("./client", () => {
  return {
    prisma: {
      $transaction: vi.fn((cb) => cb(prisma)),
      listing: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      priceVerificationRun: {
        create: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
    },
  };
});

vi.mock("./locks", () => {
  return {
    acquireAdvisoryLock: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("./verification", () => {
  return {
    runVerification: vi.fn(),
    computeMatchConfidence: vi.fn().mockReturnValue(0.9),
  };
});

describe("processStaleListings cron service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acquires advisory lock and skips processing if evidence is fresh", async () => {
    const now = new Date();
    const observedAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days old (fresh, ttl=30)

    vi.mocked(prisma.listing.findMany).mockResolvedValue([
      {
        id: "list1",
        status: "LIVE",
        title: "Test Listing",
        sellerPriceIqd: 100000,
        publishedAt: now,
        categoryId: "cat1",
        category: { retailTtlDays: 30 },
        canonicalProduct: {
          id: "prod1",
          brand: "Brand",
          model: "Model",
          retailReferences: [
            {
              id: "ref1",
              observedAt,
              sourceName: "Elryan",
            },
          ],
        },
        verificationRuns: [
          {
            selectedReference: {
              observedAt,
            },
          },
        ],
      },
    ] as any);

    const result = await processStaleListings(now);

    expect(acquireAdvisoryLock).toHaveBeenCalledWith(expect.any(Object), "stale_listings_cron");
    expect(result.processed).toBe(1);
    expect(result.markedStale).toBe(0);
    expect(result.reVerified).toBe(0);
    expect(result.results[0]?.action).toBe("SKIPPED");
  });

  it("marks listing as STALE if evidence is stale and runVerification fails", async () => {
    const now = new Date();
    const observedAt = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 days old (stale)

    vi.mocked(prisma.listing.findMany).mockResolvedValue([
      {
        id: "list1",
        status: "LIVE",
        title: "Test Listing",
        sellerPriceIqd: 100000,
        publishedAt: now,
        categoryId: "cat1",
        category: { retailTtlDays: 30 },
        canonicalProduct: {
          id: "prod1",
          brand: "Brand",
          model: "Model",
          retailReferences: [
            {
              id: "ref1",
              observedAt,
              sourceName: "Elryan",
            },
          ],
        },
        verificationRuns: [
          {
            selectedReference: {
              observedAt,
            },
          },
        ],
      },
    ] as any);

    vi.mocked(runVerification).mockReturnValue({
      result: "FAIL",
      matchConfidence: 0.9,
      verifiedRetailIqd: 100000,
      computedCapIqd: 50000,
      sourceCount: 2,
      selectedReferenceId: "ref1",
      message: "Price exceeds cap",
    });

    const result = await processStaleListings(now);

    expect(prisma.priceVerificationRun.create).toHaveBeenCalled();
    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: "list1" },
      data: { status: "STALE", publishedAt: null },
    });
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        objectType: "listing",
        objectId: "list1",
        action: "MARKED_STALE",
        before: { status: "LIVE" },
        after: { status: "STALE", reason: "Price exceeds cap" },
      },
    });
    expect(result.markedStale).toBe(1);
    expect(result.reVerified).toBe(0);
  });

  it("keeps listing as LIVE if evidence is stale but runVerification passes", async () => {
    const now = new Date();
    const observedAt = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 days old (stale)

    vi.mocked(prisma.listing.findMany).mockResolvedValue([
      {
        id: "list1",
        status: "LIVE",
        title: "Test Listing",
        sellerPriceIqd: 40000, // Under cap
        publishedAt: now,
        categoryId: "cat1",
        category: { retailTtlDays: 30 },
        canonicalProduct: {
          id: "prod1",
          brand: "Brand",
          model: "Model",
          retailReferences: [
            {
              id: "ref1",
              observedAt,
              sourceName: "Elryan",
            },
          ],
        },
        verificationRuns: [
          {
            selectedReference: {
              observedAt,
            },
          },
        ],
      },
    ] as any);

    vi.mocked(runVerification).mockReturnValue({
      result: "PASS",
      matchConfidence: 0.9,
      verifiedRetailIqd: 100000,
      computedCapIqd: 50000,
      sourceCount: 2,
      selectedReferenceId: "ref1",
      message: "Verification passed",
    });

    const result = await processStaleListings(now);

    expect(prisma.priceVerificationRun.create).toHaveBeenCalled();
    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: "list1" },
      data: { status: "LIVE", publishedAt: now },
    });
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: {
        objectType: "listing",
        objectId: "list1",
        action: "STALE_REVERIFIED",
        before: { status: "LIVE" },
        after: { status: "LIVE", result: "PASS" },
      },
    });
    expect(result.markedStale).toBe(0);
    expect(result.reVerified).toBe(1);
  });
});
