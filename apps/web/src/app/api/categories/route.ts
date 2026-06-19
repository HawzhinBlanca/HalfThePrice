import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@htp/database";
import { withCorrelation } from "@/lib/api";

export async function GET(request: NextRequest) {
  return withCorrelation(request, async () => {
    const categories = await prisma.category.findMany({
      where: { whitelistStatus: "ACTIVE" },
      orderBy: { nameEn: "asc" },
    });

    return NextResponse.json({ data: categories });
  });
}
