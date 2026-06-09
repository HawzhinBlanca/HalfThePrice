import type { ListingSort } from "@/lib/constants";
import { t, type MessageKey } from "./messages";
import type { Locale } from "./types";

const SORT_KEYS: Record<ListingSort, MessageKey> = {
  newest: "sort.newest",
  price_asc: "sort.priceAsc",
  price_desc: "sort.priceDesc",
  savings: "sort.savings",
};

export function getSortOptions(locale: Locale): { value: ListingSort; label: string }[] {
  return (Object.keys(SORT_KEYS) as ListingSort[]).map((value) => ({
    value,
    label: t(locale, SORT_KEYS[value]),
  }));
}

const CONDITION_KEYS: Record<string, MessageKey> = {
  NEW: "condition.NEW",
  LIKE_NEW: "condition.LIKE_NEW",
  GOOD: "condition.GOOD",
  FAIR: "condition.FAIR",
};

export function getConditionLabel(locale: Locale, condition: string): string {
  const key = CONDITION_KEYS[condition];
  return key ? t(locale, key) : condition.replace("_", " ");
}

const STATUS_KEYS: Record<string, MessageKey> = {
  LIVE: "status.LIVE",
  DRAFT: "status.DRAFT",
  PENDING_VERIFICATION: "status.PENDING_VERIFICATION",
  MANUAL_REVIEW: "status.MANUAL_REVIEW",
  REJECTED: "status.REJECTED",
  STALE: "status.STALE",
  HIDDEN: "status.HIDDEN",
};

export function getStatusLabel(locale: Locale, status: string): string {
  const key = STATUS_KEYS[status];
  return key ? t(locale, key) : status;
}
