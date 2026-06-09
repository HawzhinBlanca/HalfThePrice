export const PRICE_CAP_RATIO = 0.5;

export type UserRole = "BUYER" | "SELLER" | "ADMIN";

export type ListingStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "MANUAL_REVIEW"
  | "LIVE"
  | "REJECTED"
  | "STALE"
  | "HIDDEN";

export type VerificationResult = "PASS" | "FAIL" | "MANUAL_REVIEW" | "PENDING";

export type CategoryWhitelistStatus = "ACTIVE" | "BLOCKED" | "PENDING";

export type OfferStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";

export interface PriceCapComputation {
  verifiedRetailIqd: number;
  computedCapIqd: number;
  sellerPriceIqd: number;
  passesCap: boolean;
  ratio: number;
}

export interface VerificationSummary {
  result: VerificationResult;
  matchConfidence: number;
  computedCapIqd: number | null;
  verifiedRetailIqd: number | null;
  message: string;
}

export interface ListingSearchFilters {
  query?: string;
  categoryId?: string;
  governorate?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}

export function computePriceCap(verifiedRetailIqd: number): number {
  return Math.floor(PRICE_CAP_RATIO * verifiedRetailIqd);
}

export function checkPriceCap(
  sellerPriceIqd: number,
  verifiedRetailIqd: number,
): PriceCapComputation {
  const computedCapIqd = computePriceCap(verifiedRetailIqd);
  const passesCap = sellerPriceIqd <= computedCapIqd;
  const ratio = verifiedRetailIqd > 0 ? sellerPriceIqd / verifiedRetailIqd : 1;

  return {
    verifiedRetailIqd,
    computedCapIqd,
    sellerPriceIqd,
    passesCap,
    ratio,
  };
}

export function formatIqd(amount: number): string {
  return new Intl.NumberFormat("en-IQ", {
    style: "currency",
    currency: "IQD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatSavingsPercent(sellerPrice: number, retailPrice: number): number {
  if (retailPrice <= 0) return 0;
  return Math.round(((retailPrice - sellerPrice) / retailPrice) * 100);
}
