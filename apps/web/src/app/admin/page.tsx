import { redirect } from "next/navigation";
import { ClipboardCheck, Clock, ScrollText } from "lucide-react";
import { prisma, computeSlaStatus, MODERATION_SLA_HOURS } from "@htp/database";
import { formatIqd } from "@htp/contracts";
import { getSession } from "@/lib/auth";
import { EmptyState } from "@/components/empty-state";
import { ListingStatusBadge } from "@/components/listing-status-badge";
import { getServerI18n } from "@/lib/i18n/server";
import { ModerationActions } from "./moderation-actions";
import { AuditTrail } from "./audit-trail";
import { KycActions } from "./kyc-actions";

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/login?redirect=/admin");
  }

  const { locale, t, tf } = await getServerI18n();

  const [queue, stats, auditCount, pendingKyc] = await Promise.all([
    prisma.listing.findMany({
      where: { status: "MANUAL_REVIEW" },
      include: {
        category: true,
        canonicalProduct: true,
        seller: { select: { name: true, email: true } },
        verificationRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "asc" },
    }),
    Promise.all([
      prisma.listing.count({ where: { status: "LIVE" } }),
      prisma.listing.count({ where: { status: "MANUAL_REVIEW" } }),
      prisma.listing.count({ where: { status: "REJECTED" } }),
      prisma.listing.count({ where: { status: "STALE" } }),
    ]),
    prisma.auditEvent.count(),
    prisma.sellerProfile.findMany({
      where: { kycStatus: "PENDING" },
      include: {
        user: { select: { name: true, email: true } },
        kycDocuments: true,
      },
      take: 10,
    }),
  ]);

  const [liveCount, reviewCount, rejectedCount, staleCount] = stats;
  const slaBreached = queue.filter((listing) => {
    const run = listing.verificationRuns[0];
    if (!run) return false;
    return computeSlaStatus(run.createdAt).breached;
  }).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("admin.title")}</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t("admin.subtitle")}</p>

      <div className="mt-6 flex flex-wrap gap-4">
        <div className="glass rounded-xl px-4 py-3">
          <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{liveCount}</p>
          <p className="text-xs text-zinc-500">{t("admin.live")}</p>
        </div>
        <div className="glass rounded-xl px-4 py-3">
          <p className="text-2xl font-bold text-amber-600">{reviewCount}</p>
          <p className="text-xs text-zinc-500">{t("admin.awaitingReview")}</p>
        </div>
        <div className="glass rounded-xl px-4 py-3">
          <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
          <p className="text-xs text-zinc-500">{t("admin.rejected")}</p>
        </div>
        <div className="glass rounded-xl px-4 py-3">
          <p className="text-2xl font-bold text-zinc-500">{staleCount}</p>
          <p className="text-xs text-zinc-500">{t("admin.stale")}</p>
        </div>
        <div className="glass rounded-xl px-4 py-3">
          <p className="text-2xl font-bold">{auditCount}</p>
          <p className="text-xs text-zinc-500">{t("admin.auditEvents")}</p>
        </div>
        <div
          className={`glass rounded-xl px-4 py-3 ${slaBreached > 0 ? "ring-2 ring-red-500/50" : ""}`}
        >
          <p className="text-2xl font-bold flex items-center gap-1">
            <Clock className="h-5 w-5" />
            {slaBreached}
          </p>
          <p className="text-xs text-zinc-500">
            {tf("admin.slaBreached", { hours: MODERATION_SLA_HOURS })}
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">{t("admin.queue")}</h2>
        {queue.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={ClipboardCheck}
              title={t("admin.queueEmpty.title")}
              description={t("admin.queueEmpty.desc")}
            />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {queue.map((listing) => {
              const verification = listing.verificationRuns[0];
              const sla = verification
                ? computeSlaStatus(verification.createdAt)
                : null;
              return (
                <div key={listing.id} className="glass rounded-2xl p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{listing.title}</h3>
                        <ListingStatusBadge status={listing.status} locale={locale} />
                        {sla && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              sla.breached
                                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                            }`}
                          >
                            {sla.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        {formatIqd(listing.sellerPriceIqd)} · {listing.category.nameEn} ·{" "}
                        {listing.seller.name} ({listing.seller.email})
                      </p>
                      {listing.canonicalProduct && (
                        <p className="mt-1 text-sm text-zinc-500">
                          {t("admin.matched")}: {listing.canonicalProduct.brand}{" "}
                          {listing.canonicalProduct.model}
                        </p>
                      )}
                      {verification && (
                        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                          <p>{verification.message}</p>
                          {verification.matchConfidence > 0 && (
                            <p className="mt-1 text-xs opacity-80">
                              {tf("admin.matchConfidence", {
                                percent: (verification.matchConfidence * 100).toFixed(0),
                              })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <ModerationActions listingId={listing.id} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {pendingKyc.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">
            {tf("admin.pendingKyc", { count: pendingKyc.length })}
          </h2>
          <div className="mt-4 space-y-3">
            {pendingKyc.map((profile) => (
              <div key={profile.id} className="glass rounded-xl p-4 text-sm">
                <p className="font-medium">{profile.legalName}</p>
                <p className="text-zinc-500">
                  {profile.user.name} · {profile.user.email} · {profile.governorate}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {tf("admin.documentsUploaded", { count: profile.kycDocuments.length })}
                </p>
                <KycActions profileId={profile.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-zinc-500" />
          <h2 className="text-xl font-semibold">{t("admin.audit")}</h2>
        </div>
        <div className="mt-4">
          <AuditTrail />
        </div>
      </section>
    </div>
  );
}
