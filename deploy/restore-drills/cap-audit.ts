import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting price cap audit...");

  const liveListings = await prisma.listing.findMany({
    where: { status: "LIVE" },
    include: {
      verificationRuns: {
        where: { result: "PASS" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  let violationsCount = 0;
  for (const listing of liveListings) {
    const latestRun = listing.verificationRuns[0];
    if (!latestRun) {
      console.warn(`[VIOLATION] Listing "${listing.title}" (ID: ${listing.id}) is LIVE but has no passing price verification run.`);
      violationsCount++;
    } else if (listing.sellerPriceIqd > (latestRun.computedCapIqd ?? 0)) {
      console.warn(`[VIOLATION] Listing "${listing.title}" (ID: ${listing.id}) price IQD ${listing.sellerPriceIqd} exceeds computed cap IQD ${latestRun.computedCapIqd}.`);
      violationsCount++;
    }
  }

  if (violationsCount > 0) {
    console.error(`Audit failed: Found ${violationsCount} price cap violations.`);
    process.exit(1);
  }

  console.log("Audit passed: No price cap violations found.");
  process.exit(0);
}

main()
  .catch((err) => {
    console.error("Fatal error during price cap audit:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
