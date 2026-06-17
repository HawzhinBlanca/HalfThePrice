import {
  prisma,
  computeMatchConfidence,
  runVerification,
  resolveListingStatusFromVerification,
  refreshRetailReferencesForTitle,
} from "@htp/database";
import { searchListings as meiliSearch } from "@htp/search";
import type { ListingStatus } from "@htp/contracts";
import { expandFuzzyTokenGroups } from "@/lib/search";
import { syncListingToSearch } from "@/lib/listing-index";

export async function submitListingForVerification(
  listingId: string,
  sellerId: string,
): Promise<{ success: boolean; status: ListingStatus; message: string }> {
  const listing = await prisma.listing.findFirst({
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
    const candidates = await prisma.canonicalProduct.findMany({
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
      await refreshRetailReferencesForTitle(
        listing.title,
        canonicalProduct.id,
      );
      canonicalProduct = await prisma.canonicalProduct.findUnique({
        where: { id: canonicalProduct.id },
        include: { retailReferences: true },
      });
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

  const updatedListing = await prisma.$transaction(async (tx) => {
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
        priceCapRatio: decision.priceCapRatio ?? 0.5,
        matchConfidenceThreshold: decision.matchConfidenceThreshold ?? 0.85,
        retailTtlDays: decision.retailTtlDays ?? 30,
        parserVersion: decision.parserVersion ?? "1.0.0",
        result: decision.result,
        message: decision.message,
      },
    });

    const updated = await tx.listing.update({
      where: { id: listingId },
      data: {
        status: newStatus,
        publishedAt: newStatus === "LIVE" ? new Date() : null,
      },
      include: {
        category: true,
        canonicalProduct: true,
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

    return updated;
  });

  await syncListingToSearch(updatedListing);

  return { success: true, status: newStatus, message: decision.message };
}

import type { ListingSort } from "./constants";

export async function getLiveListings(params: {
  query?: string;
  categoryId?: string;
  governorate?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ListingSort;
  page?: number;
  limit?: number;
}) {
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 12, 50);
  const skip = (page - 1) * limit;

  let meiliResult: Awaited<ReturnType<typeof meiliSearch>> = null;
  try {
    meiliResult = await meiliSearch({
      query: params.query,
      categoryId: params.categoryId,
      governorate: params.governorate,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      sort:
        params.sort === "price_asc" || params.sort === "price_desc"
          ? params.sort
          : "newest",
      page,
      limit,
    });
  } catch {
    meiliResult = null;
  }

  if (meiliResult && meiliResult.hits.length > 0) {
    const ids = meiliResult.hits.map((h) => h.id);
    const listings = await prisma.listing.findMany({
      where: { id: { in: ids }, status: "LIVE" },
      include: {
        category: true,
        canonicalProduct: true,
        verificationRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        seller: {
          select: {
            name: true,
            sellerProfile: { select: { displayName: true, governorate: true } },
          },
        },
      },
    });

    const byId = new Map(listings.map((l) => [l.id, l]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((l): l is NonNullable<typeof l> => Boolean(l));

    return {
      data: ordered,
      total: meiliResult.total,
      page: meiliResult.page,
      limit: meiliResult.limit,
      totalPages: meiliResult.totalPages,
      source: "meilisearch" as const,
    };
  }

  const where = {
    status: "LIVE" as const,
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.governorate ? { governorate: params.governorate } : {}),
    ...((params.minPrice != null || params.maxPrice != null)
      ? {
          sellerPriceIqd: {
            ...(params.minPrice != null ? { gte: params.minPrice } : {}),
            ...(params.maxPrice != null ? { lte: params.maxPrice } : {}),
          },
        }
      : {}),
    ...(params.query
      ? (() => {
          const tokenGroups = expandFuzzyTokenGroups(params.query);
          const fieldMatch = (token: string) => ({
            OR: [
              { title: { contains: token, mode: "insensitive" as const } },
              { description: { contains: token, mode: "insensitive" as const } },
              {
                canonicalProduct: {
                  OR: [
                    { brand: { contains: token, mode: "insensitive" as const } },
                    { model: { contains: token, mode: "insensitive" as const } },
                  ],
                },
              },
            ],
          });

          if (tokenGroups.length === 0) {
            return fieldMatch(params.query);
          }

          return {
            AND: tokenGroups.map((variants) => ({
              OR: variants.map((token) => fieldMatch(token)),
            })),
          };
        })()
      : {}),
  };

  const sort = params.sort ?? "newest";

  const orderBy =
    sort === "price_asc"
      ? { sellerPriceIqd: "asc" as const }
      : sort === "price_desc"
        ? { sellerPriceIqd: "desc" as const }
        : { publishedAt: "desc" as const };

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: {
        category: true,
        canonicalProduct: true,
        verificationRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        seller: {
          select: {
            name: true,
            sellerProfile: { select: { displayName: true, governorate: true } },
          },
        },
      },
      orderBy,
      skip: sort === "savings" ? 0 : skip,
      take: sort === "savings" ? 200 : limit,
    }),
    prisma.listing.count({ where }),
  ]);

  let data = listings;

  if (sort === "savings") {
    data = [...listings]
      .sort((a, b) => {
        const retailA = a.verificationRuns[0]?.verifiedRetailIqd ?? 0;
        const retailB = b.verificationRuns[0]?.verifiedRetailIqd ?? 0;
        const savingsA =
          retailA > 0 ? (retailA - a.sellerPriceIqd) / retailA : 0;
        const savingsB =
          retailB > 0 ? (retailB - b.sellerPriceIqd) / retailB : 0;
        return savingsB - savingsA;
      })
      .slice(skip, skip + limit);
  }

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    source: "prisma" as const,
  };
}
