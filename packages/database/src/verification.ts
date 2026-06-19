import { createHash } from "node:crypto";
import {
  checkPriceCap,
  computePriceCap,
  type VerificationSummary,
} from "@htp/contracts";
import type {
  Category,
  CanonicalProduct,
  Listing,
  RetailReference,
  VerificationResult,
} from "@prisma/client";

export const TRUSTED_SOURCES = new Set([
  "official-retailer",
  "authorized-dealer",
  "brand-website",
  "verified-marketplace",
  "Elryan",
  "Miswag",
  "Alhafidh",
  "iCenter Iraq",
]);

export interface VerificationInput {
  listing: Pick<Listing, "id" | "sellerPriceIqd" | "title">;
  category: Pick<Category, "whitelistStatus" | "matchConfidenceThreshold" | "retailTtlDays">;
  canonicalProduct: Pick<CanonicalProduct, "brand" | "model"> | null;
  retailReferences: Pick<
    RetailReference,
    | "id"
    | "observedPriceIqd"
    | "observedAt"
    | "stockState"
    | "sourceName"
    | "nativeCurrency"
    | "nativeAmount"
    | "exchangeRate"
    | "rateTimestamp"
  >[];
  matchConfidence: number;
}

export interface VerificationDecision {
  result: VerificationResult;
  matchConfidence: number;
  verifiedRetailIqd: number | null;
  computedCapIqd: number | null;
  selectedReferenceId: string | null;
  message: string;
  sourceCount?: number;
  priceCapRatio?: number;
  matchConfidenceThreshold?: number;
  retailTtlDays?: number;
  parserVersion?: string;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const lower = sorted[mid - 1];
    const upper = sorted[mid];
    if (lower === undefined || upper === undefined) return 0;
    return Math.floor((lower + upper) / 2);
  }
  const value = sorted[mid];
  return value ?? 0;
}

function filterOutliers(prices: number[]): number[] {
  if (prices.length <= 2) return prices;
  const sorted = [...prices].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
  const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return prices.filter((p) => p >= lower && p <= upper);
}

function isReferenceFresh(
  observedAt: Date,
  ttlDays: number,
  now: Date = new Date(),
): boolean {
  const ageMs = now.getTime() - observedAt.getTime();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  return ageMs <= ttlMs;
}

export function resolveRefPriceIqd(
  ref: Pick<RetailReference, "observedPriceIqd" | "nativeCurrency" | "nativeAmount" | "exchangeRate">
): number {
  const currency = ref.nativeCurrency ?? "IQD";
  const amount = ref.nativeAmount ?? ref.observedPriceIqd;
  const rate = ref.exchangeRate ?? 1.0;
  return Math.round(amount * rate);
}

export function selectVerifiedRetailPrice(
  references: VerificationInput["retailReferences"],
  ttlDays: number,
): { price: number; referenceId: string } | null {
  const freshInStock = references.filter(
    (ref) =>
      ref.stockState === "IN_STOCK" &&
      isReferenceFresh(ref.observedAt, ttlDays) &&
      TRUSTED_SOURCES.has(ref.sourceName),
  );

  if (freshInStock.length === 0) return null;

  const rawPrices = freshInStock.map((r) => resolveRefPriceIqd(r));
  const medianRaw = median(rawPrices);

  // Anomaly guard: reject references whose price jumps > 30% vs the median of fresh references
  const cleanReferences = freshInStock.filter((ref) => {
    const priceIqd = resolveRefPriceIqd(ref);
    const ratio = priceIqd / medianRaw;
    return ratio >= 0.7 && ratio <= 1.3;
  });

  if (cleanReferences.length === 0) return null;

  const prices = filterOutliers(cleanReferences.map((r) => resolveRefPriceIqd(r)));
  if (prices.length === 0) return null;

  const medianPrice = median(prices);

  const closest = cleanReferences.reduce((best, ref) => {
    const diff = Math.abs(resolveRefPriceIqd(ref) - medianPrice);
    const bestDiff = Math.abs(resolveRefPriceIqd(best) - medianPrice);
    return diff < bestDiff ? ref : best;
  });

  return { price: medianPrice, referenceId: closest.id };
}

