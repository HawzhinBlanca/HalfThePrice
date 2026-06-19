import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { refreshRetailReferencesForTitle } from "@htp/database";
import { requireMutatingAuth, localizedError, withCorrelation } from "@/lib/api";

const schema = z.object({
  title: z.string().min(2).max(500),
  canonicalProductId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  return withCorrelation(request, async () => {
    const auth = await requireMutatingAuth(request, ["ADMIN", "SELLER"]);
    if (auth instanceof NextResponse) return auth;

    const body: unknown = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return localizedError("INVALID_INPUT", 400, request);
    }

    const result = await refreshRetailReferencesForTitle(
      parsed.data.title,
      parsed.data.canonicalProductId,
    );

    if (!result) {
      return localizedError("NOT_FOUND", 404, request);
    }

    return NextResponse.json(result);
  });
}
