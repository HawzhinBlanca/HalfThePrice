import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { estimateCap } from "@htp/database";
import { jsonError, withCorrelation } from "@/lib/api";
import { sanitizeText } from "@/lib/sanitize";

const estimateSchema = z.object({
  title: z.string().min(3).max(200),
  categoryId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  return withCorrelation(request, async () => {
    try {
      const body: unknown = await request.json();
      const parsed = estimateSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid input", details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const title = sanitizeText(parsed.data.title, 200);
      const estimate = await estimateCap(title, parsed.data.categoryId);

      if (!estimate) {
        return jsonError("Category not found or not active.", 404);
      }

      return NextResponse.json(estimate);
    } catch {
      return jsonError("Cap estimation failed.", 500);
    }
  });
}