export function runVerification(input: VerificationInput): VerificationDecision {
  const {
    listing,
    category,
    canonicalProduct,
    retailReferences,
    matchConfidence,
  } = input;

  if (category.whitelistStatus !== "ACTIVE") {
    return {
      result: "FAIL",
      matchConfidence,
      verifiedRetailIqd: null,
      computedCapIqd: null,
      selectedReferenceId: null,
      sourceCount: 0,
      priceCapRatio: 0.5,
      matchConfidenceThreshold: category.matchConfidenceThreshold,
      retailTtlDays: category.retailTtlDays,
      message: "Category is not approved for listing.",
    };
  }

  if (!canonicalProduct) {
    return {
      result: "MANUAL_REVIEW",
      matchConfidence: 0,
      verifiedRetailIqd: null,
      computedCapIqd: null,
      selectedReferenceId: null,
      sourceCount: 0,
      priceCapRatio: 0.5,
      matchConfidenceThreshold: category.matchConfidenceThreshold,
      retailTtlDays: category.retailTtlDays,
      message: "No canonical product match found. Sent to manual review.",
    };
  }

  if (matchConfidence < category.matchConfidenceThreshold) {
    return {
      result: "MANUAL_REVIEW",
      matchConfidence,
      verifiedRetailIqd: null,
      computedCapIqd: null,
      selectedReferenceId: null,
      sourceCount: 0,
      priceCapRatio: 0.5,
      matchConfidenceThreshold: category.matchConfidenceThreshold,
      retailTtlDays: category.retailTtlDays,
      message: `Match confidence ${(matchConfidence * 100).toFixed(0)}% below threshold.`,
    };
  }

  const selected = selectVerifiedRetailPrice(
    retailReferences,
    category.retailTtlDays,
  );

  if (!selected) {
    return {
      result: "MANUAL_REVIEW",
      matchConfidence,
      verifiedRetailIqd: null,
      computedCapIqd: null,
      selectedReferenceId: null,
      sourceCount: 0,
      priceCapRatio: 0.5,
      matchConfidenceThreshold: category.matchConfidenceThreshold,
      retailTtlDays: category.retailTtlDays,
      message: "No fresh retail reference available.",
    };
  }

  // Calculate unique sources from clean references
  const freshInStock = retailReferences.filter(
    (ref) =>
      ref.stockState === "IN_STOCK" &&
      isReferenceFresh(ref.observedAt, category.retailTtlDays) &&
      TRUSTED_SOURCES.has(ref.sourceName),
  );

  let cleanReferences = freshInStock;
  if (freshInStock.length > 0) {
    const rawPrices = freshInStock.map((r) => resolveRefPriceIqd(r));
    const medianRaw = median(rawPrices);
    cleanReferences = freshInStock.filter((ref) => {
      const priceIqd = resolveRefPriceIqd(ref);
      const ratio = priceIqd / medianRaw;
      return ratio >= 0.7 && ratio <= 1.3;
    });
  }
  const uniqueSources = new Set(cleanReferences.map((ref) => ref.sourceName));
  const sourceCount = uniqueSources.size;

  const capCheck = checkPriceCap(listing.sellerPriceIqd, selected.price);

  if (!capCheck.passesCap) {
    return {
      result: "FAIL",
      matchConfidence,
      verifiedRetailIqd: selected.price,
      computedCapIqd: capCheck.computedCapIqd,
      selectedReferenceId: selected.referenceId,
      sourceCount,
      priceCapRatio: 0.5,
      matchConfidenceThreshold: category.matchConfidenceThreshold,
      retailTtlDays: category.retailTtlDays,
      message: `Price ${listing.sellerPriceIqd.toLocaleString()} IQD exceeds cap of ${capCheck.computedCapIqd.toLocaleString()} IQD (50% of verified retail).`,
    };
  }

  // Check for stale exchange rates
  const now = new Date();
  let exchangeRateStale = false;
  for (const ref of retailReferences) {
    if (ref.nativeCurrency && ref.nativeCurrency !== "IQD" && ref.rateTimestamp) {
      const ageMs = now.getTime() - new Date(ref.rateTimestamp).getTime();
      if (ageMs > 7 * 24 * 60 * 60 * 1000) {
        console.warn(`Exchange rate for reference ${ref.id} (${ref.sourceName}) is stale (older than 7 days)`);
        exchangeRateStale = true;
      }
    }
  }

  if (sourceCount < 2) {
    return {
      result: "MANUAL_REVIEW",
      matchConfidence,
      verifiedRetailIqd: selected.price,
      computedCapIqd: capCheck.computedCapIqd,
      selectedReferenceId: selected.referenceId,
      sourceCount,
      priceCapRatio: 0.5,
      matchConfidenceThreshold: category.matchConfidenceThreshold,
      retailTtlDays: category.retailTtlDays,
      message: `Quorum not met: only ${sourceCount} independent sources available (minimum 2 required). Sent to manual review.`,
    };
  }

  const warningSuffix = exchangeRateStale ? " Warning: Stale exchange rates used." : "";

  return {
    result: "PASS",
    matchConfidence,
    verifiedRetailIqd: selected.price,
    computedCapIqd: capCheck.computedCapIqd,
    selectedReferenceId: selected.referenceId,
    sourceCount,
    priceCapRatio: 0.5,
    matchConfidenceThreshold: category.matchConfidenceThreshold,
    retailTtlDays: category.retailTtlDays,
    message: "Listing passes price verification and is eligible for publication." + warningSuffix,
  };
}

export function toVerificationSummary(
  decision: VerificationDecision,
): VerificationSummary {
  return {
    result: decision.result,
    matchConfidence: decision.matchConfidence,
    computedCapIqd: decision.computedCapIqd,
    verifiedRetailIqd: decision.verifiedRetailIqd,
    message: decision.message,
  };
}

export function computeMatchConfidence(
  listingTitle: string,
  product: Pick<CanonicalProduct, "brand" | "model">,
): number {
  const normalized = listingTitle.toLowerCase();
  const brand = product.brand.toLowerCase();
  const model = product.model.toLowerCase();

  let score = 0;
  if (normalized.includes(brand)) score += 0.4;
  if (normalized.includes(model)) score += 0.5;

  const modelTokens = model.split(/\s+/);
  const matchedTokens = modelTokens.filter((t) => normalized.includes(t)).length;
  score += (matchedTokens / Math.max(modelTokens.length, 1)) * 0.1;

  return Math.min(score, 1);
}

export function hashEvidence(sourceUrl: string, price: number, observedAt: Date): string {
  return createHash("sha256")
    .update(`${sourceUrl}|${price}|${observedAt.toISOString()}`)
    .digest("hex");
}

export function validateOfferAmount(
  offerAmountIqd: number,
  capSnapshotIqd: number,
): { valid: boolean; reason?: string } {
  if (offerAmountIqd > capSnapshotIqd) {
    return {
      valid: false,
      reason: `Offer exceeds the verified cap of ${capSnapshotIqd.toLocaleString()} IQD.`,
    };
  }
  if (offerAmountIqd <= 0) {
    return { valid: false, reason: "Offer amount must be positive." };
  }
  return { valid: true };
}

export { computePriceCap, checkPriceCap };
