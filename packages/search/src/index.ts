import { MeiliSearch, type SearchParams } from "meilisearch";

export const LISTINGS_INDEX = "listings";

export interface ListingSearchDocument {
  id: string;
  title: string;
  description: string | null;
  sellerPriceIqd: number;
  governorate: string;
  categoryId: string;
  categoryName: string;
  brand: string | null;
  model: string | null;
  status: string;
  publishedAt: number | null;
}

export interface ListingSearchFilters {
  query?: string;
  categoryId?: string;
  governorate?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  sort?: "newest" | "price_asc" | "price_desc";
}

export function getMeiliConfig() {
  return {
    host: process.env.MEILISEARCH_HOST ?? "http://localhost:7700",
    apiKey: process.env.MEILISEARCH_API_KEY ?? "",
  };
}

export function isMeilisearchConfigured(): boolean {
  return Boolean(process.env.MEILISEARCH_HOST);
}

export function createMeiliClient(): MeiliSearch | null {
  if (!isMeilisearchConfigured()) return null;
  const { host, apiKey } = getMeiliConfig();
  return new MeiliSearch({ host, apiKey: apiKey || undefined });
}

export async function checkMeilisearchHealth(): Promise<{
  ok: boolean;
  message: string;
}> {
  const client = createMeiliClient();
  if (!client) {
    return { ok: false, message: "Meilisearch not configured" };
  }

  try {
    const health = await client.health();
    return {
      ok: health.status === "available",
      message: health.status,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Meilisearch unreachable";
    return { ok: false, message };
  }
}

export async function ensureListingsIndex(
  client: MeiliSearch,
): Promise<void> {
  try {
    await client.getIndex(LISTINGS_INDEX);
  } catch {
    await client.createIndex(LISTINGS_INDEX, { primaryKey: "id" });
  }

  const index = client.index(LISTINGS_INDEX);
  await index.updateFilterableAttributes([
    "categoryId",
    "governorate",
    "sellerPriceIqd",
    "status",
  ]);
  await index.updateSortableAttributes([
    "sellerPriceIqd",
    "publishedAt",
  ]);
  await index.updateSearchableAttributes([
    "title",
    "description",
    "brand",
    "model",
    "categoryName",
    "governorate",
  ]);
}

export async function indexListingDocument(
  doc: ListingSearchDocument,
): Promise<void> {
  const client = createMeiliClient();
  if (!client) return;

  await ensureListingsIndex(client);
  await client.index(LISTINGS_INDEX).addDocuments([doc]);
}

export async function removeListingFromIndex(listingId: string): Promise<void> {
  const client = createMeiliClient();
  if (!client) return;

  try {
    await client.index(LISTINGS_INDEX).deleteDocument(listingId);
  } catch {
    // Index may not exist yet in dev
  }
}

export async function searchListings(
  filters: ListingSearchFilters,
): Promise<{
  hits: ListingSearchDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source: "meilisearch";
} | null> {
  const client = createMeiliClient();
  if (!client) return null;

  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 12, 50);
  const offset = (page - 1) * limit;

  await ensureListingsIndex(client);
  const index = client.index(LISTINGS_INDEX);

  const filterParts = ['status = "LIVE"'];
  if (filters.categoryId) {
    filterParts.push(`categoryId = "${filters.categoryId}"`);
  }
  if (filters.governorate) {
    filterParts.push(`governorate = "${filters.governorate}"`);
  }
  if (filters.minPrice != null) {
    filterParts.push(`sellerPriceIqd >= ${filters.minPrice}`);
  }
  if (filters.maxPrice != null) {
    filterParts.push(`sellerPriceIqd <= ${filters.maxPrice}`);
  }

  const sort =
    filters.sort === "price_asc"
      ? ["sellerPriceIqd:asc"]
      : filters.sort === "price_desc"
        ? ["sellerPriceIqd:desc"]
        : ["publishedAt:desc"];

  const params: SearchParams = {
    filter: filterParts.join(" AND "),
    limit,
    offset,
    sort,
  };

  const result = await index.search(filters.query ?? "", params);

  const total = result.estimatedTotalHits ?? result.hits.length;
  return {
    hits: result.hits as ListingSearchDocument[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    source: "meilisearch",
  };
}
