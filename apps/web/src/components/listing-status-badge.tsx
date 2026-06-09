import { getStatusLabel } from "@/lib/i18n/labels";
import type { Locale } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  LIVE: "bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-200",
  DRAFT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  PENDING_VERIFICATION: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  MANUAL_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200",
  STALE: "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200",
  HIDDEN: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

interface ListingStatusBadgeProps {
  status: string;
  className?: string;
  locale: Locale;
}

export function ListingStatusBadge({ status, className, locale }: ListingStatusBadgeProps) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT,
        className,
      )}
    >
      {getStatusLabel(locale, status)}
    </span>
  );
}
