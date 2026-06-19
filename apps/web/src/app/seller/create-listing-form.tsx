"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { IRAQI_GOVERNORATES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/provider";
import { mutatingFetch } from "@/lib/use-csrf";

interface CreateListingFormProps {
  categories: { id: string; name: string }[];
}

export function CreateListingForm({ categories }: CreateListingFormProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Draft persistence: auto-save every 2s, restore on mount
  const DRAFT_KEY = "htp_draft_listing";

  const saveDraft = useCallback(() => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const draft: Record<string, string> = {};
    fd.forEach((v, k) => { if (typeof v === "string") draft[k] = v; });
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* quota */ }
  }, []);

  useEffect(() => {
    // Restore draft
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved && formRef.current) {
        const draft = JSON.parse(saved) as Record<string, string>;
        Object.entries(draft).forEach(([k, v]) => {
          const el = formRef.current?.elements.namedItem(k);
          if (el && "value" in el) (el as unknown as HTMLInputElement).value = v;
        });
      }
    } catch { /* parse error */ }

    // Auto-save timer
    const timer = setInterval(saveDraft, 2000);
    return () => clearInterval(timer);
  }, [saveDraft]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const price = Number(form.get("sellerPriceIqd"));

    if (!Number.isFinite(price) || price <= 0) {
      setError(t("seller.create.invalidPrice"));
      setLoading(false);
      return;
    }

    // Sanity bounds: no real item is < 1,000 IQD or > 500M IQD
    const MIN_PRICE_IQD = 1_000;
    const MAX_PRICE_IQD = 500_000_000;
    if (price < MIN_PRICE_IQD || price > MAX_PRICE_IQD) {
      setError(`Price must be between ${MIN_PRICE_IQD.toLocaleString()} and ${MAX_PRICE_IQD.toLocaleString()} IQD.`);
      setLoading(false);
      return;
    }

    try {
      const res = await mutatingFetch("/api/seller/listings", {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description") || undefined,
          categoryId: form.get("categoryId"),
          condition: form.get("condition"),
          sellerPriceIqd: price,
          governorate: form.get("governorate"),
          imageUrl: form.get("imageUrl") || undefined,
        }),
      });

      const data: { error?: string } = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("seller.create.failed"));
        return;
      }

      setSuccess(true);
      router.refresh();
      e.currentTarget.reset();
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
    } catch {
      setError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="glass space-y-4 rounded-2xl p-6">
      <div>
        <h2 className="text-lg font-semibold">{t("seller.create.title")}</h2>
        <p className="mt-1 text-sm text-zinc-500">{t("seller.create.subtitle")}</p>
      </div>

      <div className="flex gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200">
        <Info className="h-5 w-5 shrink-0" />
        <p>{t("seller.create.hint")}</p>
      </div>

      <Input
        label={t("seller.create.titleLabel")}
        name="title"
        required
        minLength={5}
        placeholder={t("seller.create.titlePlaceholder")}
      />
      <Textarea label={t("seller.create.description")} name="description" rows={3} />
      <Select
        label={t("seller.create.category")}
        name="categoryId"
        required
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
      />
      <Select
        label={t("seller.create.condition")}
        name="condition"
        required
        options={[
          { value: "NEW", label: t("condition.NEW") },
          { value: "LIKE_NEW", label: t("condition.LIKE_NEW") },
          { value: "GOOD", label: t("condition.GOOD") },
          { value: "FAIR", label: t("condition.FAIR") },
        ]}
      />
      <Input
        label={t("seller.create.price")}
        name="sellerPriceIqd"
        type="number"
        required
        min={1}
        placeholder={t("seller.create.pricePlaceholder")}
      />
      <Select
        label={t("seller.create.governorate")}
        name="governorate"
        required
        options={IRAQI_GOVERNORATES.map((g) => ({ value: g, label: g }))}
      />
      <Input
        label={t("seller.create.imageUrl")}
        name="imageUrl"
        type="url"
        placeholder={t("seller.create.imagePlaceholder")}
      />
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-800 dark:bg-brand-950 dark:text-brand-200">
          {t("seller.create.saved")}
        </p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? t("seller.create.creating") : t("seller.create.saveDraft")}
      </Button>
    </form>
  );
}
