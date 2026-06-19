import { NextRequest, NextResponse } from "next/server";
import { getLiveListings } from "@/lib/listings";
import { withCorrelation } from "@/lib/api";

export async function GET(request: NextRequest) {
  return withCorrelation(request, async () => {
    const { searchParams } = request.nextUrl;
    const result = await getLiveListings({
      query: searchParams.get("q") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      governorate: searchParams.get("governorate") ?? undefined,
      page: Number(searchParams.get("page") ?? "1"),
      limit: Number(searchParams.get("limit") ?? "12"),
    });

    return NextResponse.json(result);
  });
}
