import { NextRequest, NextResponse } from "next/server";
import { requireMutatingAuth, jsonError, withCorrelation } from "@/lib/api";
import { submitListingForVerification } from "@htp/core";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withCorrelation(request, async () => {
    const auth = await requireMutatingAuth(request, ["SELLER", "ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const result = await submitListingForVerification(id, auth.user.id);

    if (!result.success && result.message === "Listing not found.") {
      return jsonError(result.message, 404);
    }

    return NextResponse.json(result);
  });
}
