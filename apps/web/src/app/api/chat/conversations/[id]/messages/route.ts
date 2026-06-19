import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@htp/database";
import {
  conversationChannel,
  createCentrifugoToken,
  publishToChannel,
} from "@/lib/centrifugo";
import { requireAuth, requireMutatingAuth, localizedError, withCorrelation } from "@/lib/api";
import { isFeatureEnabledAsync } from "@/lib/features";

const messageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withCorrelation(request, async () => {
    if (!(await isFeatureEnabledAsync("CHAT"))) {
      return new Response("Chat is temporarily disabled.", { status: 503 });
    }

    const auth = await requireAuth(["BUYER", "SELLER", "ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 100 },
      },
    });

    if (!conversation) {
      return localizedError("NOT_FOUND", 404);
    }

    const isParticipant =
      conversation.buyerId === auth.user.id ||
      conversation.sellerId === auth.user.id ||
      auth.user.role === "ADMIN";

    if (!isParticipant) {
      return localizedError("FORBIDDEN", 403);
    }

    const channel = conversationChannel(conversation.id);
    const token = await createCentrifugoToken({
      userId: auth.user.id,
      channels: [channel],
    });

    return NextResponse.json({
      messages: conversation.messages,
      channel,
      centrifugoToken: token,
      wsUrl: process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL ?? "ws://localhost:8000/connection/websocket",
    });
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withCorrelation(request, async () => {
    if (!(await isFeatureEnabledAsync("CHAT"))) {
      return new Response("Chat is temporarily disabled.", { status: 503 });
    }

    const auth = await requireMutatingAuth(request, ["BUYER", "SELLER", "ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = messageSchema.safeParse(body);

    if (!parsed.success) {
      return localizedError("INVALID_INPUT", 400, request);
    }

    const conversation = await prisma.conversation.findUnique({ where: { id } });

    if (!conversation) {
      return localizedError("NOT_FOUND", 404, request);
    }

    const isParticipant =
      conversation.buyerId === auth.user.id ||
      conversation.sellerId === auth.user.id;

    if (!isParticipant) {
      return localizedError("FORBIDDEN", 403, request);
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: auth.user.id,
        content: parsed.data.content,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    const channel = conversationChannel(conversation.id);

    try {
      await publishToChannel(channel, {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        createdAt: message.createdAt.toISOString(),
      });
    } catch {
      // Centrifugo may be offline in dev — message still persisted
    }

    return NextResponse.json(message, { status: 201 });
  });
}
