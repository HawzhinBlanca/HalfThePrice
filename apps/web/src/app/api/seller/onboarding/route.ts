import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@htp/database";
import { requireAuth, jsonError } from "@/lib/api";
import { sanitizeText } from "@/lib/sanitize";

const onboardingSchema = z.object({
  legalName: z.string().min(2).max(200),
  displayName: z.string().min(2).max(100),
  governorate: z.string().min(2).max(100),
  licenseNumber: z.string().min(3).max(50).optional(),
  contactPhone: z.string().min(8).max(20).optional(),
  payoutPreference: z.enum(["COD", "ZAINCASH", "QICARD", "FASTPAY"]).optional(),
});

export async function GET() {
  const auth = await requireAuth(["SELLER", "ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: auth.user.id },
    include: {
      kycDocuments: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!profile) {
    return jsonError("Seller profile not found.", 404);
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(["SELLER", "ADMIN"]);
  if (auth instanceof NextResponse) return auth;

  const body: unknown = await request.json();
  const parsed = onboardingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: auth.user.id },
  });

  if (!profile) {
    return jsonError("Seller profile not found.", 404);
  }

  const updated = await prisma.sellerProfile.update({
    where: { id: profile.id },
    data: {
      legalName: sanitizeText(parsed.data.legalName, 200),
      displayName: sanitizeText(parsed.data.displayName, 100),
      governorate: sanitizeText(parsed.data.governorate, 100),
      licenseNumber: parsed.data.licenseNumber
        ? sanitizeText(parsed.data.licenseNumber, 50)
        : undefined,
      contactPhone: parsed.data.contactPhone
        ? sanitizeText(parsed.data.contactPhone, 20)
        : undefined,
      payoutPreference: parsed.data.payoutPreference,
      kycStatus: profile.kycStatus === "REJECTED" ? "PENDING" : profile.kycStatus,
    },
    include: { kycDocuments: true },
  });

  await prisma.auditEvent.create({
    data: {
      actorId: auth.user.id,
      objectType: "seller_profile",
      objectId: profile.id,
      action: "ONBOARDING_UPDATED",
      after: {
        legalName: updated.legalName,
        governorate: updated.governorate,
        kycStatus: updated.kycStatus,
      },
    },
  });

  return NextResponse.json(updated);
}
