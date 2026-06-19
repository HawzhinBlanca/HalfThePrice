import type { RetailObservation } from "../types";

export const ALHAFIDH_ORIGIN = "https://alhafidh.com";
export const ALHAFIDH_SEARCH_PATH = "/en/search/suggest.json";

export interface ShopifyProductImage {
  alt?: string;
  aspect_ratio?: number;
  height?: number;
  url?: string;
  width?: number;
}

export interface ShopifyProductHit {
  available: boolean;
  body?: string;
  compare_at_price_max?: string;
  compare_at_price_min?: string;
  handle: string;
  id: number;
  image?: string;
  price: string;
  price_max?: string;
  price_min?: string;
  tags?: string[];
  title: string;
  type?: string;
  url: string;
  vendor: string;
  featured_image?: ShopifyProductImage;
}

export interface AlhafidhSearchResponse {
  resources?: {
    results?: {
      products?: ShopifyProductHit[];
    };
  };
}

export function parseAlhafidhSearchResponse(
  payload: AlhafidhSearchResponse,
  queryTitle: string,
): RetailObservation[] {
  const products = payload.resources?.results?.products ?? [];
  const queryTokens = normalize(queryTitle).split(/\s+/).filter(Boolean);

  const ranked = products
    .map((product) => {
      if (!product.title) return null;

      const priceVal = parseFloat(product.price);
      if (isNaN(priceVal) || priceVal <= 0) return null;
      const observedPriceIqd = Math.round(priceVal);

      const brand = product.vendor || "";
      const fullTitle =
        brand && !product.title.toLowerCase().includes(brand.toLowerCase())
          ? `${brand} ${product.title}`
          : product.title;

      const score = scoreTitleMatch(queryTokens, fullTitle);
      const urlPath = product.url.startsWith("/") ? product.url : `/${product.url}`;

      return {
        score,
        observation: {
          sourceName: "Alhafidh",
          sourceUrl: `${ALHAFIDH_ORIGIN}${urlPath}`,
          observedPriceIqd,
          stockState: product.available ? "IN_STOCK" : "OUT_OF_STOCK",
          productTitle: fullTitle.trim(),
          parserVersion: "live-1.0.0",
          nativeCurrency: "IQD",
          nativeAmount: observedPriceIqd,
          exchangeRate: 1.0,
          rateTimestamp: new Date(),
        } satisfies RetailObservation,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter((row) => row.score >= 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return ranked.map((row) => row.observation);
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function scoreTitleMatch(queryTokens: string[], productName: string): number {
  if (queryTokens.length === 0) return 0;
  const nameTokens = normalize(productName).split(/\s+/).filter(Boolean);
  const hits = queryTokens.filter((token) =>
    nameTokens.some((nt) => nt.includes(token) || token.includes(nt)),
  ).length;
  return hits / queryTokens.length;
}
