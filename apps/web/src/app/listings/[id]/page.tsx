import Image from "next/image";
import { notFound } from "next/navigation";
import { MapPin, ShieldCheck } from "lucide-react";
import { prisma } from "@htp/database";
import { formatIqd } from "@htp/contracts";
import { getSession } from "@/lib/auth";
import { VerificationPanel } from "@/components/verification-panel";
import { VerificationBadge } from "@/components/verification-badge";
import { getConditionLabel } from "@/lib/i18n/labels";
import { getServerI18n } from "@/lib/i18n/server";
import { OfferForm } from "./offer-form";
import { CheckoutForm } from "./checkout-form";
import { ListingChat } from "@/components/listing-chat";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, { locale, t }] = await Promise.all([getSession(), getServerI18n()]);

  const acceptedOffer =
    session?.role === "BUYER" || session?.role === "ADMIN"
      ? await prisma.offer.findFirst({
          where: {
            listingId: id,
            buyerId: session.id,
            status: "ACCEPTED",
            order: null,
          },
        })
      : null;

  const listing = await prisma.listing.findFirst({
    where: { id, status: "LIVE" },
    include: {
      category: true,
      canonicalProduct: {
        include: {
          retailReferences: {
            orderBy: { observedAt: "desc" },
            take: 5,
          },
        },
      },
      verificationRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      seller: {
        select: {
          name: true,
          sellerProfile: { select: { displayName: true, governorate: true, kycStatus: true } },
        },
      },
    },
  });

  if (!listing) notFound();

  const verification = listing.verificationRuns[0];
  const verifiedRetail = verification?.verifiedRetailIqd ?? null;
  const retailReferences = listing.canonicalProduct?.retailReferences ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-zinc-100 trust-ring dark:bg-zinc-800">
          {listing.imageUrl ? (
            <Image
              src={listing.imageUrl}
              alt={listing.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <ShieldCheck className="h-24 w-24 text-zinc-300" />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">
                {listing.category.nameEn}
              </span>
              <VerificationBadge locale={locale} />
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{listing.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {listing.governorate}
              </span>
              <span>{getConditionLabel(locale, listing.condition)}</span>
              {listing.seller.sellerProfile?.kycStatus === "APPROVED" && (
                <span className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400">
                  <ShieldCheck className="h-4 w-4" />
                  {t("listing.verifiedSeller")}
                </span>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <p className="text-3xl font-bold">{formatIqd(listing.sellerPriceIqd)}</p>
            {verifiedRetail != null && (
              <p className="mt-1 text-zinc-500 line-through">
                {t("listing.verifiedRetail")}: {formatIqd(verifiedRetail)}
              </p>
            )}
          </div>

          {listing.description && (
            <div>
              <h2 className="font-semibold">{t("listing.description")}</h2>
              <p className="mt-2 leading-relaxed text-zinc-600 dark:text-zinc-400">
                {listing.description}
              </p>
            </div>
          )}

          {listing.canonicalProduct && (
            <div className="text-sm text-zinc-500">
              {t("listing.matchedProduct")}: {listing.canonicalProduct.brand}{" "}
              {listing.canonicalProduct.model}
            </div>
          )}

          {acceptedOffer && (
            <CheckoutForm
              offerId={acceptedOffer.id}
              amountIqd={acceptedOffer.amountIqd}
            />
          )}

          {session?.role === "BUYER" || session?.role === "ADMIN" ? (
            <>
              <OfferForm
                listingId={listing.id}
                maxCap={verification?.computedCapIqd ?? listing.sellerPriceIqd}
              />
              <ListingChat listingId={listing.id} userId={session.id} />
            </>
          ) : session ? (
            <p className="text-sm text-zinc-500">{t("listing.signInBuyer")}</p>
          ) : (
            <a
              href="/login"
              className="inline-flex rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              {t("listing.signInOffer")}
            </a>
          )}
        </div>
      </div>

      {verification && (
        <div className="mt-12">
          <VerificationPanel
            locale={locale}
            verifiedRetailIqd={verification.verifiedRetailIqd}
            computedCapIqd={verification.computedCapIqd}
            sellerPriceIqd={listing.sellerPriceIqd}
            matchConfidence={verification.matchConfidence}
            message={verification.message}
            retailReferences={retailReferences}
          />
        </div>
      )}
    </div>
  );
}
