import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@htp/database";
import { verifyWebhookSignature } from "@htp/payments";
import { jsonError } from "@/lib/api";

const PROVIDERS = new Set(["zaincash", "qicard", "fastpay"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!PROVIDERS.has(provider)) {
    return jsonError("Unknown provider.", 404);
  }

  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    return jsonError("Webhook secret not configured.", 503);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-htp-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return jsonError("Invalid signature.", 401);
  }

  const payload = JSON.parse(rawBody) as {
    orderId?: string;
    status?: string;
    providerRef?: string;
  };

  if (!payload.orderId) {
    return jsonError("Missing orderId.", 400);
  }

  const order = await prisma.order.findUnique({
    where: { id: payload.orderId },
    include: { paymentIntent: true },
  });

  if (!order) {
    return jsonError("Order not found.", 404);
  }

  if (
    order.status === "CONFIRMED" ||
    order.status === "FAILED" ||
    order.status === "CANCELLED"
  ) {
    return NextResponse.json({
      received: true,
      sandbox: true,
      message: "Order already processed and in a terminal state.",
    });
  }

  const succeeded = payload.status === "SUCCEEDED";

  if (order.paymentIntent) {
    await prisma.paymentIntent.update({
      where: { id: order.paymentIntent.id },
      data: {
        status: succeeded ? "SUCCEEDED" : "FAILED",
        providerRef: payload.providerRef ?? order.paymentIntent.providerRef,
      },
    });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: succeeded ? "CONFIRMED" : "FAILED",
      confirmedAt: succeeded ? new Date() : null,
    },
  });

  return NextResponse.json({ received: true, sandbox: true });
}
