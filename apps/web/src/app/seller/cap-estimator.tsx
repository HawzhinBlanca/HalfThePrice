"use client";

import { useState } from "react";
import { formatIqd } from "@htp/contracts";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/provider";
import { mutatingFetch } from "@/lib/use-csrf";

interface CapEstimatorProps {
  categories: { id: string; name: string }[];
}

interface CapEstimateResponse {
  matchConfidence: number;
  matchedProduct: { brand: string; model: string } | null;
  verifiedRetailIqd: number | null;
  computedCapIqd: number | null;
  retailSources: string[];
  message: string;
  error?: string;
}

export function CapEstimator({ categories }: CapEstimatorProps) {
  const { t, tf } = useI18n();
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [result, setResult] = useState<CapEstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEstimate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await mutatingFetch("/api/cap-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, categoryId }),
      });

      const data: CapEstimateResponse = await res.json();
      setResult(data);
    } catch {
      setResult({
        matchConfidence: 0,
        matchedProduct: null,
        verifiedRetailIqd: null,
        computedCapIqd: null,
        retailSources: [],
        message: "",
        error: t("seller.cap.failed"),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-xl font-semibold">{t("seller.cap.title")}</h2>
      <p className="mt-1 text-sm text-zinc-500">{t("seller.cap.subtitle")}</p>

      <form onSubmit={handleEstimate} className="mt-4 space-y-4">
        <Input
          label={t("seller.cap.productTitle")}
          name="title"
          placeholder={t("seller.cap.productPlaceholder")}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Select
          label={t("seller.cap.category")}
          name="categoryId"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        />
        <Button type="submit" disabled={loading || !categoryId}>
          {loading ? t("seller.cap.estimating") : t("seller.cap.estimate")}
        </Button>
      </form>

      {result && (
        <div className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-800/50">
          {result.error ? (
            <p className="text-red-600">{result.error}</p>
          ) : (
            <>
              <p>{result.message}</p>
              {result.matchedProduct && (
                <p className="mt-2 text-zinc-500">
                  {tf("seller.cap.matched", {
                    brand: result.matchedProduct.brand,
                    model: result.matchedProduct.model,
                    confidence: (result.matchConfidence * 100).toFixed(0),
                  })}
                </p>
              )}
              {result.verifiedRetailIqd != null && (
                <p className="mt-1 font-medium text-brand-600 dark:text-brand-400">
                  {tf("seller.cap.maxPrice", {
                    cap: formatIqd(result.computedCapIqd ?? 0),
                    retail: formatIqd(result.verifiedRetailIqd),
                  })}
                </p>
              )}
              {result.retailSources.length > 0 && (
                <p className="mt-1 text-xs text-zinc-500">
                  {tf("seller.cap.sources", { sources: result.retailSources.join(", ") })}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
