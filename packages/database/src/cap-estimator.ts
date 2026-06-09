import { computePriceCap } from "@htp/contracts";
import { prisma } from "./client";
import { computeMatchConfidence, selectVerifiedRetailPrice } from "./verification";

export interface CapEstimate {
  title: string;
  categoryId: string;
  categoryName: string;
  matchConfidence: number;
  matchedProduct: { brand: string; model: string } | null;
  verifiedRetailIqd: number | null;
  computedCapIqd: number | null;
  retailSources: string[];
  message: string;
}

export async function estimateCap(
  title: string,
  categoryId: string,
): Promise<CapEstimate | null> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!category || category.whitelistStatus !== "ACTIVE") {
    return null;
  }

  const candidates = await prisma.canonicalProduct.findMany({
    where: { categoryId },
    include: { retailReferences: true },
  });

  let bestMatch: (typeof candidates)[number] | null = null;
  let bestConfidence = 0;

  for (const candidate of candidates) {
    const confidence = computeMatchConfidence(title, candidate);
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatch = candidate;
    }
  }

  if (!bestMatch || bestConfidence < 0.5) {
    return {
      title,
      categoryId,
      categoryName: category.nameEn,
      matchConfidence: bestConfidence,
      matchedProduct: null,
      verifiedRetailIqd: null,
      computedCapIqd: null,
      retailSources: [],
      message:
        "No confident product match. Try including exact brand and model in the title.",
    };
  }

  const selected = selectVerifiedRetailPrice(
    bestMatch.retailReferences,
    category.retailTtlDays,
  );

  if (!selected) {
    return {
      title,
      categoryId,
      categoryName: category.nameEn,
      matchConfidence: bestConfidence,
      matchedProduct: { brand: bestMatch.brand, model: bestMatch.model },
      verifiedRetailIqd: null,
      computedCapIqd: null,
      retailSources: bestMatch.retailReferences.map((r) => r.sourceName),
      message: "Product matched but no fresh retail evidence available.",
    };
  }

  const computedCapIqd = computePriceCap(selected.price);
  const sources = [
    ...new Set(
      bestMatch.retailReferences
        .filter((r) => r.stockState === "IN_STOCK")
        .map((r) => r.sourceName),
    ),
  ];

  return {
    title,
    categoryId,
    categoryName: category.nameEn,
    matchConfidence: bestConfidence,
    matchedProduct: { brand: bestMatch.brand, model: bestMatch.model },
    verifiedRetailIqd: selected.price,
    computedCapIqd,
    retailSources: sources,
    message: `Estimated cap: ${computedCapIqd.toLocaleString()} IQD (50% of ${selected.price.toLocaleString()} IQD verified retail).`,
  };
}
