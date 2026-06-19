"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useEffect } from "react";
import { X } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { IRAQI_GOVERNORATES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/provider";
import { getSortOptions } from "@/lib/i18n/labels";

interface BrowseFiltersProps {
  categories: { id: string; name: string }[];
}

export function BrowseFilters({ categories }: BrowseFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();
  const sortOptions = useMemo(() => getSortOptions(locale), [locale]);

  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setMounted(true);
  }, []);

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`/browse?${params.toString()}`);
    },
    [router, searchParams],
  );

  // Debounce query param update to prevent router flooding
  useEffect(() => {
    const handler = setTimeout(() => {
      const currentQ = searchParams.get("q") ?? "";
      if (q !== currentQ) {
        update("q", q);
      }
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [q, searchParams, update]);

  // Sync state if URL changes externally (e.g. clear filters)
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; value: string }[] = [];
    const q = searchParams.get("q");
    const categoryId = searchParams.get("categoryId");
    const governorate = searchParams.get("governorate");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const sort = searchParams.get("sort");

    if (q) chips.push({ key: "q", label: `${t("browse.search")}: ${q}`, value: "" });
    if (categoryId) {
      const cat = categories.find((c) => c.id === categoryId);
      chips.push({
        key: "categoryId",
        label: `${t("browse.category")}: ${cat?.name ?? categoryId}`,
        value: "",
      });
    }
    if (governorate) {
      chips.push({
        key: "governorate",
        label: `${t("browse.governorate")}: ${governorate}`,
        value: "",
      });
    }
    if (minPrice) {
      chips.push({
        key: "minPrice",
        label: `${t("browse.minPrice")}: ${minPrice}`,
        value: "",
      });
    }
    if (maxPrice) {
      chips.push({
        key: "maxPrice",
        label: `${t("browse.maxPrice")}: ${maxPrice}`,
        value: "",
      });
    }
    if (sort && sort !== "newest") {
      const sortLabel = sortOptions.find((o) => o.value === sort)?.label ?? sort;
      chips.push({ key: "sort", label: `${t("browse.sortBy")}: ${sortLabel}`, value: "" });
    }

    return chips;
  }, [searchParams, categories, t, sortOptions]);

  return (
    <div className="space-y-3">
      <form
        className="glass grid gap-4 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(e) => e.preventDefault()}
        role="search"
        aria-label={t("browse.title")}
        data-hydrated={mounted}
      >
        <Input
          label={t("browse.search")}
          name="q"
          placeholder={t("browse.searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="lg:col-span-2"
        />
        <Select
          label={t("browse.category")}
          name="categoryId"
          options={[
            { value: "", label: t("browse.allCategories") },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          defaultValue={searchParams.get("categoryId") ?? ""}
          onChange={(e) => update("categoryId", e.target.value)}
        />
        <Select
          label={t("browse.governorate")}
          name="governorate"
          options={[
            { value: "", label: t("browse.allGovernorates") },
            ...IRAQI_GOVERNORATES.map((g) => ({ value: g, label: g })),
          ]}
          defaultValue={searchParams.get("governorate") ?? ""}
          onChange={(e) => update("governorate", e.target.value)}
        />
        <Select
          label={t("browse.sortBy")}
          name="sort"
          options={sortOptions.map((o) => ({ value: o.value, label: o.label }))}
          defaultValue={searchParams.get("sort") ?? "newest"}
          onChange={(e) => update("sort", e.target.value)}
        />
        <Input
          label={t("browse.minPrice")}
          name="minPrice"
          type="number"
          min={0}
          placeholder="0"
          defaultValue={searchParams.get("minPrice") ?? ""}
          onChange={(e) => update("minPrice", e.target.value)}
        />
        <Input
          label={t("browse.maxPrice")}
          name="maxPrice"
          type="number"
          min={0}
          placeholder={t("browse.anyPrice")}
          defaultValue={searchParams.get("maxPrice") ?? ""}
          onChange={(e) => update("maxPrice", e.target.value)}
        />
      </form>

      {activeFilters.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label={t("browse.activeFilters")}
        >
          {activeFilters.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => update(chip.key, "")}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200 dark:hover:bg-brand-900"
              aria-label={t("browse.removeFilter").replace("{filter}", chip.label)}
            >
              {chip.label}
              <X className="h-3 w-3" />
            </button>
          ))}
          <a
            href="/browse"
            className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:hover:text-zinc-200"
          >
            {t("browse.clearFilters")}
          </a>
        </div>
      )}
    </div>
  );
}
