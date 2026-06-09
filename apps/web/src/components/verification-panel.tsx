import { ExternalLink, ShieldCheck } from "lucide-react";
import { formatIqd, formatSavingsPercent } from "@htp/contracts";
import { VerificationBadge } from "./verification-badge";
import { t, tf } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/types";

interface RetailReference {
  sourceName: string;
  sourceUrl: string;
  observedPriceIqd: number;
  observedAt: Date;
  stockState: string;
}

interface VerificationPanelProps {
  locale: Locale;
  verifiedRetailIqd: number | null;
  computedCapIqd: number | null;
  sellerPriceIqd: number;
  matchConfidence: number | null;
  message: string | null;
  retailReferences: RetailReference[];
}

export function VerificationPanel({
  locale,
  verifiedRetailIqd,
  computedCapIqd,
  sellerPriceIqd,
  matchConfidence,
  message,
  retailReferences,
}: VerificationPanelProps) {
  const savings =
    verifiedRetailIqd != null
      ? formatSavingsPercent(sellerPriceIqd, verifiedRetailIqd)
      : null;

  return (
    <div className="glass space-y-5 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            {t(locale, "verification.title")}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {t(locale, "verification.subtitle")}
          </p>
        </div>
        <VerificationBadge locale={locale} size="md" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {verifiedRetailIqd != null && (
          <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {t(locale, "verification.verifiedRetail")}
            </p>
            <p className="mt-1 text-lg font-bold">{formatIqd(verifiedRetailIqd)}</p>
          </div>
        )}
        {computedCapIqd != null && (
          <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {t(locale, "verification.maxAllowed")}
            </p>
            <p className="mt-1 text-lg font-bold text-brand-600 dark:text-brand-400">
              {formatIqd(computedCapIqd)}
            </p>
          </div>
        )}
        {savings != null && savings > 0 && (
          <div className="rounded-xl bg-brand-50 p-4 dark:bg-brand-950/50">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
              {t(locale, "verification.yourSavings")}
            </p>
            <p className="mt-1 text-lg font-bold text-brand-700 dark:text-brand-300">
              {tf(locale, "verification.savingsVsRetail", { percent: savings })}
            </p>
          </div>
        )}
      </div>

      {matchConfidence != null && (
        <p className="text-xs text-zinc-500">
          {tf(locale, "verification.matchConfidence", {
            percent: (matchConfidence * 100).toFixed(0),
          })}
        </p>
      )}

      {message && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      )}

      {retailReferences.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">{t(locale, "verification.evidenceSources")}</h3>
          <ul className="mt-3 space-y-2">
            {retailReferences.map((ref) => (
              <li
                key={`${ref.sourceName}-${ref.sourceUrl}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200/80 px-4 py-3 text-sm dark:border-zinc-700"
              >
                <div>
                  <p className="font-medium">{ref.sourceName}</p>
                  <p className="text-xs text-zinc-500">
                    {formatIqd(ref.observedPriceIqd)} ·{" "}
                    {ref.stockState.replace("_", " ").toLowerCase()} ·{" "}
                    {ref.observedAt.toLocaleDateString("en-IQ")}
                  </p>
                </div>
                <a
                  href={ref.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-brand-600 hover:text-brand-700 dark:text-brand-400"
                  aria-label={tf(locale, "listing.viewSource", { source: ref.sourceName })}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
