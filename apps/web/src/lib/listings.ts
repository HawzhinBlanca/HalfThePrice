import { prisma } from "@htp/database";
import { searchListings as meiliSearch } from "@htp/search";
import { expandFuzzyTokenGroups } from "@/lib/search";
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
