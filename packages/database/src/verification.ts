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

export interface VerificationInput {
  listing: Pick<Listing, "id" | "sellerPriceIqd" | "title">;
  category: Pick<Category, "whitelistStatus" | "matchConfidenceThreshold" | "retailTtlDays">;
  canonicalProduct: Pick<CanonicalProduct, "brand" | "model"> | null;
  retailReferences: Pick<
    RetailReference,
    "id" | "observedPriceIqd" | "observedAt" | "stockState" | "sourceName"
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

export function selectVerifiedRetailPrice(
  references: VerificationInput["retailReferences"],
  ttlDays: number,
): { price: number; referenceId: string } | null {
  const freshInStock = references.filter(
    (ref) =>
      ref.stockState === "IN_STOCK" &&
      isReferenceFresh(ref.observedAt, ttlDays),
  );

  if (freshInStock.length === 0) return null;

  const prices = filterOutliers(freshInStock.map((r) => r.observedPriceIqd));
  if (prices.length === 0) return null;

  const medianPrice = median(prices);

  const closest = freshInStock.reduce((best, ref) => {
    const diff = Math.abs(ref.observedPriceIqd - medianPrice);
    const bestDiff = Math.abs(best.observedPriceIqd - medianPrice);
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
      message: "No fresh retail reference available.",
    };
  }

  const capCheck = checkPriceCap(listing.sellerPriceIqd, selected.price);

  if (!capCheck.passesCap) {
    return {
      result: "FAIL",
      matchConfidence,
      verifiedRetailIqd: selected.price,
      computedCapIqd: capCheck.computedCapIqd,
      selectedReferenceId: selected.referenceId,
      message: `Price ${listing.sellerPriceIqd.toLocaleString()} IQD exceeds cap of ${capCheck.computedCapIqd.toLocaleString()} IQD (50% of verified retail).`,
    };
  }

  return {
    result: "PASS",
    matchConfidence,
    verifiedRetailIqd: selected.price,
    computedCapIqd: capCheck.computedCapIqd,
    selectedReferenceId: selected.referenceId,
    message: "Listing passes price verification and is eligible for publication.",
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
