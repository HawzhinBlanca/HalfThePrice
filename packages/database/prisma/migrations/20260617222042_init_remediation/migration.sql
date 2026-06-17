-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BUYER', 'SELLER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SellerKycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KycDocumentType" AS ENUM ('TRADE_LICENSE', 'NATIONAL_ID', 'OTHER');

-- CreateEnum
CREATE TYPE "CategoryWhitelistStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'PENDING');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'MANUAL_REVIEW', 'LIVE', 'REJECTED', 'STALE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ListingCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR');

-- CreateEnum
CREATE TYPE "VerificationResult" AS ENUM ('PASS', 'FAIL', 'MANUAL_REVIEW', 'PENDING');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_PROCESSING', 'CONFIRMED', 'CANCELLED', 'FAILED', 'COD_PENDING');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('COD', 'ZAINCASH', 'QICARD', 'FASTPAY');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'BUYER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "governorate" TEXT NOT NULL,
    "kycStatus" "SellerKycStatus" NOT NULL DEFAULT 'PENDING',
    "payoutPreference" TEXT,
    "licenseNumber" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" TEXT NOT NULL,
    "sellerProfileId" TEXT NOT NULL,
    "documentType" "KycDocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "nameKu" TEXT,
    "whitelistStatus" "CategoryWhitelistStatus" NOT NULL DEFAULT 'ACTIVE',
    "retailTtlDays" INTEGER NOT NULL DEFAULT 30,
    "verificationPolicy" TEXT NOT NULL DEFAULT 'STANDARD',
    "matchConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_products" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "gtin" TEXT,
    "mpn" TEXT,
    "normalizedSpecs" JSONB,
    "fingerprintHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canonical_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retail_references" (
    "id" TEXT NOT NULL,
    "canonicalProductId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "observedPriceIqd" INTEGER NOT NULL,
    "nativeCurrency" TEXT NOT NULL DEFAULT 'IQD',
    "nativeAmount" DOUBLE PRECISION NOT NULL,
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "rateTimestamp" TIMESTAMP(3),
    "stockState" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parserVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "evidenceHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retail_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "canonicalProductId" TEXT,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "condition" "ListingCondition" NOT NULL DEFAULT 'GOOD',
    "accessories" TEXT,
    "sellerPriceIqd" INTEGER NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "governorate" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_verification_runs" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "matchConfidence" DOUBLE PRECISION NOT NULL,
    "selectedReferenceId" TEXT,
    "verifiedRetailIqd" INTEGER,
    "computedCapIqd" INTEGER,
    "priceCapRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "matchConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "retailTtlDays" INTEGER NOT NULL DEFAULT 30,
    "parserVersion" TEXT,
    "result" "VerificationResult" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_verification_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "amountIqd" INTEGER NOT NULL,
    "capSnapshotIqd" INTEGER NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amountIqd" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'COD',
    "codEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" "PaymentMethod" NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "sandbox" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_userId_key" ON "seller_profiles"("userId");

-- CreateIndex
CREATE INDEX "kyc_documents_sellerProfileId_idx" ON "kyc_documents"("sellerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "canonical_products_fingerprintHash_key" ON "canonical_products"("fingerprintHash");

-- CreateIndex
CREATE INDEX "canonical_products_brand_model_idx" ON "canonical_products"("brand", "model");

-- CreateIndex
CREATE INDEX "retail_references_canonicalProductId_observedAt_idx" ON "retail_references"("canonicalProductId", "observedAt");

-- CreateIndex
CREATE INDEX "listings_status_governorate_idx" ON "listings"("status", "governorate");

-- CreateIndex
CREATE INDEX "listings_sellerId_idx" ON "listings"("sellerId");

-- CreateIndex
CREATE INDEX "price_verification_runs_listingId_createdAt_idx" ON "price_verification_runs"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "offers_listingId_idx" ON "offers"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_offerId_key" ON "orders"("offerId");

-- CreateIndex
CREATE INDEX "orders_buyerId_idx" ON "orders"("buyerId");

-- CreateIndex
CREATE INDEX "orders_sellerId_idx" ON "orders"("sellerId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_orderId_key" ON "payment_intents"("orderId");

-- CreateIndex
CREATE INDEX "conversations_listingId_idx" ON "conversations"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_listingId_buyerId_sellerId_key" ON "conversations"("listingId", "buyerId", "sellerId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_objectType_objectId_idx" ON "audit_events"("objectType", "objectId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_providerEventId_key" ON "webhook_events"("providerEventId");

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_products" ADD CONSTRAINT "canonical_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_references" ADD CONSTRAINT "retail_references_canonicalProductId_fkey" FOREIGN KEY ("canonicalProductId") REFERENCES "canonical_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_canonicalProductId_fkey" FOREIGN KEY ("canonicalProductId") REFERENCES "canonical_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_verification_runs" ADD CONSTRAINT "price_verification_runs_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_verification_runs" ADD CONSTRAINT "price_verification_runs_selectedReferenceId_fkey" FOREIGN KEY ("selectedReferenceId") REFERENCES "retail_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create Postgres function and trigger to enforce the half-price promise at the DB level
CREATE OR REPLACE FUNCTION check_listing_price_cap()
RETURNS TRIGGER AS $$
DECLARE
    latest_run RECORD;
    ttl_days INTEGER;
    ref_observed_at TIMESTAMP;
BEGIN
    -- Only check if status is set to 'LIVE'
    IF NEW.status = 'LIVE' THEN
        -- Find the latest price verification run for this listing that passed
        SELECT * INTO latest_run
        FROM price_verification_runs
        WHERE "listingId" = NEW.id
          AND result = 'PASS'
        ORDER BY "createdAt" DESC
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Cannot publish listing %: No passing verification run found', NEW.id;
        END IF;

        -- Check if the seller price exceeds the computed cap in that verification run
        IF NEW."sellerPriceIqd" > latest_run."computedCapIqd" THEN
            RAISE EXCEPTION 'Cannot publish listing %: sellerPriceIqd (%) exceeds computedCapIqd (%)',
                NEW.id, NEW."sellerPriceIqd", latest_run."computedCapIqd";
        END IF;

        -- Check if the selected reference is fresher than category.retailTtlDays
        SELECT "retailTtlDays" INTO ttl_days
        FROM categories
        WHERE id = NEW."categoryId";

        IF FOUND THEN
            SELECT "observedAt" INTO ref_observed_at
            FROM retail_references
            WHERE id = latest_run."selectedReferenceId";

            IF FOUND THEN
                IF ref_observed_at < NOW() - (ttl_days * INTERVAL '1 day') THEN
                    RAISE EXCEPTION 'Cannot publish listing %: Selected retail reference is stale', NEW.id;
                END IF;
            ELSE
                RAISE EXCEPTION 'Cannot publish listing %: Selected retail reference not found', NEW.id;
            END IF;
        ELSE
            RAISE EXCEPTION 'Cannot publish listing %: Category not found', NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_listing_price_cap ON listings;

CREATE TRIGGER trg_check_listing_price_cap
BEFORE INSERT OR UPDATE ON listings
FOR EACH ROW
EXECUTE FUNCTION check_listing_price_cap();

