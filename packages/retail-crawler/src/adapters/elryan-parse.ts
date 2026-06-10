import type { RetailObservation } from "../types";

export const ELRYAN_ORIGIN = "https://www.elryan.com";
export const ELRYAN_CATALOG_INDEX = "vue_storefront_magento_ar";
export const ELRYAN_SEARCH_PATH = `/api/catalog/${ELRYAN_CATALOG_INDEX}/product/_search`;
export const ELRYAN_USD_TO_IQD_RATE = 1540;

export interface ElryanCatalogHit {
  _source?: ElryanCatalogProduct;
}

export interface ElryanCatalogProduct {
  name?: string;
  url_path?: string;
  iqd_price?: number;
  final_price?: number;
  price?: number;
  stock?: { is_in_stock?: boolean };
}

export interface ElryanSearchResponse {
  hits?: { hits?: ElryanCatalogHit[] };
}

export function resolveElryanPriceIqd(product: ElryanCatalogProduct): number {
  if (typeof product.iqd_price === "number" && product.iqd_price > 0) {
    return Math.round(product.iqd_price);
  }
  const usd =
    product.final_price ?? product.price ?? 0;
  if (usd > 0) {
    return Math.round(usd * ELRYAN_USD_TO_IQD_RATE);
  }
  return 0;
}

export function parseElryanSearchResponse(
  payload: ElryanSearchResponse,
  queryTitle: string,
): RetailObservation[] {
  const hits = payload.hits?.hits ?? [];
  const queryTokens = normalize(queryTitle).split(/\s+/).filter(Boolean);

  const ranked = hits
    .map((hit) => {
      const product = hit._source;
      if (!product?.name) return null;
      const priceIqd = resolveElryanPriceIqd(product);
      if (priceIqd <= 0) return null;
      const urlPath = product.url_path;
      if (!urlPath) return null;
      const score = scoreTitleMatch(queryTokens, product.name);
      return {
        score,
        observation: {
          sourceName: "Elryan",
          sourceUrl: `${ELRYAN_ORIGIN}/${urlPath}`,
          observedPriceIqd: priceIqd,
          stockState: product.stock?.is_in_stock ? "IN_STOCK" : "OUT_OF_STOCK",
          productTitle: product.name.trim(),
          parserVersion: "live-1.0.0",
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
