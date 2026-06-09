import Image from "next/image";
import Link from "next/link";
import { MapPin, ShieldCheck } from "lucide-react";
import { formatIqd, formatSavingsPercent } from "@htp/contracts";
import { VerificationBadge } from "@/components/verification-badge";
import { HighlightedText } from "@/components/highlighted-text";
import { getConditionLabel } from "@/lib/i18n/labels";
import { t, tf } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

interface ListingCardProps {
  id: string;
  title: string;
  sellerPriceIqd: number;
  verifiedRetailIqd?: number | null;
  governorate: string;
  condition: string;
  imageUrl?: string | null;
  categoryName?: string;
  className?: string;
  locale: Locale;
  searchQuery?: string;
}

export function ListingCard({
  id,
  title,
  sellerPriceIqd,
  verifiedRetailIqd,
  governorate,
  condition,
  imageUrl,
  categoryName,
  className,
  locale,
  searchQuery,
}: ListingCardProps) {
  const savings =
    verifiedRetailIqd != null
      ? formatSavingsPercent(sellerPriceIqd, verifiedRetailIqd)
      : null;

  return (
    <Link
      href={`/listings/${id}`}
      className={cn(
        "group magnetic-hover flex flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400">
            <ShieldCheck className="h-12 w-12 opacity-30" />
          </div>
        )}
        <div className="absolute start-3 top-3 flex flex-col gap-1.5">
          <VerificationBadge locale={locale} />
          {savings != null && savings > 0 && (
            <span className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
              {tf(locale, "listing.savingsOff", { percent: savings })}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {categoryName && (
          <span className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
            {categoryName}
          </span>
        )}
        <h3 className="line-clamp-2 font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
          <HighlightedText text={title} query={searchQuery} />
        </h3>
        <div className="mt-auto space-y-1">
          <p className="text-xl font-bold text-zinc-900 dark:text-white">
            {formatIqd(sellerPriceIqd)}
          </p>
          {verifiedRetailIqd != null && (
            <p className="text-sm text-zinc-500 line-through dark:text-zinc-400">
              {t(locale, "listing.retail")}: {formatIqd(verifiedRetailIqd)}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {governorate}
            </span>
            <span>{getConditionLabel(locale, condition)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
