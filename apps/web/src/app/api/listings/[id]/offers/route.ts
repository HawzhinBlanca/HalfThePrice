import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, validateOfferAmount } from "@htp/database";
import { requireMutatingAuth, localizedError, jsonError, withCorrelation } from "@/lib/api";

const offerSchema = z.object({
  amountIqd: z.number().int().positive(),
  message: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withCorrelation(request, async () => {
    const auth = await requireMutatingAuth(request, ["BUYER", "ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const { id: listingId } = await params;

    const listing = await prisma.listing.findFirst({
      where: { id: listingId, status: "LIVE" },
      include: {
        verificationRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!listing) {
      return localizedError("LISTING_UNAVAILABLE", 404, request);
    }

    if (listing.sellerId === auth.user.id) {
      return jsonError("Sellers cannot make offers on their own listings.", 400);
    }

    // Double-offer guard: prevent duplicate active offers from the same buyer
    const existingOffer = await prisma.offer.findFirst({
      where: {
        listingId,
        buyerId: auth.user.id,
        status: { in: ["PENDING", "ACCEPTED"] },
      },
    });
    if (existingOffer) {
      return NextResponse.json(
        { error: "You already have an active offer on this listing.", existingOfferId: existingOffer.id },
        { status: 409 },
      );
    }

    const verification = listing.verificationRuns[0];
    if (!verification?.computedCapIqd) {
      return jsonError("Listing has no verified price cap.", 400);
    }

    const body: unknown = await request.json();
    const parsed = offerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const validation = validateOfferAmount(
      parsed.data.amountIqd,
      verification.computedCapIqd,
    );

    if (!validation.valid) {
      return jsonError(validation.reason ?? "Offer rejected.", 400);
    }

    const offer = await prisma.offer.create({
      data: {
        listingId,
        buyerId: auth.user.id,
        amountIqd: parsed.data.amountIqd,
        capSnapshotIqd: verification.computedCapIqd,
        message: parsed.data.message,
        status: "PENDING",
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: auth.user.id,
        objectType: "offer",
        objectId: offer.id,
        action: "OFFER_CREATED",
        after: { amount: offer.amountIqd, cap: offer.capSnapshotIqd },
      },
    });

    return NextResponse.json(offer, { status: 201 });
  });
}
