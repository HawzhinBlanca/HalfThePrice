import Link from "next/link";
import { SuspenseBoundary } from "@/components/suspense-boundary";
import { SearchX } from "lucide-react";
import { prisma } from "@htp/database";
import { getLiveListings } from "@/lib/listings";
import { ListingCard } from "@/components/listing-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { ListingSort } from "@/lib/constants";
import { getServerI18n } from "@/lib/i18n/server";
import { BrowseFilters } from "./browse-filters";

interface BrowsePageProps {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    governorate?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    page?: string;
  }>;
}

function buildBrowseUrl(
  params: Record<string, string | undefined>,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const qs = search.toString();
  return qs ? `/browse?${qs}` : "/browse";
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");
  const sort = (params.sort ?? "newest") as ListingSort;
  const { locale, t, tf } = await getServerI18n();

  const [result, categories] = await Promise.all([
    getLiveListings({
      query: params.q,
      categoryId: params.categoryId,
      governorate: params.governorate,
      minPrice: params.minPrice ? Number(params.minPrice) : undefined,
      maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
      sort,
      page,
      limit: 12,
    }),
    prisma.category.findMany({
      where: { whitelistStatus: "ACTIVE" },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  const hasFilters = Boolean(
    params.q || params.categoryId || params.governorate || params.minPrice || params.maxPrice,
  );

  const plural =
    result.total !== 1
      ? locale === "ar"
        ? "ات"
        : locale === "en"
          ? "s"
          : ""
      : "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("browse.title")}</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {tf("browse.subtitle", { count: result.total, plural })}
        </p>
      </div>

      <SuspenseBoundary fallback={<div className="glass h-24 animate-pulse rounded-2xl" />}>
        <BrowseFilters
          categories={categories.map((c) => ({ id: c.id, name: c.nameEn }))}
        />
      </SuspenseBoundary>

      {result.data.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={SearchX}
            title={t("browse.noResults.title")}
            description={
              hasFilters ? t("browse.noResults.filtered") : t("browse.noResults.empty")
            }
            action={
              hasFilters ? (
                <Link href="/browse">
                  <Button variant="secondary">{t("browse.clearFilters")}</Button>
                </Link>
              ) : (
                <Link href="/register?role=seller">
                  <Button>{t("hero.startSelling")}</Button>
                </Link>
              )
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.map((listing) => (
            <ListingCard
              key={listing.id}
              locale={locale}
              searchQuery={params.q}
              id={listing.id}
              title={listing.title}
              sellerPriceIqd={listing.sellerPriceIqd}
              verifiedRetailIqd={
                listing.verificationRuns[0]?.verifiedRetailIqd ?? null
              }
              governorate={listing.governorate}
              condition={listing.condition}
              imageUrl={listing.imageUrl}
              categoryName={listing.category.nameEn}
            />
          ))}
        </div>
      )}

      {result.totalPages > 1 && (
        <nav
          className="mt-10 flex justify-center gap-2"
          aria-label={t("browse.pagination")}
        >
          {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildBrowseUrl(params, p)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                p === page
                  ? "bg-brand-600 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
