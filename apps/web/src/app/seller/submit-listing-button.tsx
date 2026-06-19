"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ListingStatusBadge } from "@/components/listing-status-badge";
import { useI18n } from "@/lib/i18n/provider";
import { mutatingFetch } from "@/lib/use-csrf";

interface SubmitResult {
  message?: string;
  status?: string;
  success?: boolean;
}

export function SubmitListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  async function handleSubmit() {
    setLoading(true);
    // Optimistic: show pending status immediately for snappy UX
    setResult({ message: t("seller.submitting"), status: "PENDING_VERIFICATION", success: true });

    try {
      const res = await mutatingFetch(`/api/seller/listings/${listingId}/submit`, {
        method: "POST",
      });
      const data: SubmitResult = await res.json();

      if (!res.ok) {
        // Revert optimistic state on failure
        setResult({ message: data.message ?? t("seller.submitFailed"), success: false });
        return;
      }

      setResult({ message: data.message, status: data.status, success: true });
      router.refresh();
    } catch {
      // Revert optimistic state on network failure
      setResult({ message: t("common.networkError"), success: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handleSubmit} disabled={loading} size="sm">
        {loading ? t("seller.submitting") : t("seller.submit")}
      </Button>
      {result?.message && (
        <div
          className={`max-w-xs rounded-lg px-3 py-2 text-end text-xs ${
            result.success
              ? "bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          <p>{result.message}</p>
          {result.status && (
            <div className="mt-1 flex justify-end">
              <ListingStatusBadge status={result.status} locale={locale} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
