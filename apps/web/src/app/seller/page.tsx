import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, ShieldAlert } from "lucide-react";
import { prisma } from "@htp/database";
import { formatIqd } from "@htp/contracts";
import { getSession } from "@/lib/auth";
import { EmptyState } from "@/components/empty-state";
import { ListingStatusBadge } from "@/components/listing-status-badge";
import { getServerI18n } from "@/lib/i18n/server";
import { CreateListingForm } from "./create-listing-form";
import { SubmitListingButton } from "./submit-listing-button";
import { OnboardingForm } from "./onboarding-form";
import { CapEstimator } from "./cap-estimator";

export default async function SellerDashboardPage() {
  const session = await getSession();
  if (!session || (session.role !== "SELLER" && session.role !== "ADMIN")) {
    redirect("/login?redirect=/seller");
  }

  const { locale, t } = await getServerI18n();

  const [listings, categories, sellerProfile, pendingOrderCount, acceptedOfferCount] = await Promise.all([
    prisma.listing.findMany({
      where: { sellerId: session.id },
      include: {
        category: true,
        verificationRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.category.findMany({
      where: { whitelistStatus: "ACTIVE" },
      orderBy: { nameEn: "asc" },
    }),
    prisma.sellerProfile.findUnique({
      where: { userId: session.id },
      include: { kycDocuments: true },
    }),
    // Pending orders for this seller's listings
    prisma.order.count({
      where: {
        offer: { listing: { sellerId: session.id } },
        status: { in: ["CONFIRMED", "PAYMENT_PROCESSING", "COD_PENDING"] },
      },
    }),
    // Accepted offers awaiting checkout
    prisma.offer.count({
      where: {
        listing: { sellerId: session.id },
        status: "ACCEPTED",
        order: null,
      },
    }),
  ]);

  const kycApproved = sellerProfile?.kycStatus === "APPROVED";
  const liveCount = listings.filter((l) => l.status === "LIVE").length;
  const draftCount = listings.filter((l) => l.status === "DRAFT").length;
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.nameEn }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("seller.dashboard")}</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t("seller.dashboardSubtitle")}</p>

        {kycApproved && (
          <div className="mt-4 flex flex-wrap gap-4">
            <div className="glass rounded-xl px-4 py-3">
              <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{liveCount}</p>
              <p className="text-xs text-zinc-500">{t("seller.liveListings")}</p>
            </div>
            <div className="glass rounded-xl px-4 py-3">
              <p className="text-2xl font-bold">{draftCount}</p>
              <p className="text-xs text-zinc-500">{t("seller.drafts")}</p>
            </div>
            {pendingOrderCount > 0 && (
              <div className="glass rounded-xl px-4 py-3 ring-2 ring-amber-400/30">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingOrderCount}</p>
                <p className="text-xs text-zinc-500">{t("seller.pendingOrders")}</p>
              </div>
            )}
            {acceptedOfferCount > 0 && (
              <div className="glass rounded-xl px-4 py-3">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{acceptedOfferCount}</p>
                <p className="text-xs text-zinc-500">{t("seller.acceptedOffers")}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {!kycApproved && sellerProfile && (
        <OnboardingForm
          initial={{
            legalName: sellerProfile.legalName,
            displayName: sellerProfile.displayName,
            governorate: sellerProfile.governorate,
            licenseNumber: sellerProfile.licenseNumber ?? "",
            contactPhone: sellerProfile.contactPhone ?? "",
            payoutPreference: sellerProfile.payoutPreference ?? "",
            kycStatus: sellerProfile.kycStatus,
            documentCount: sellerProfile.kycDocuments.length,
          }}
        />
      )}

      {!kycApproved && !sellerProfile && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">{t("seller.profileNotFound")}</p>
            <p className="mt-1">
              {t("seller.contactAdmin")}{" "}
              <a href="mailto:admin@half-the-price.iq" className="underline">
                admin@half-the-price.iq
              </a>
            </p>
          </div>
        </div>
      )}

      {kycApproved && (
        <div className="grid gap-6 lg:grid-cols-2">
          <CapEstimator categories={categoryOptions} />
          <CreateListingForm categories={categoryOptions} />
        </div>
      )}

      <div className="mt-10">
        <h2 className="text-xl font-semibold">{t("seller.yourListings")}</h2>
        {listings.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={Package}
              title={t("seller.noListings.title")}
              description={
                kycApproved
                  ? t("seller.noListings.approved")
                  : t("seller.noListings.pending")
              }
            />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {listings.map((listing) => {
              const verification = listing.verificationRuns[0];
              return (
                <div
                  key={listing.id}
                  className="glass flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{listing.title}</h3>
                      <ListingStatusBadge status={listing.status} locale={locale} />
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {formatIqd(listing.sellerPriceIqd)} · {listing.category.nameEn} ·{" "}
                      {listing.governorate}
                    </p>
                    {verification && (
                      <div className="mt-3 space-y-1 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/50">
                        <p className="text-zinc-600 dark:text-zinc-400">{verification.message}</p>
                        {verification.verifiedRetailIqd != null && (
                          <p className="text-xs text-zinc-500">
                            {t("seller.retail")}: {formatIqd(verification.verifiedRetailIqd)}
                            {verification.computedCapIqd != null &&
                              ` · ${t("seller.cap")}: ${formatIqd(verification.computedCapIqd)}`}
                            {verification.matchConfidence > 0 &&
                              ` · ${t("seller.match")}: ${(verification.matchConfidence * 100).toFixed(0)}%`}
                          </p>
                        )}
                      </div>
                    )}
                    {listing.status === "LIVE" && (
                      <Link
                        href={`/listings/${listing.id}`}
                        className="mt-2 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {t("seller.viewLive")}
                      </Link>
                    )}
                  </div>
                  {(listing.status === "DRAFT" || listing.status === "REJECTED") &&
                    kycApproved && <SubmitListingButton listingId={listing.id} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
