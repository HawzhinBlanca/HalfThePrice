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
});
