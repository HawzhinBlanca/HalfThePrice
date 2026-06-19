import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "./client";
import { runVerification, computeMatchConfidence } from "./verification";
import { resolveListingStatusFromVerification } from "./state-machine";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("verification integration", () => {
  let categoryId: string;
  let productId: string;
  let sellerId: string;

  beforeAll(async () => {
    const category = await prisma.category.findFirst({
      where: { slug: "phones" },
    });
    const product = await prisma.canonicalProduct.findFirst({
      where: { fingerprintHash: "samsung-galaxy-s24-ultra-256" },
      include: { retailReferences: true },
    });
    const seller = await prisma.user.findUnique({
      where: { email: "seller@half-the-price.iq" },
    });

    if (!category || !product || !seller) {
      throw new Error("Seed data required. Run pnpm db:seed first.");
    }

    categoryId = category.id;
    productId = product.id;
    sellerId = seller.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("transitions DRAFT listing through verification to LIVE when under cap", async () => {
    const listing = await prisma.listing.create({
      data: {
        sellerId,
        categoryId,
        canonicalProductId: productId,
        title: "Samsung Galaxy S24 Ultra 256GB - Integration Test",
        sellerPriceIqd: 800_000,
        status: "DRAFT",
        governorate: "Baghdad",
      },
    });

    const product = await prisma.canonicalProduct.findUniqueOrThrow({
      where: { id: productId },
      include: { retailReferences: true },
    });
    const category = await prisma.category.findUniqueOrThrow({
      where: { id: categoryId },
    });

    const matchConfidence = computeMatchConfidence(listing.title, product);
    const decision = runVerification({
      listing: {
        id: listing.id,
        sellerPriceIqd: listing.sellerPriceIqd,
        title: listing.title,
      },
      category,
      canonicalProduct: product,
      retailReferences: product.retailReferences,
      matchConfidence,
    });

    const newStatus = resolveListingStatusFromVerification(decision.result);
    expect(decision.result).toBe("PASS");
    expect(newStatus).toBe("LIVE");

    await prisma.priceVerificationRun.create({
      data: {
        listingId: listing.id,
        matchConfidence: decision.matchConfidence,
        selectedReferenceId: decision.selectedReferenceId,
        verifiedRetailIqd: decision.verifiedRetailIqd,
        computedCapIqd: decision.computedCapIqd,
        sourceCount: decision.sourceCount,
        result: decision.result,
        message: decision.message,
      },
    });

    await prisma.listing.update({
      where: { id: listing.id },
      data: { status: newStatus, publishedAt: new Date() },
    });

    const updated = await prisma.listing.findUniqueOrThrow({
      where: { id: listing.id },
    });
    expect(updated.status).toBe("LIVE");

    await prisma.priceVerificationRun.deleteMany({ where: { listingId: listing.id } });
    await prisma.listing.delete({ where: { id: listing.id } });
  });

  it("rejects listing when price exceeds cap", async () => {
    const listing = await prisma.listing.create({
      data: {
        sellerId,
        categoryId,
        canonicalProductId: productId,
        title: "Samsung Galaxy S24 Ultra 256GB - Over Cap",
        sellerPriceIqd: 2_000_000,
        status: "DRAFT",
        governorate: "Baghdad",
      },
    });

    const product = await prisma.canonicalProduct.findUniqueOrThrow({
      where: { id: productId },
      include: { retailReferences: true },
    });
    const category = await prisma.category.findUniqueOrThrow({
      where: { id: categoryId },
    });

    const decision = runVerification({
      listing: {
        id: listing.id,
        sellerPriceIqd: listing.sellerPriceIqd,
        title: listing.title,
      },
      category,
      canonicalProduct: product,
      retailReferences: product.retailReferences,
      matchConfidence: 0.95,
    });

    expect(decision.result).toBe("FAIL");
    expect(resolveListingStatusFromVerification(decision.result)).toBe("REJECTED");

    await prisma.listing.delete({ where: { id: listing.id } });
  });

  it("database trigger: rejects PASS verification run when sourceCount is less than 2", async () => {
    const listing = await prisma.listing.create({
      data: {
        sellerId,
        categoryId,
        canonicalProductId: productId,
        title: "Database Trigger Quorum Test",
        sellerPriceIqd: 500_000,
        status: "DRAFT",
        governorate: "Baghdad",
      },
    });

    // Try inserting a PASS run with sourceCount = 1 (violates check_price_verification_run_integrity)
    await expect(
      prisma.priceVerificationRun.create({
        data: {
          listingId: listing.id,
          matchConfidence: 0.95,
          verifiedRetailIqd: 1_000_000,
          computedCapIqd: 500_000,
          sourceCount: 1, // < 2
          result: "PASS",
          message: "Trigger Test",
        },
      })
    ).rejects.toThrow(/sourceCount.*must be at least 2/);

    await prisma.listing.delete({ where: { id: listing.id } });
  });

  it("database trigger: rejects PASS verification run when computedCapIqd does not match recomputed cap", async () => {
    const listing = await prisma.listing.create({
      data: {
        sellerId,
        categoryId,
        canonicalProductId: productId,
        title: "Database Trigger Cap Integrity Test",
        sellerPriceIqd: 500_000,
        status: "DRAFT",
        governorate: "Baghdad",
      },
    });

    // Try inserting a PASS run with computedCapIqd != verifiedRetailIqd * 0.5 (violates check_price_verification_run_integrity)
    await expect(
      prisma.priceVerificationRun.create({
        data: {
          listingId: listing.id,
          matchConfidence: 0.95,
          verifiedRetailIqd: 1_000_000,
          computedCapIqd: 600_000, // Should be 500_000
          sourceCount: 2,
          result: "PASS",
          message: "Trigger Test",
        },
      })
    ).rejects.toThrow(/computedCapIqd.*does not match recomputed cap/);

    await prisma.listing.delete({ where: { id: listing.id } });
  });

  it("database trigger: rejects publishing listing to LIVE when the price is over the recomputed cap", async () => {
    const listing = await prisma.listing.create({
      data: {
        sellerId,
        categoryId,
        canonicalProductId: productId,
        title: "Database Trigger Listing Cap Test",
        sellerPriceIqd: 600_000, // Over 500_000 cap
        status: "DRAFT",
        governorate: "Baghdad",
      },
    });

    // Insert a valid PASS run first (which is successfully stored because it conforms to the run integrity trigger)
    const run = await prisma.priceVerificationRun.create({
      data: {
        listingId: listing.id,
        matchConfidence: 0.95,
        verifiedRetailIqd: 1_000_000,
        computedCapIqd: 500_000,
        sourceCount: 2,
        result: "PASS",
        message: "Trigger Test",
      },
    });

    // Attempt to set listing status to LIVE. The database trigger check_listing_price_cap must recompute the cap and block it.
    await expect(
      prisma.listing.update({
        where: { id: listing.id },
        data: { status: "LIVE" },
      })
    ).rejects.toThrow(/exceeds recomputed cap/);

    await prisma.priceVerificationRun.delete({ where: { id: run.id } });
    await prisma.listing.delete({ where: { id: listing.id } });
  });
});
