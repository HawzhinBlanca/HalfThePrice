-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "expire_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);
