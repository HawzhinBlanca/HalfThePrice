"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { IRAQI_GOVERNORATES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/provider";

interface CreateListingFormProps {
  categories: { id: string; name: string }[];
}

export function CreateListingForm({ categories }: CreateListingFormProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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

    try {
      const res = await fetch("/api/seller/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    } catch {
      setError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass space-y-4 rounded-2xl p-6">
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
