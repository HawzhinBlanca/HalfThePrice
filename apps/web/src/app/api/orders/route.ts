import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { type PaymentProviderId } from "@htp/payments";
import { createOrderFromOffer } from "@htp/core";
import { requireMutatingAuth, localizedError } from "@/lib/api";
import { isFeatureEnabled } from "@/lib/features";

const schema = z.object({
  offerId: z.string().min(1),
  paymentMethod: z.enum(["COD", "ZAINCASH", "QICARD", "FASTPAY"]),
});

export async function POST(request: NextRequest) {
  if (!isFeatureEnabled("CHECKOUT")) {
    return new Response("Checkout is temporarily disabled.", { status: 503 });
  }

  const auth = await requireMutatingAuth(request, ["BUYER", "ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return localizedError("INVALID_INPUT", 400, request);
  }

  try {
    const paymentMethod = parsed.data.paymentMethod as PaymentProviderId;
    const result = await createOrderFromOffer(
      parsed.data.offerId,
      auth.user.id,
      paymentMethod
    );

    return NextResponse.json(
      {
        order: result.order,
        payment: result.payment,
      },
      { status: 201 },
    );
  } catch (error) {
    const err = error as { message?: string };
    if (err.message === "OFFER_NOT_FOUND") {
      return localizedError("NOT_FOUND", 404, request);
    }
    if (err.message === "ORDER_INVALID") {
      return localizedError("ORDER_INVALID", 400, request);
    }
    throw error;
  }
}
