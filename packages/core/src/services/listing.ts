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
  // 1. Fetch listing first to check status and match canonical product WITHOUT transaction
  const initialListing = await prisma.listing.findFirst({
    where: { id: listingId, sellerId },
    include: {
      category: true,
      canonicalProduct: {
        include: { retailReferences: true },
      },
    },
  });

  if (!initialListing) {
    return { success: false, status: "DRAFT", message: "Listing not found." };
  }

  if (initialListing.status !== "DRAFT" && initialListing.status !== "REJECTED") {
    return {
      success: false,
      status: initialListing.status,
      message: "Listing cannot be submitted in its current state.",
    };
  }

  // 2. Perform Jaro-Winkler match to find canonical product if not linked yet, WITHOUT transaction
  let canonicalProduct = initialListing.canonicalProduct;
  let didMatchCanonical = false;
  let matchedCanonicalId: string | null = null;

  if (!canonicalProduct) {
    const candidates = await prisma.canonicalProduct.findMany({
      where: { categoryId: initialListing.categoryId },
      include: { retailReferences: true },
    });

    let bestMatch: (typeof candidates)[number] | null = null;
    let bestConfidence = 0;

    for (const candidate of candidates) {
      const confidence = computeMatchConfidence(initialListing.title, candidate);
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

  // 3. Trigger crawler refresh outside of transaction bounds if references are stale / empty
  if (canonicalProduct) {
    const freshRefs = canonicalProduct.retailReferences.filter(
      (ref) => ref.stockState === "IN_STOCK",
    );
    if (freshRefs.length === 0) {
      // Run crawler logic to try to fetch fresh refs (makes external HTTP requests)
      await refreshRetailReferencesForTitle(
        initialListing.title,
        canonicalProduct.id,
      );
      // Reload canonical product with fresh references (still outside transaction)
      canonicalProduct = await prisma.canonicalProduct.findUnique({
        where: { id: canonicalProduct.id },
        include: { retailReferences: true },
      });
    }
  }

  // 4. Start the database transaction to perform the actual state change and validation
  return await prisma.$transaction(async (tx) => {
    // Acquire exclusive transaction lock on this listing to prevent concurrent mutations
    await acquireAdvisoryLock(tx, `listing_${listingId}`);

    // Re-fetch inside transaction to ensure we have the absolute latest listing state
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

    // Use the latest references from database if matched canonical product was loaded/reloaded
    let finalCanonical = listing.canonicalProduct;
    if (!finalCanonical && matchedCanonicalId) {
      // Reload the matched canonical product within transaction
      finalCanonical = await tx.canonicalProduct.findUnique({
        where: { id: matchedCanonicalId },
        include: { retailReferences: true },
      });
    } else if (finalCanonical) {
      // Re-read references inside transaction to capture the ones inserted by the crawler refresh
      finalCanonical = await tx.canonicalProduct.findUnique({
        where: { id: finalCanonical.id },
        include: { retailReferences: true },
      });
    }

    const matchConfidence = finalCanonical
      ? computeMatchConfidence(listing.title, finalCanonical)
      : 0;

    const decision = runVerification({
      listing: {
        id: listing.id,
        sellerPriceIqd: listing.sellerPriceIqd,
        title: listing.title,
      },
      category: listing.category,
      canonicalProduct: finalCanonical,
      retailReferences: finalCanonical?.retailReferences ?? [],
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
