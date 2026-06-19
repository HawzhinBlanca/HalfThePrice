import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@htp/database";
import { requireMutatingAuth, jsonError, withCorrelation } from "@/lib/api";

const overrideSchema = z.object({
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

    const listing = await prisma.listing.findUnique({
      where: { id },
    });

    if (!listing || listing.status !== "MANUAL_REVIEW") {
      return jsonError("Listing not in manual review queue.", 404);
    }

    const body: unknown = await request.json();
    const parsed = overrideSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const newStatus = parsed.data.action === "APPROVE" ? "LIVE" : "REJECTED";

    const updated = await prisma.listing.update({
      where: { id },
      data: {
        status: newStatus,
        publishedAt: newStatus === "LIVE" ? new Date() : null,
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: auth.user.id,
        objectType: "listing",
        objectId: id,
        action: "ADMIN_OVERRIDE",
        before: { status: listing.status },
        after: {
          status: newStatus,
          reason: parsed.data.reason,
          action: parsed.data.action,
        },
      },
    });

    return NextResponse.json(updated);
  });
}
