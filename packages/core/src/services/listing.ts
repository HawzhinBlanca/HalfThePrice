import {
  prisma,
  computeMatchConfidence,
  runVerification,
  resolveListingStatusFromVerification,
  refreshRetailReferencesForTitle,
  acquireAdvisoryLock,
} from "@htp/database";
import type { ListingStatus } from "@htp/contracts";

export async function submitListingForVerification(
  listingId: string,
  sellerId: string,
): Promise<{ success: boolean; status: ListingStatus; message: string }> {
  return await prisma.$transaction(async (tx) => {
    // Acquire exclusive transaction lock on this listing
    await acquireAdvisoryLock(tx, `listing_${listingId}`);

    const listing = await tx.listing.findFirst({
      where: { id: listingId, sellerId },
      include: {
        category: true,
        canonicalProduct: {
          include: { retailReferences: true },
        },
      },
    });

    if (!listing) {
      return { success: false, status: "DRAFT", message: "Listing not found." };
    }

    if (listing.status !== "DRAFT" && listing.status !== "REJECTED") {
      return {
        success: false,
        status: listing.status,
        message: "Listing cannot be submitted in its current state.",
      };
    }

    let canonicalProduct = listing.canonicalProduct;
    let didMatchCanonical = false;
    let matchedCanonicalId: string | null = null;

    if (!canonicalProduct) {
      const candidates = await tx.canonicalProduct.findMany({
        where: { categoryId: listing.categoryId },
        include: { retailReferences: true },
      });

      let bestMatch: (typeof candidates)[number] | null = null;
      let bestConfidence = 0;

      for (const candidate of candidates) {
        const confidence = computeMatchConfidence(listing.title, candidate);
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = candidate;
        }
      }

      if (bestMatch && bestConfidence >= 0.5) {
        canonicalProduct = bestMatch;
        didMatchCanonical = true;
        matchedCanonicalId = bestMatch.id;
      }
    }

    if (canonicalProduct) {
      const freshRefs = canonicalProduct.retailReferences.filter(
        (ref) => ref.stockState === "IN_STOCK",
      );
      if (freshRefs.length === 0) {
        // Run crawler logic to try to fetch fresh refs
        await refreshRetailReferencesForTitle(
          listing.title,
          canonicalProduct.id,
        );
        // Reload canonical product with fresh references
        canonicalProduct = await tx.canonicalProduct.findUnique({
          where: { id: canonicalProduct.id },
          include: { retailReferences: true },
        }) as any;
      }
    }

    const matchConfidence = canonicalProduct
      ? computeMatchConfidence(listing.title, canonicalProduct)
      : 0;

    const decision = runVerification({
      listing: {
        id: listing.id,
        sellerPriceIqd: listing.sellerPriceIqd,
        title: listing.title,
      },
      category: listing.category,
      canonicalProduct,
      retailReferences: canonicalProduct?.retailReferences ?? [],
      matchConfidence,
    });

    const newStatus = resolveListingStatusFromVerification(decision.result);

    if (didMatchCanonical && matchedCanonicalId) {
      await tx.listing.update({
        where: { id: listingId },
        data: { canonicalProductId: matchedCanonicalId },
      });
    }

    await tx.priceVerificationRun.create({
      data: {
        listingId: listing.id,
        matchConfidence: decision.matchConfidence,
        selectedReferenceId: decision.selectedReferenceId,
        verifiedRetailIqd: decision.verifiedRetailIqd,
        computedCapIqd: decision.computedCapIqd,
        sourceCount: decision.sourceCount ?? 0,
        priceCapRatio: decision.priceCapRatio ?? 0.5,
        matchConfidenceThreshold: decision.matchConfidenceThreshold ?? 0.85,
        retailTtlDays: decision.retailTtlDays ?? 30,
        parserVersion: decision.parserVersion ?? "1.0.0",
        result: decision.result,
        message: decision.message,
      },
    });

    await tx.listing.update({
      where: { id: listingId },
      data: {
        status: newStatus,
        publishedAt: newStatus === "LIVE" ? new Date() : null,
      },
    });

    await tx.auditEvent.create({
      data: {
        actorId: sellerId,
        objectType: "listing",
        objectId: listingId,
        action: "VERIFICATION_SUBMITTED",
        after: { result: decision.result, status: newStatus },
      },
    });

    return { success: true, status: newStatus, message: decision.message };
  });
}
