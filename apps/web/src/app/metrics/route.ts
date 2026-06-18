import { NextResponse } from "next/server";
import { prisma } from "@htp/database";

export const dynamic = "force-dynamic";

export async function GET() {
  const memory = process.memoryUsage();
  const uptime = process.uptime();

  let liveListingsCount = 0;
  let violationsCount = 0;
  let dbUp = 1;
  let errorMsg = "";

  try {
    // Basic ping check
    await prisma.$queryRaw`SELECT 1`;
    liveListingsCount = await prisma.listing.count({
      where: { status: "LIVE" },
    });

    // Query cap violations for Prometheus alerting
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

    for (const listing of liveListings) {
      const latestRun = listing.verificationRuns[0];
      if (!latestRun || listing.sellerPriceIqd > (latestRun.computedCapIqd ?? 0)) {
        violationsCount++;
      }
    }
  } catch (err) {
    dbUp = 0;
    errorMsg = err instanceof Error ? err.message : "Unreachable";
  }

  const lines = [
    `# HELP node_memory_rss_bytes Node.js process resident set size (RSS) in bytes.`,
    `# TYPE node_memory_rss_bytes gauge`,
    `node_memory_rss_bytes ${memory.rss}`,
    `# HELP node_memory_heap_used_bytes Node.js process heap memory used in bytes.`,
    `# TYPE node_memory_heap_used_bytes gauge`,
    `node_memory_heap_used_bytes ${memory.heapUsed}`,
    `# HELP node_uptime_seconds Uptime of the Node.js process in seconds.`,
    `# TYPE node_uptime_seconds gauge`,
    `node_uptime_seconds ${uptime}`,
    `# HELP htp_database_up Database connection health status (1 = UP, 0 = DOWN).`,
    `# TYPE htp_database_up gauge`,
    `htp_database_up ${dbUp}`,
    `# HELP htp_live_listings_count Count of published LIVE listings in the marketplace.`,
    `# TYPE htp_live_listings_count gauge`,
    `htp_live_listings_count ${liveListingsCount}`,
    `# HELP htp_price_cap_violations_count Count of LIVE listings violating the half-price cap.`,
    `# TYPE htp_price_cap_violations_count gauge`,
    `htp_price_cap_violations_count ${violationsCount}`
  ];

  if (errorMsg) {
    lines.push(`# DB ERROR: ${errorMsg}`);
  }

  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
