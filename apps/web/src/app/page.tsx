import Link from "next/link";
import { ArrowRight, ShieldCheck, Tag, Zap, Store } from "lucide-react";
import { prisma } from "@htp/database";
import { getLiveListings } from "@/lib/listings";
import { ListingCard } from "@/components/listing-card";
import { RETAIL_SOURCES } from "@/lib/constants";
import { getServerI18n } from "@/lib/i18n/server";

export default async function HomePage() {
  const { locale, t, tf } = await getServerI18n();

  const [{ data: featured }, liveCount, categoryCount] = await Promise.all([
    getLiveListings({ limit: 3 }),
    prisma.listing.count({ where: { status: "LIVE" } }),
    prisma.category.count({ where: { whitelistStatus: "ACTIVE" } }),
  ]);

  const features = [
    {
      icon: ShieldCheck,
      title: t("home.feature.verified.title"),
      desc: t("home.feature.verified.desc"),
    },
    {
      icon: Tag,
      title: t("home.feature.cap.title"),
      desc: t("home.feature.cap.desc"),
    },
    {
      icon: Zap,
      title: t("home.feature.noSurprises.title"),
      desc: t("home.feature.noSurprises.desc"),
    },
  ];

  return (
    <div>
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-transparent to-emerald-50 dark:from-brand-950/30 dark:to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-300">
              <ShieldCheck className="h-4 w-4" />
              {t("hero.badge")}
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              {t("hero.title")}{" "}
              <span className="gradient-text">{t("hero.titleHighlight")}</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
              {t("hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/browse"
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                {liveCount > 0
                  ? tf("hero.browseDeals", { count: liveCount })
                  : t("hero.browseDealsFallback")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register?role=seller"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                {t("hero.startSelling")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-zinc-50/50 py-8 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-8 px-4 sm:px-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-brand-600 dark:text-brand-400">{liveCount}</p>
            <p className="text-sm text-zinc-500">{t("home.stats.liveListings")}</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{categoryCount}</p>
            <p className="text-sm text-zinc-500">{t("home.stats.categories")}</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{RETAIL_SOURCES.length}</p>
            <p className="text-sm text-zinc-500">{t("home.stats.sources")}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass magnetic-hover rounded-2xl p-6">
              <Icon className="mb-4 h-8 w-8 text-brand-600 dark:text-brand-400" />
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-50/50 py-12 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
            <Store className="h-4 w-4" />
            {t("home.benchmarks.title")}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {RETAIL_SOURCES.map((source) => (
              <span
                key={source}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900"
              >
                {source}
              </span>
            ))}
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="border-t border-zinc-200 py-16 dark:border-zinc-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold">{t("home.featured.title")}</h2>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {t("home.featured.subtitle")}
                </p>
              </div>
              <Link
                href="/browse"
                className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                {t("home.featured.viewAll")}
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((listing) => (
                <ListingCard
                  key={listing.id}
                  locale={locale}
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
          </div>
        </section>
      )}
    </div>
  );
}
