"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatIqd } from "@htp/contracts";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/provider";
import { mutatingFetch } from "@/lib/use-csrf";

interface OfferFormProps {
  listingId: string;
  maxCap: number;
}

export function OfferForm({ listingId, maxCap }: OfferFormProps) {
  const router = useRouter();
  const { t, tf } = useI18n();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await mutatingFetch(`/api/listings/${listingId}/offers`, {
        method: "POST",
        body: JSON.stringify({
          amountIqd: Number(amount),
          message: message || undefined,
        }),
      });

      const data: { error?: string } = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("offer.failed"));
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200">
        {t("offer.success")}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass space-y-4 rounded-2xl p-6">
      <h2 className="font-semibold">{t("offer.title")}</h2>
      <p className="text-sm text-zinc-500">
        {tf("offer.maxAllowed", { amount: formatIqd(maxCap) })}
      </p>
      <Input
        label={t("offer.amount")}
        name="amount"
        type="number"
        min={1}
        max={maxCap}
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={error}
      />
      <Textarea
        label={t("offer.message")}
        name="message"
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button type="submit" disabled={loading}>
        {loading ? t("offer.submitting") : t("offer.submit")}
      </Button>
    </form>
  );
}
