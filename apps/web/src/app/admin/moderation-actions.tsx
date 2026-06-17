"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/provider";
import { mutatingFetch } from "@/lib/use-csrf";

export function ModerationActions({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "APPROVE" | "REJECT") {
    if (reason.trim().length < 5) {
      setError(t("admin.reasonRequired"));
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await mutatingFetch(`/api/admin/listings/${listingId}/override`, {
        method: "POST",
        body: JSON.stringify({ action, reason: reason.trim() }),
      });

      const data: { error?: string } = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("admin.actionFailed"));
        return;
      }

      setReason("");
      router.refresh();
    } catch {
      setError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-w-[260px] flex-col gap-2">
      <Input
        label={t("admin.reviewReason")}
        name="reason"
        placeholder={t("admin.reviewPlaceholder")}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={error}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => handleAction("APPROVE")}
          disabled={loading}
        >
          {loading ? "..." : t("admin.approvePublish")}
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => handleAction("REJECT")}
          disabled={loading}
        >
          {t("admin.reject")}
        </Button>
      </div>
    </div>
  );
}
