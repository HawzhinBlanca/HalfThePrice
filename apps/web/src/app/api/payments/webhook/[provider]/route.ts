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
  const timestamp = request.headers.get("x-htp-timestamp");

  if (!timestamp) {
    return jsonError("Missing timestamp header.", 400);
  }

  if (!verifyWebhookSignature(rawBody, signature, secret, timestamp)) {
    return jsonError("Invalid signature or timestamp.", 401);
  }

  const payload = JSON.parse(rawBody) as {
    eventId?: string;
    orderId?: string;
    status?: string;
    providerRef?: string;
  };

  if (!payload.orderId) {
    return jsonError("Missing orderId.", 400);
  }

  const eventId = payload.eventId ?? `${provider}_${payload.providerRef ?? "noref"}_${payload.status ?? "unknown"}_${payload.orderId}`;
  const succeeded = payload.status === "SUCCEEDED";

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Record the webhook event for idempotency
      await tx.webhookEvent.create({
        data: {
          provider,
          providerEventId: eventId,
          payload: rawBody,
        },
      });

      // 2. Fetch the order
      const order = await tx.order.findUnique({
        where: { id: payload.orderId },
        include: { paymentIntent: true },
      });

      if (!order) {
        throw new Error("ORDER_NOT_FOUND");
      }

      // 3. Short-circuit if order is already terminal
      if (
        order.status === "CONFIRMED" ||
        order.status === "FAILED" ||
        order.status === "CANCELLED"
      ) {
        return { alreadyProcessed: true };
      }

      // 4. Update status
      if (order.paymentIntent) {
        await tx.paymentIntent.update({
          where: { id: order.paymentIntent.id },
          data: {
            status: succeeded ? "SUCCEEDED" : "FAILED",
            providerRef: payload.providerRef ?? order.paymentIntent.providerRef,
          },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: succeeded ? "CONFIRMED" : "FAILED",
          confirmedAt: succeeded ? new Date() : null,
        },
      });

      return { alreadyProcessed: false };
    });

    if (result.alreadyProcessed) {
      return NextResponse.json({
        received: true,
        sandbox: true,
        message: "Order already processed and in a terminal state.",
      });
    }

    return NextResponse.json({ received: true, sandbox: true });

  } catch (err) {
    const error = err as { code?: string; message?: string };
    // Unique constraint violation (Prisma error code P2002)
    if (error.code === "P2002") {
      return NextResponse.json({
        received: true,
        sandbox: true,
        message: "Event already processed (duplicate webhook).",
      });
    }

    if (error.message === "ORDER_NOT_FOUND") {
      return jsonError("Order not found.", 404);
    }

    throw err;
  }
}
