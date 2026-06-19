import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@htp/database";
import { requireAuth, withCorrelation } from "@/lib/api";

export async function GET(request: NextRequest) {
  return withCorrelation(request, async () => {
    const auth = await requireAuth(["ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const queue = await prisma.listing.findMany({
      where: { status: "MANUAL_REVIEW" },
      include: {
        category: true,
        canonicalProduct: true,
        seller: {
          select: {
            name: true,
            email: true,
            sellerProfile: true,
          },
        },
        verificationRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "asc" },
    });

    return NextResponse.json({ data: queue });
  });
}
