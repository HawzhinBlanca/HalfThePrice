"use client";

import { useState } from "react";
import { formatIqd } from "@htp/contracts";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { mutatingFetch } from "@/lib/use-csrf";

interface CheckoutFormProps {
  offerId: string;
  amountIqd: number;
}

const METHODS = ["COD", "ZAINCASH", "QICARD", "FASTPAY"] as const;

const METHOD_LABELS: Record<(typeof METHODS)[number], "checkout.method.cod" | "checkout.method.zaincash" | "checkout.method.qicard" | "checkout.method.fastpay"> = {
  COD: "checkout.method.cod",
  ZAINCASH: "checkout.method.zaincash",
  QICARD: "checkout.method.qicard",
  FASTPAY: "checkout.method.fastpay",
};

export function CheckoutForm({ offerId, amountIqd }: CheckoutFormProps) {
  const { t, tf } = useI18n();
  const [method, setMethod] = useState<(typeof METHODS)[number]>("COD");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleCheckout() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await mutatingFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({ offerId, paymentMethod: method }),
      });
      const data = (await res.json()) as {
        order?: { status: string };
        payment?: { message: string; sandbox: boolean };
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? t("checkout.failed"));
        return;
      }

      const sandboxNote = data.payment?.sandbox ? ` (${t("checkout.sandbox")})` : "";
      setResult(
        `${t("checkout.confirmed")}: ${data.order?.status ?? "CONFIRMED"}${sandboxNote}`,
      );
    } catch {
      setError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200">
        {result}
      </div>
    );
  }

  return (
    <div className="glass space-y-4 rounded-2xl p-6">
      <h2 className="font-semibold">{t("checkout.title")}</h2>
      <p className="text-sm text-zinc-500">
        {tf("checkout.amount", { amount: formatIqd(amountIqd) })}
      </p>
      <div className="flex flex-wrap gap-2">
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              method === m
                ? "bg-brand-600 text-white"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {t(METHOD_LABELS[m])}
          </button>
        ))}
      </div>
      <Button onClick={handleCheckout} disabled={loading}>
        {loading ? t("checkout.processing") : t("checkout.pay")}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
