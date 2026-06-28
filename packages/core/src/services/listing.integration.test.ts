import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@htp/database";
import { submitListingForVerification } from "./listing";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("submitListingForVerification (integration)", () => {
  let sellerId: string;
  let categoryId: string;
  let canonicalProductId: string;
  const createdListingIds: string[] = [];

  beforeAll(async () => {
    const seller = await prisma.user.findUnique({
      where: { email: "seller@half-the-price.iq" },
    });
    const canonical = await prisma.canonicalProduct.findFirst();

    if (!seller || !canonical) {
      throw new Error("Seed data required. Run `pnpm db:seed` first.");
    }

    sellerId = seller.id;
    categoryId = canonical.categoryId;
    canonicalProductId = canonical.id;
  });

  afterAll(async () => {
    // Clean up created listings and verification runs
    if (createdListingIds.length > 0) {
      await prisma.auditEvent.deleteMany({
        where: { objectType: "listing", objectId: { in: createdListingIds } },
      });
      await prisma.priceVerificationRun.deleteMany({
        where: { listingId: { in: createdListingIds } },
      });
      await prisma.listing.deleteMany({
        where: { id: { in: createdListingIds } },
      });
    }
    await prisma.$disconnect();
  });

  async function createDraftListing(title: string, price: number): Promise<string> {
    const listing = await prisma.listing.create({
      data: {
        sellerId,
        categoryId,
        title,
        sellerPriceIqd: price,
        status: "DRAFT",
        governorate: "Baghdad",
      },
    });
    createdListingIds.push(listing.id);
    return listing.id;
  }

  it("fails when listing does not exist", async () => {
    const result = await submitListingForVerification("non-existent-id", sellerId);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Listing not found.");
  });

  it("handles Jaro-Winkler matching and verifies a valid draft listing successfully", async () => {
    // Create a draft listing with the same title as a canonical product to test matching
    const canonical = await prisma.canonicalProduct.findUniqueOrThrow({
      where: { id: canonicalProductId },
    });

    const listingId = await createDraftListing(`${canonical.brand} ${canonical.model} E2E Match`, 100_000);
    const result = await submitListingForVerification(listingId, sellerId);

    expect(result.success).toBe(true);
    expect(result.status).toBeDefined();

    // Check that a verification run was created
    const runs = await prisma.priceVerificationRun.findMany({
      where: { listingId },
    });
    expect(runs.length).toBe(1);
    expect(runs[0]?.matchConfidence).toBeGreaterThanOrEqual(0.5);
  });

  it("rejects submission if listing is already LIVE", async () => {
    const listingId = await createDraftListing("Samsung Galaxy", 120_000);

    const ref = await prisma.retailReference.findFirst({
      where: { canonicalProductId },
    });
    if (!ref) {
      throw new Error("No retail reference found for canonical product.");
    }

    // Mock verification run to allow LIVE status insertion
    await prisma.priceVerificationRun.create({
      data: {
        listingId,
        matchConfidence: 1.0,
        result: "PASS",
        verifiedRetailIqd: 300_000,
        computedCapIqd: 150_000,
        sourceCount: 2,
        selectedReferenceId: ref.id,
      },
    });

    await prisma.listing.update({
      where: { id: listingId },
      data: { status: "LIVE" },
    });

    const result = await submitListingForVerification(listingId, sellerId);
    expect(result.success).toBe(false);
    expect(result.message).toContain("cannot be submitted");
  });

  it("survives concurrent double-submission race gracefully", async () => {
    const canonical = await prisma.canonicalProduct.findUniqueOrThrow({
      where: { id: canonicalProductId },
    });

    const listingId = await createDraftListing(`${canonical.brand} ${canonical.model} Race Test`, 100_000);

    // Submit twice concurrently. The advisory lock must serialize them.
    const results = await Promise.allSettled([
      submitListingForVerification(listingId, sellerId),
      submitListingForVerification(listingId, sellerId),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBe(2);

    const values = fulfilled.map((r) => (r as PromiseFulfilledResult<any>).value);
    // The first submission succeeds and changes the status to LIVE or MANUAL_REVIEW.
    // The second submission reads the updated status and returns a validation error (already submitted).
    const successResult = values.find((v) => v.success === true);
    const failResult = values.find((v) => v.success === false);

    expect(successResult).toBeDefined();
    expect(failResult).toBeDefined();
    expect(failResult?.message).toContain("cannot be submitted");
  });

  it("handles no canonical product match (sent to manual review)", async () => {
    const listingId = await createDraftListing("Unmatched Random Brand New Item 2026", 100_000);
    const result = await submitListingForVerification(listingId, sellerId);

    expect(result.success).toBe(true);
    expect(result.status).toBe("MANUAL_REVIEW");

    const runs = await prisma.priceVerificationRun.findMany({
      where: { listingId },
    });
    expect(runs.length).toBe(1);
    expect(runs[0]?.result).toBe("MANUAL_REVIEW");
    expect(runs[0]?.matchConfidence).toBe(0);
  });

  it("verifies successfully with pre-linked canonical product", async () => {
    // Create draft listing with pre-linked canonicalProductId
    const listing = await prisma.listing.create({
      data: {
        sellerId,
        categoryId,
        title: "Pre-linked Samsung",
        sellerPriceIqd: 100_000,
        status: "DRAFT",
        governorate: "Baghdad",
        canonicalProductId,
      },
    });
    createdListingIds.push(listing.id);

    const result = await submitListingForVerification(listing.id, sellerId);
    expect(result.success).toBe(true);
  });
});
