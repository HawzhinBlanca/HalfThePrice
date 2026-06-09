import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@htp/database";
import {
  getPaymentProvider,
  type PaymentProviderId,
} from "@htp/payments";
import { requireMutatingAuth, localizedError } from "@/lib/api";

const schema = z.object({
  offerId: z.string().min(1),
  paymentMethod: z.enum(["COD", "ZAINCASH", "QICARD", "FASTPAY"]),
});

export async function POST(request: NextRequest) {
  const auth = await requireMutatingAuth(request, ["BUYER", "ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return localizedError("INVALID_INPUT", 400, request);
  }

  const offer = await prisma.offer.findUnique({
    where: { id: parsed.data.offerId },
    include: {
      listing: true,
      order: true,
      buyer: { select: { email: true } },
    },
  });

  if (!offer || offer.buyerId !== auth.user.id) {
    return localizedError("NOT_FOUND", 404, request);
  }

  if (offer.status !== "ACCEPTED") {
    return localizedError("ORDER_INVALID", 400, request);
  }

  if (offer.order) {
    return NextResponse.json(offer.order);
  }

  const paymentMethod = parsed.data.paymentMethod as PaymentProviderId;
  const provider = getPaymentProvider(paymentMethod);

  const order = await prisma.order.create({
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

  const paymentIntent = await prisma.paymentIntent.create({
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

  const confirmedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: finalStatus,
      confirmedAt: finalStatus === "CONFIRMED" ? new Date() : null,
    },
    include: { paymentIntent: true },
  });

  await prisma.auditEvent.create({
    data: {
      actorId: auth.user.id,
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

  return NextResponse.json(
    {
      order: confirmedOrder,
      payment: paymentResult,
    },
    { status: 201 },
  );
}
