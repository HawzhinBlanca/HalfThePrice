import { NextResponse } from "next/server";
import { prisma } from "@htp/database";
import { requireAuth } from "@/lib/api";

export async function GET() {
  const auth = await requireAuth(["ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  // Find all LIVE listings
  const liveListings = await prisma.listing.findMany({
    where: { status: "LIVE" },
    include: {
      category: true,
      verificationRuns: {
        where: { result: "PASS" },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          selectedReference: true,
        },
      },
    },
  });

  const violations = [];
  const now = new Date();

  for (const listing of liveListings) {
    const latestRun = listing.verificationRuns[0];
    if (!latestRun) {
      violations.push({
        listingId: listing.id,
        title: listing.title,
        reason: "No passing price verification run found for LIVE listing",
      });
      continue;
    }

    if (listing.sellerPriceIqd > (latestRun.computedCapIqd ?? 0)) {
      violations.push({
        listingId: listing.id,
        title: listing.title,
        sellerPriceIqd: listing.sellerPriceIqd,
        computedCapIqd: latestRun.computedCapIqd,
        reason: "Seller price exceeds verified price cap",
      });
      continue;
    }

    const ref = latestRun.selectedReference;
    if (!ref) {
      violations.push({
        listingId: listing.id,
        title: listing.title,
        reason: "Selected retail reference not found for passing run",
      });
      continue;
    }

    const ageMs = now.getTime() - ref.observedAt.getTime();
    const ttlMs = listing.category.retailTtlDays * 24 * 60 * 60 * 1000;
    if (ageMs > ttlMs) {
      violations.push({
        listingId: listing.id,
        title: listing.title,
        observedAt: ref.observedAt,
        ttlDays: listing.category.retailTtlDays,
        reason: "Selected retail reference is stale",
      });
    }
  }

  return NextResponse.json({
    violationsCount: violations.length,
    violations,
  });
}
