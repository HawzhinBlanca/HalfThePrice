"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/provider";

interface OnboardingFormProps {
  initial: {
    legalName: string;
    displayName: string;
    governorate: string;
    licenseNumber: string;
    contactPhone: string;
    payoutPreference: string;
    kycStatus: string;
    documentCount: number;
  };
}

export function OnboardingForm({ initial }: OnboardingFormProps) {
  const router = useRouter();
  const { t, tf } = useI18n();
  const [legalName, setLegalName] = useState(initial.legalName);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [governorate, setGovernorate] = useState(initial.governorate);
  const [licenseNumber, setLicenseNumber] = useState(initial.licenseNumber);
  const [contactPhone, setContactPhone] = useState(initial.contactPhone);
  const [payoutPreference, setPayoutPreference] = useState(initial.payoutPreference);
  const [documentType, setDocumentType] = useState<"TRADE_LICENSE" | "NATIONAL_ID" | "OTHER">(
    "TRADE_LICENSE",
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/seller/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName,
          displayName,
          governorate,
          licenseNumber: licenseNumber || undefined,
          contactPhone: contactPhone || undefined,
          payoutPreference: payoutPreference || undefined,
        }),
      });

      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("seller.onboarding.saveFailed"));
        return;
      }

      setSuccess(t("seller.onboarding.saved"));
      router.refresh();
    } catch {
      setError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess("");
    setUploading(true);

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i] ?? 0);
      }
      const contentBase64 = btoa(binary);

      const res = await fetch("/api/seller/onboarding/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          fileName: file.name,
          mimeType: file.type,
          contentBase64,
        }),
      });

      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("seller.onboarding.uploadFailed"));
        return;
      }

      setSuccess(tf("seller.onboarding.uploaded", { name: file.name }));
      router.refresh();
    } catch {
      setError(t("seller.onboarding.uploadFailed"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-xl font-semibold">{t("seller.onboarding.title")}</h2>
      <p className="mt-1 text-sm text-zinc-500">{t("seller.onboarding.subtitle")}</p>

      <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("seller.onboarding.legalName")}
            name="legalName"
            required
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
          />
          <Input
            label={t("seller.onboarding.displayName")}
            name="displayName"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Input
            label={t("seller.onboarding.governorate")}
            name="governorate"
            required
            value={governorate}
            onChange={(e) => setGovernorate(e.target.value)}
          />
          <Input
            label={t("seller.onboarding.license")}
            name="licenseNumber"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
          />
          <Input
            label={t("seller.onboarding.phone")}
            name="contactPhone"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
          />
          <Select
            label={t("seller.onboarding.payout")}
            name="payoutPreference"
            options={[
              { value: "", label: t("seller.onboarding.payoutSelect") },
              { value: "COD", label: t("seller.onboarding.payoutCod") },
              { value: "ZAINCASH", label: t("seller.onboarding.payoutZain") },
              { value: "QICARD", label: t("seller.onboarding.payoutQi") },
              { value: "FASTPAY", label: t("seller.onboarding.payoutFast") },
            ]}
            value={payoutPreference}
            onChange={(e) => setPayoutPreference(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <Button type="submit" disabled={loading}>
          {loading ? t("seller.onboarding.saving") : t("seller.onboarding.save")}
        </Button>
      </form>

      <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
        <h3 className="font-medium">{t("seller.onboarding.uploadTitle")}</h3>
        <p className="mt-1 text-sm text-zinc-500">
          {tf("seller.onboarding.uploadStatus", {
            count: initial.documentCount,
            status: initial.kycStatus,
          })}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Select
            label={t("seller.onboarding.docType")}
            name="documentType"
            options={[
              { value: "TRADE_LICENSE", label: t("seller.onboarding.docTrade") },
              { value: "NATIONAL_ID", label: t("seller.onboarding.docId") },
              { value: "OTHER", label: t("seller.onboarding.docOther") },
            ]}
            value={documentType}
            onChange={(e) =>
              setDocumentType(e.target.value as "TRADE_LICENSE" | "NATIONAL_ID" | "OTHER")
            }
          />
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("seller.onboarding.fileLabel")}
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleUpload}
              disabled={uploading}
              className="text-sm"
            />
          </div>
        </div>
        {uploading && <p className="mt-2 text-sm text-zinc-500">{t("seller.onboarding.uploading")}</p>}
      </div>
    </div>
  );
}
