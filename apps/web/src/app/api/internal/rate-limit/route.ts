import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@htp/database";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const internalSecret = process.env.NEXTAUTH_SECRET;
  const headerSecret = request.headers.get("x-internal-request");

  if (!internalSecret || headerSecret !== internalSecret) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const { key, limit = 60, windowSeconds = 60 } = await request.json() as {
      key: string;
      limit?: number;
      windowSeconds?: number;
    };

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      // Clear expired entries globally or for this specific key
      await tx.rateLimit.deleteMany({
        where: {
          OR: [
            { key },
            { expireAt: { lte: now } }
          ],
          expireAt: { lte: now }
        }
      });

      const entry = await tx.rateLimit.findUnique({
        where: { key },
      });

      if (!entry) {
        await tx.rateLimit.create({
          data: {
            key,
            points: 1,
            expireAt: new Date(Date.now() + windowSeconds * 1000),
          },
        });
        return { allowed: true };
      }

      if (entry.points >= limit) {
        return { allowed: false };
      }

      await tx.rateLimit.update({
        where: { key },
        data: { points: { increment: 1 } },
      });
      return { allowed: true };
    });

    if (!result.allowed) {
      logger.warn("Rate limit triggered", { key, limit });
      return new Response("Too Many Requests", { status: 429 });
    }

    return new Response("OK", { status: 200 });

  } catch (error) {
    logger.error("Internal rate limit error", {
      error: error instanceof Error ? error.stack || error.message : String(error),
    });
    return new Response("Internal Server Error", { status: 500 });
  }
}
