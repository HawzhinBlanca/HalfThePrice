import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@htp/database";
import {
  conversationChannel,
  createCentrifugoToken,
} from "@/lib/centrifugo";
import { requireAuth, requireMutatingAuth, localizedError, withCorrelation } from "@/lib/api";
import { isFeatureEnabledAsync } from "@/lib/features";

const createSchema = z.object({
  listingId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  return withCorrelation(request, async () => {
    if (!(await isFeatureEnabledAsync("CHAT"))) {
      return new Response("Chat is temporarily disabled.", { status: 503 });
    }

    const auth = await requireMutatingAuth(request, ["BUYER", "SELLER", "ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const body: unknown = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return localizedError("INVALID_INPUT", 400, request);
    }

    const listing = await prisma.listing.findFirst({
      where: { id: parsed.data.listingId, status: "LIVE" },
    });

    if (!listing) {
      return localizedError("LISTING_UNAVAILABLE", 404, request);
    }

    const isBuyer = auth.user.role === "BUYER" || auth.user.role === "ADMIN";
    const buyerId = isBuyer ? auth.user.id : undefined;
    const sellerId = listing.sellerId;

    if (!buyerId) {
      return localizedError("FORBIDDEN", 403, request);
    }

    if (buyerId === sellerId) {
      return localizedError("FORBIDDEN", 403, request);
    }

    const conversation = await prisma.conversation.upsert({
      where: {
        listingId_buyerId_sellerId: {
          listingId: listing.id,
          buyerId,
          sellerId,
        },
      },
      create: {
        listingId: listing.id,
        buyerId,
        sellerId,
      },
      update: {},
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 50 },
      },
    });

    const channel = conversationChannel(conversation.id);
    const token = await createCentrifugoToken({
      userId: auth.user.id,
      channels: [channel],
    });

    return NextResponse.json({
      conversation,
      channel,
      centrifugoToken: token,
      wsUrl: process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL ?? "ws://localhost:8000/connection/websocket",
    });
  });
}

export async function GET(request: NextRequest) {
  return withCorrelation(request, async () => {
    if (!(await isFeatureEnabledAsync("CHAT"))) {
      return new Response("Chat is temporarily disabled.", { status: 503 });
    }

    const auth = await requireAuth(["BUYER", "SELLER", "ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const conversations = await prisma.conversation.findMany({
      where:
        auth.user.role === "SELLER"
          ? { sellerId: auth.user.id }
          : { buyerId: auth.user.id },
      include: {
        listing: { select: { id: true, title: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(conversations);
  });
}
