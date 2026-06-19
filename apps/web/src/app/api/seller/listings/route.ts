import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@htp/database";
import { requireAuth, requireMutatingAuth, jsonError, withCorrelation } from "@/lib/api";

const createListingSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().max(5000).optional(),
  categoryId: z.string().min(1),
  condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR"]),
  sellerPriceIqd: z.number().int().positive(),
  governorate: z.string().min(2),
  accessories: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export async function GET(request: NextRequest) {
  return withCorrelation(request, async () => {
    const auth = await requireAuth(["SELLER", "ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const listings = await prisma.listing.findMany({
      where: { sellerId: auth.user.id },
      include: {
        category: true,
        verificationRuns: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ data: listings });
  });
}

export async function POST(request: NextRequest) {
  return withCorrelation(request, async () => {
    const auth = await requireMutatingAuth(request, ["SELLER", "ADMIN"]);
    if (auth instanceof NextResponse) return auth;

    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: auth.user.id },
    });

    if (!sellerProfile || sellerProfile.kycStatus !== "APPROVED") {
      return jsonError("Seller onboarding must be approved before creating listings.", 403);
    }

    const body: unknown = await request.json();
    const parsed = createListingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const category = await prisma.category.findUnique({
      where: { id: parsed.data.categoryId },
    });

    if (!category || category.whitelistStatus !== "ACTIVE") {
      return jsonError("Category is not available for listings.");
    }

    const listing = await prisma.listing.create({
      data: {
        sellerId: auth.user.id,
        categoryId: parsed.data.categoryId,
        title: parsed.data.title,
        description: parsed.data.description,
        condition: parsed.data.condition,
        sellerPriceIqd: parsed.data.sellerPriceIqd,
        governorate: parsed.data.governorate,
        accessories: parsed.data.accessories,
        imageUrl: parsed.data.imageUrl,
        status: "DRAFT",
      },
      include: { category: true },
    });

    await prisma.auditEvent.create({
      data: {
        actorId: auth.user.id,
        objectType: "listing",
        objectId: listing.id,
        action: "DRAFT_CREATED",
        after: { title: listing.title, price: listing.sellerPriceIqd },
      },
    });

    return NextResponse.json(listing, { status: 201 });
  });
}
