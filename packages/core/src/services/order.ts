import { prisma, acquireAdvisoryLock } from "@htp/database";
import { getPaymentProvider, type PaymentProviderId } from "@htp/payments";

export async function createOrderFromOffer(
  offerId: string,
  buyerId: string,
  paymentMethod: PaymentProviderId,
) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      listing: true,
      order: true,
      buyer: { select: { email: true } },
    },
  });

  if (!offer || offer.buyerId !== buyerId) {
    throw new Error("OFFER_NOT_FOUND");
  }

  if (offer.status !== "ACCEPTED") {
    throw new Error("ORDER_INVALID");
  }

  if (offer.order) {
    return { order: offer.order, payment: null };
  }

  const provider = getPaymentProvider(paymentMethod);

  return await prisma.$transaction(async (tx) => {
    await acquireAdvisoryLock(tx, `offer_${offer.id}`);

    // Re-verify that order wasn't created concurrently
    const existingOrder = await tx.order.findFirst({
      where: { offerId: offer.id },
    });
    if (existingOrder) {
      return { order: existingOrder, payment: null };
    }

    const order = await tx.order.create({
      data: {
        offerId: offer.id,
        listingId: offer.listingId,
        buyerId: offer.buyerId,
        sellerId: offer.listing.sellerId,
        amountIqd: offer.amountIqd,
        status: paymentMethod === "COD" ? "COD_PENDING" : "PENDING_PAYMENT",
        paymentMethod,
        codEnabled: paymentMethod === "COD",
      },
    });

    const paymentResult = await provider.initializePayment({
      orderId: order.id,
      amountIqd: order.amountIqd,
      buyerEmail: offer.buyer.email,
    });

    const paymentIntent = await tx.paymentIntent.create({
      data: {
        orderId: order.id,
        provider: paymentMethod,
        status: paymentResult.status,
        providerRef: paymentResult.providerRef,
        sandbox: paymentResult.sandbox,
        metadata: { message: paymentResult.message },
      },
    });

    const finalStatus =
      paymentResult.status === "SUCCEEDED"
        ? paymentMethod === "COD"
          ? "COD_PENDING"
          : "CONFIRMED"
        : paymentResult.status === "FAILED"
          ? "FAILED"
          : "PAYMENT_PROCESSING";

    const confirmedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: finalStatus,
        confirmedAt: finalStatus === "CONFIRMED" ? new Date() : null,
      },
      include: { paymentIntent: true },
    });

    await tx.auditEvent.create({
      data: {
        actorId: buyerId,
        objectType: "order",
        objectId: order.id,
        action: "ORDER_CREATED",
        after: {
          status: finalStatus,
          paymentMethod,
          sandbox: paymentIntent.sandbox,
        },
      },
    });

    return { order: confirmedOrder, payment: paymentResult };
  });
}
