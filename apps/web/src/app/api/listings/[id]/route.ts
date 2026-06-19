import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@htp/database";
import { formatSavingsPercent } from "@htp/contracts";
import { withCorrelation } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withCorrelation(request, async () => {
    const { id } = await params;

    const listing = await prisma.listing.findFirst({
      where: { id, status: "LIVE" },
      include: {
        category: true,
        canonicalProduct: true,
        verificationRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        seller: {
          select: {
            name: true,
            sellerProfile: { select: { displayName: true, governorate: true, kycStatus: true } },
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const verification = listing.verificationRuns[0];
    const verifiedRetail = verification?.verifiedRetailIqd ?? null;
    const savingsPercent =
      verifiedRetail !== null
        ? formatSavingsPercent(listing.sellerPriceIqd, verifiedRetail)
        : null;

    return NextResponse.json({
      ...listing,
      verification: verification
        ? {
            verifiedRetailIqd: verification.verifiedRetailIqd,
            computedCapIqd: verification.computedCapIqd,
            result: verification.result,
          }
        : null,
      savingsPercent,
    });
  });
}
