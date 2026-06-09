import { NextResponse } from "next/server";
import { prisma } from "@htp/database";

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { whitelistStatus: "ACTIVE" },
    orderBy: { nameEn: "asc" },
  });

  return NextResponse.json({ data: categories });
}
