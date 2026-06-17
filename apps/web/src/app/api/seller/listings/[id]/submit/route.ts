import { NextRequest, NextResponse } from "next/server";
import { requireMutatingAuth, jsonError } from "@/lib/api";
import { submitListingForVerification } from "@/lib/listings";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMutatingAuth(request, ["SELLER", "ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const result = await submitListingForVerification(id, auth.user.id);

  if (!result.success && result.message === "Listing not found.") {
    return jsonError(result.message, 404);
  }

  return NextResponse.json(result);
}
