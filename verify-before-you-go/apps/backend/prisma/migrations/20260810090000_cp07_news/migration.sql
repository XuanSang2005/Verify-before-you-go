-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('HIRING_UPDATE', 'SCAM_WATCH', 'GUIDE', 'MIL_EXPLAINER');

-- CreateEnum
CREATE TYPE "NewsSourceStatus" AS ENUM ('SYNTHETIC_PROTOTYPE', 'SYNTHETIC_SOURCE_LIST');

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "NewsCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "dek" TEXT NOT NULL,
    "eyebrow" TEXT NOT NULL,
    "bodySections" TEXT[],
    "verificationSteps" TEXT[],
    "sourceNotes" TEXT[],
    "sourceStatus" "NewsSourceStatus" NOT NULL,
    "sourceStatusLabel" TEXT NOT NULL,
    "readingMinutes" INTEGER NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_slug_key" ON "NewsArticle"("slug");

-- CreateIndex
CREATE INDEX "NewsArticle_category_publishedAt_idx" ON "NewsArticle"("category", "publishedAt");

-- CreateIndex
CREATE INDEX "NewsArticle_isFeatured_publishedAt_idx" ON "NewsArticle"("isFeatured", "publishedAt");
