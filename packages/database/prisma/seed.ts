import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { hashEvidence } from "../src/verification";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding HalfThePrice database...");

  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.paymentIntent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.kycDocument.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.priceVerificationRun.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.retailReference.deleteMany();
  await prisma.canonicalProduct.deleteMany();
  await prisma.category.deleteMany();
  await prisma.sellerProfile.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@half-the-price.iq",
      passwordHash,
      name: "Admin User",
      role: "ADMIN",
      phone: "+9647700000001",
    },
  });

  const seller = await prisma.user.create({
    data: {
      email: "seller@half-the-price.iq",
      passwordHash,
      name: "Ahmed Al-Rashid",
      role: "SELLER",
      phone: "+9647700000002",
      sellerProfile: {
        create: {
          legalName: "Ahmed Al-Rashid Trading",
          displayName: "Ahmed Tech",
          governorate: "Baghdad",
          kycStatus: "APPROVED",
        },
      },
    },
    include: { sellerProfile: true },
  });

  const buyer = await prisma.user.create({
    data: {
      email: "buyer@half-the-price.iq",
      passwordHash,
      name: "Sara Mohammed",
      role: "BUYER",
      phone: "+9647700000003",
    },
  });

  const pendingSeller = await prisma.user.create({
    data: {
      email: "pending-seller@half-the-price.iq",
      passwordHash,
      name: "Kareem Hassan",
      role: "SELLER",
      phone: "+9647700000004",
      sellerProfile: {
        create: {
          legalName: "Kareem Hassan Trading",
          displayName: "Kareem Shop",
          governorate: "Erbil",
          kycStatus: "PENDING",
        },
      },
    },
    include: { sellerProfile: true },
  });

  void pendingSeller;

  const categories = await Promise.all([
    prisma.category.create({
      data: {
        slug: "phones",
        nameEn: "Phones",
        nameAr: "هواتف",
        nameKu: "مۆبایل",
        whitelistStatus: "ACTIVE",
        retailTtlDays: 30,
        matchConfidenceThreshold: 0.75,
      },
    }),
    prisma.category.create({
      data: {
        slug: "laptops",
        nameEn: "Laptops",
        nameAr: "حاسبات محمولة",
        nameKu: "لاپتۆپ",
        whitelistStatus: "ACTIVE",
        retailTtlDays: 30,
        matchConfidenceThreshold: 0.8,
      },
    }),
    prisma.category.create({
      data: {
        slug: "consoles",
        nameEn: "Gaming Consoles",
        nameAr: "أجهزة ألعاب",
        nameKu: "کۆنسۆڵ",
        whitelistStatus: "ACTIVE",
        retailTtlDays: 45,
        matchConfidenceThreshold: 0.85,
      },
    }),
  ]);

  const [phones, laptops, consoles] = categories;

  if (!phones || !laptops || !consoles || !seller.sellerProfile) {
    throw new Error("Failed to create seed categories or seller profile");
  }

  const products = await Promise.all([
    prisma.canonicalProduct.create({
      data: {
        categoryId: phones.id,
        brand: "Samsung",
        model: "Galaxy S24 Ultra 256GB",
        gtin: "8806095041234",
        fingerprintHash: "samsung-galaxy-s24-ultra-256",
        normalizedSpecs: { storage: "256GB", ram: "12GB" },
      },
    }),
    prisma.canonicalProduct.create({
      data: {
        categoryId: laptops.id,
        brand: "Apple",
        model: "MacBook Air M3 13-inch 256GB",
        gtin: "194253000000",
        fingerprintHash: "apple-macbook-air-m3-13-256",
        normalizedSpecs: { storage: "256GB", chip: "M3" },
      },
    }),
    prisma.canonicalProduct.create({
      data: {
        categoryId: consoles.id,
        brand: "Sony",
        model: "PlayStation 5 Slim",
        gtin: "711719576000",
        fingerprintHash: "sony-ps5-slim",
        normalizedSpecs: { edition: "Slim", storage: "1TB" },
      },
    }),
  ]);

  const [samsung, macbook, ps5] = products;

  if (!samsung || !macbook || !ps5) {
    throw new Error("Failed to create canonical products");
  }

  const now = new Date();
  const refs = await Promise.all([
    prisma.retailReference.create({
      data: {
        canonicalProductId: samsung.id,
        sourceName: "Elryan",
        sourceUrl: "https://elryan.com/samsung-galaxy-s24-ultra",
        observedPriceIqd: 1_850_000,
        observedAt: now,
        evidenceHash: hashEvidence("https://elryan.com/samsung-galaxy-s24-ultra", 1_850_000, now),
      },
    }),
    prisma.retailReference.create({
      data: {
        canonicalProductId: samsung.id,
        sourceName: "Miswag",
        sourceUrl: "https://miswag.com/samsung-s24-ultra",
        observedPriceIqd: 1_920_000,
        observedAt: now,
        evidenceHash: hashEvidence("https://miswag.com/samsung-s24-ultra", 1_920_000, now),
      },
    }),
    prisma.retailReference.create({
      data: {
        canonicalProductId: macbook.id,
        sourceName: "iCenter Iraq",
        sourceUrl: "https://icenter-iraq.com/macbook-air-m3",
        observedPriceIqd: 2_400_000,
        observedAt: now,
        evidenceHash: hashEvidence("https://icenter-iraq.com/macbook-air-m3", 2_400_000, now),
      },
    }),
    prisma.retailReference.create({
      data: {
        canonicalProductId: ps5.id,
        sourceName: "Alhafidh",
        sourceUrl: "https://alhafidh.com/ps5-slim",
        observedPriceIqd: 980_000,
        observedAt: now,
        evidenceHash: hashEvidence("https://alhafidh.com/ps5-slim", 980_000, now),
      },
    }),
  ]);

  const liveListings = await Promise.all([
    prisma.listing.create({
      data: {
        sellerId: seller.id,
        canonicalProductId: samsung.id,
        categoryId: phones.id,
        title: "Samsung Galaxy S24 Ultra 256GB - Like New",
        description: "Excellent condition, includes original box and charger. Minor scratch on back.",
        condition: "LIKE_NEW",
        sellerPriceIqd: 900_000,
        status: "LIVE",
        governorate: "Baghdad",
        imageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800&q=80",
        publishedAt: now,
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: seller.id,
        canonicalProductId: macbook.id,
        categoryId: laptops.id,
        title: "Apple MacBook Air M3 13-inch 256GB",
        description: "Purchased 6 months ago, AppleCare until 2026. Perfect condition.",
        condition: "LIKE_NEW",
        sellerPriceIqd: 1_150_000,
        status: "LIVE",
        governorate: "Erbil",
        imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80",
        publishedAt: now,
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: seller.id,
        canonicalProductId: ps5.id,
        categoryId: consoles.id,
        title: "Sony PlayStation 5 Slim - With 2 Controllers",
        description: "Used for 3 months, includes extra DualSense controller.",
        condition: "GOOD",
        sellerPriceIqd: 480_000,
        status: "LIVE",
        governorate: "Basra",
        imageUrl: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&q=80",
        publishedAt: now,
      },
    }),
  ]);

  for (const listing of liveListings) {
    const product = products.find((p) => p.id === listing.canonicalProductId);
    const productRefs = refs.filter((r) => r.canonicalProductId === listing.canonicalProductId);
    const ref = productRefs[0];
    if (!product || !ref) continue;

    const retailPrices = productRefs.map((r) => r.observedPriceIqd);
    const medianRetail = retailPrices.sort((a, b) => a - b)[Math.floor(retailPrices.length / 2)] ?? ref.observedPriceIqd;

    await prisma.priceVerificationRun.create({
      data: {
        listingId: listing.id,
        matchConfidence: 0.95,
        selectedReferenceId: ref.id,
        verifiedRetailIqd: medianRetail,
        computedCapIqd: Math.floor(medianRetail * 0.5),
        result: "PASS",
        message: "Listing passes price verification.",
      },
    });
  }

  const draftListing = await prisma.listing.create({
    data: {
      sellerId: seller.id,
      categoryId: phones.id,
      title: "Samsung Galaxy S24 Ultra 256GB - Draft",
      description: "Draft listing awaiting submission.",
      condition: "GOOD",
      sellerPriceIqd: 850_000,
      status: "DRAFT",
      governorate: "Baghdad",
    },
  });

  const manualReviewListing = await prisma.listing.create({
    data: {
      sellerId: seller.id,
      canonicalProductId: samsung.id,
      categoryId: phones.id,
      title: "Samsung Galaxy S24 Ultra 256GB - Needs Review",
      description: "Listing with borderline match confidence for admin testing.",
      condition: "GOOD",
      sellerPriceIqd: 880_000,
      status: "MANUAL_REVIEW",
      governorate: "Baghdad",
    },
  });

  await prisma.priceVerificationRun.create({
    data: {
      listingId: manualReviewListing.id,
      matchConfidence: 0.72,
      verifiedRetailIqd: null,
      computedCapIqd: null,
      result: "MANUAL_REVIEW",
      message: "Match confidence 72% below threshold. Sent to manual review.",
    },
  });

  void draftListing;

  await prisma.auditEvent.create({
    data: {
      actorId: admin.id,
      objectType: "system",
      objectId: "seed",
      action: "SEED_COMPLETE",
      after: { users: 4, listings: 5, products: 3 },
    },
  });

  console.log("Seed complete.");
  console.log("Demo accounts (password: password123):");
  console.log("  Admin:  admin@half-the-price.iq");
  console.log("  Seller: seller@half-the-price.iq");
  console.log("  Buyer:  buyer@half-the-price.iq");
  console.log("  Pending seller: pending-seller@half-the-price.iq");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
