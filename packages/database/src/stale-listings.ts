import { prisma } from "./client";
import { runVerification, computeMatchConfidence } from "./verification";
import { acquireAdvisoryLock } from "./locks";

export interface StaleListingResult {
  listingId: string;
  previousStatus: string;
  action: "MARKED_STALE" | "RE_VERIFIED_LIVE" | "SKIPPED";
  message: string;
}

export interface ProcessStaleListingsSummary {
  processed: number;
  markedStale: number;
  reVerified: number;
  results: StaleListingResult[];
}

function isReferenceStale(observedAt: Date, ttlDays: number, now: Date): boolean {
  const ageMs = now.getTime() - observedAt.getTime();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  return ageMs > ttlMs;
}

export async function processStaleListings(
  now: Date = new Date(),
): Promise<ProcessStaleListingsSummary> {
  return await prisma.$transaction(async (tx) => {
    await acquireAdvisoryLock(tx, "stale_listings_cron");

    // Bounded batch: process at most 100 listings per cron tick to prevent OOM on TTL cliff
    const liveListings = await tx.listing.findMany({
      where: { status: "LIVE" },
      include: {
        category: true,
        canonicalProduct: { include: { retailReferences: true } },
        verificationRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { selectedReference: true },
        },
      },
      take: 100,
      orderBy: { updatedAt: "asc" }, // oldest-updated first, so stale items are processed first
    });

    const results: StaleListingResult[] = [];
    let markedStale = 0;
    let reVerified = 0;

    for (const listing of liveListings) {
      const latestRun = listing.verificationRuns[0];
      const selectedRef = latestRun?.selectedReference;

      const evidenceStale =
        !selectedRef ||
        isReferenceStale(selectedRef.observedAt, listing.category.retailTtlDays, now);

      if (!evidenceStale) {
        results.push({
          listingId: listing.id,
          previousStatus: listing.status,
          action: "SKIPPED",
          message: "Retail evidence still fresh.",
        });
        continue;
      }

      const matchConfidence = listing.canonicalProduct
        ? computeMatchConfidence(listing.title, listing.canonicalProduct)
        : 0;

      const decision = runVerification({
        listing: {
          id: listing.id,
          sellerPriceIqd: listing.sellerPriceIqd,
          title: listing.title,
        },
        category: listing.category,
        canonicalProduct: listing.canonicalProduct,
        retailReferences: listing.canonicalProduct?.retailReferences ?? [],
        matchConfidence,
      });

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
          message: `Stale check: ${decision.message}`,
        },
      });

      if (decision.result === "PASS") {
        await tx.listing.update({
          where: { id: listing.id },
          data: { status: "LIVE", publishedAt: listing.publishedAt ?? now },
        });

        await tx.auditEvent.create({
          data: {
            objectType: "listing",
            objectId: listing.id,
            action: "STALE_REVERIFIED",
            before: { status: "LIVE" },
            after: { status: "LIVE", result: decision.result },
          },
        });

        reVerified += 1;
        results.push({
          listingId: listing.id,
          previousStatus: listing.status,
          action: "RE_VERIFIED_LIVE",
          message: decision.message,
        });
      } else {
        await tx.listing.update({
          where: { id: listing.id },
          data: { status: "STALE", publishedAt: null },
        });

        await tx.auditEvent.create({
          data: {
            objectType: "listing",
            objectId: listing.id,
            action: "MARKED_STALE",
            before: { status: "LIVE" },
            after: { status: "STALE", reason: decision.message },
          },
        });

        markedStale += 1;
        results.push({
          listingId: listing.id,
          previousStatus: listing.status,
          action: "MARKED_STALE",
          message: decision.message,
        });
      }
    }

    return {
      processed: liveListings.length,
      markedStale,
      reVerified,
      results,
    };
  });
}
