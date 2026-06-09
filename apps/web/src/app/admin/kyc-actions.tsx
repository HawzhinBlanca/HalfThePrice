"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/provider";

export function KycActions({ profileId }: { profileId: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "APPROVE" | "REJECT") {
    if (reason.trim().length < 5) {
      setError(t("admin.kycReasonRequired"));
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/seller/${profileId}/kyc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
      <Input
        label={t("admin.kycReason")}
        name="kycReason"
        placeholder={t("admin.kycPlaceholder")}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={error}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => handleAction("APPROVE")} disabled={loading}>
          {t("admin.approveKyc")}
        </Button>
        <Button size="sm" variant="danger" onClick={() => handleAction("REJECT")} disabled={loading}>
          {t("admin.reject")}
        </Button>
      </div>
    </div>
  );
}
