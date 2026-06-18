import { NextRequest, NextResponse } from "next/server";
import { prisma, acquireAdvisoryLock } from "@htp/database";
import { requireMutatingAuth, localizedError } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMutatingAuth(request, ["SELLER", "ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const { id: offerId } = await params;

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { listing: true },
  });

  if (!offer || offer.listing.sellerId !== auth.user.id) {
    return localizedError("NOT_FOUND", 404, request);
  }

  if (offer.status !== "PENDING") {
    return localizedError("ORDER_INVALID", 400, request);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await acquireAdvisoryLock(tx, `offer_${offerId}`);
      const updateResult = await tx.offer.updateMany({
        where: { id: offerId, status: "PENDING" },
        data: { status: "ACCEPTED" },
      });

      if (updateResult.count === 0) {
        throw new Error("OFFER_NOT_PENDING");
      }

      const updatedOffer = await tx.offer.findUnique({
        where: { id: offerId },
      });

      await tx.auditEvent.create({
        data: {
          actorId: auth.user.id,
          objectType: "offer",
          objectId: offerId,
          action: "OFFER_ACCEPTED",
        },
      });

      return updatedOffer;
    });

    return NextResponse.json(updated);
  } catch (error) {
    const err = error as { message?: string };
    if (err.message === "OFFER_NOT_PENDING") {
      return localizedError("ORDER_INVALID", 400, request);
    }
    throw error;
  }
}
