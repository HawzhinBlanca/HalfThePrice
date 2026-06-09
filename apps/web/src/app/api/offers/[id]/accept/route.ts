import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@htp/database";
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

  const updated = await prisma.offer.update({
    where: { id: offerId },
    data: { status: "ACCEPTED" },
  });

  await prisma.auditEvent.create({
    data: {
      actorId: auth.user.id,
      objectType: "offer",
      objectId: offerId,
      action: "OFFER_ACCEPTED",
    },
  });

  return NextResponse.json(updated);
}
