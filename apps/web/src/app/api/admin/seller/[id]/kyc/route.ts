import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@htp/database";
import { requireMutatingAuth, jsonError, withCorrelation } from "@/lib/api";
import { sanitizeText } from "@/lib/sanitize";

const kycActionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().min(5).max(500),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withCorrelation(request, async () => {
    const auth = await requireMutatingAuth(request, ["ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const profile = await prisma.sellerProfile.findUnique({
      where: { id },
      include: { kycDocuments: true },
    });

    if (!profile) {
      return jsonError("Seller profile not found.", 404);
    }

    const body: unknown = await request.json();
    const parsed = kycActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (parsed.data.action === "APPROVE" && profile.kycDocuments.length === 0) {
      return jsonError("Cannot approve KYC without uploaded documents.", 400);
    }

    const newStatus = parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED";

    const updated = await prisma.sellerProfile.update({
      where: { id },
      data: { kycStatus: newStatus },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: auth.user.id,
        objectType: "seller_profile",
        objectId: id,
        action: "KYC_REVIEW",
        before: { kycStatus: profile.kycStatus },
        after: {
          kycStatus: newStatus,
          reason: sanitizeText(parsed.data.reason, 500),
          action: parsed.data.action,
        },
      },
    });

    return NextResponse.json(updated);
  });
}
