-- CreateEnum
CREATE TYPE "SupportCountry" AS ENUM ('CAMBODIA', 'VIETNAM');

-- CreateEnum
CREATE TYPE "SupportContactKind" AS ENUM ('EMERGENCY', 'EMBASSY', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "SupportAccessMode" AS ENUM ('CELLULAR', 'INTERNET');

-- CreateEnum
CREATE TYPE "SupportDataStatus" AS ENUM ('REVIEWED_REFERENCE', 'SYNTHETIC_SUMMARY');

-- CreateTable
CREATE TABLE "SupportContact" (
    "id" TEXT NOT NULL,
    "country" "SupportCountry" NOT NULL,
    "countryLabel" TEXT NOT NULL,
    "kind" "SupportContactKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "actionUri" TEXT NOT NULL,
    "actionLabel" TEXT NOT NULL,
    "accessMode" "SupportAccessMode" NOT NULL,
    "accessLabel" TEXT NOT NULL,
    "dataStatus" "SupportDataStatus" NOT NULL,
    "dataStatusLabel" TEXT NOT NULL,
    "sourceOwner" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "languages" TEXT[],
    "hours" TEXT NOT NULL,
    "lastReviewedAt" TIMESTAMP(3) NOT NULL,
    "nextReviewAt" TIMESTAMP(3) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportContact_country_isActive_sortOrder_idx" ON "SupportContact"("country", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "SupportContact_nextReviewAt_isActive_idx" ON "SupportContact"("nextReviewAt", "isActive");
