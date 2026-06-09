import { NextRequest, NextResponse } from "next/server";
import { getLiveListings } from "@/lib/listings";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const result = await getLiveListings({
    query: searchParams.get("q") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    governorate: searchParams.get("governorate") ?? undefined,
    page: Number(searchParams.get("page") ?? "1"),
    limit: Number(searchParams.get("limit") ?? "12"),
  });

  return NextResponse.json(result);
}
