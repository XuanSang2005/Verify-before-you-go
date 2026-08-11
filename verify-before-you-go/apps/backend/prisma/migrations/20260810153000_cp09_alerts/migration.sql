-- CreateEnum
CREATE TYPE "AlertLocation" AS ENUM ('CAMBODIA', 'VIETNAM', 'REGIONAL');

-- CreateEnum
CREATE TYPE "AlertCategory" AS ENUM ('IDENTITY_DOCUMENT', 'OFF_PLATFORM_CONTACT', 'LICENCE_CLAIM', 'UPFRONT_PAYMENT');

-- CreateEnum
CREATE TYPE "AlertModerationStatus" AS ENUM ('CORROBORATED_PATTERN', 'OFFICIAL_SOURCE_MISMATCH', 'REVIEWED_PATTERN');

-- CreateTable
CREATE TABLE "CommunityAlert" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" "AlertLocation" NOT NULL,
    "locationLabel" TEXT NOT NULL,
    "category" "AlertCategory" NOT NULL,
    "categoryLabel" TEXT NOT NULL,
    "moderationStatus" "AlertModerationStatus" NOT NULL,
    "moderationStatusLabel" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "compatibleReportCount" INTEGER NOT NULL,
    "maskedIdentifiers" TEXT[],
    "observedEvidence" TEXT[],
    "unknownInformation" TEXT[],
    "verificationSteps" TEXT[],
    "sourceNotes" TEXT[],
    "firstReportedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityAlert_location_reviewedAt_idx" ON "CommunityAlert"("location", "reviewedAt");

-- CreateIndex
CREATE INDEX "CommunityAlert_category_reviewedAt_idx" ON "CommunityAlert"("category", "reviewedAt");

-- CreateIndex
CREATE INDEX "CommunityAlert_moderationStatus_reviewedAt_idx" ON "CommunityAlert"("moderationStatus", "reviewedAt");
