-- CreateEnum
CREATE TYPE "RecruitmentReportStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'MORE_EVIDENCE_NEEDED', 'REVIEWED', 'CLOSED', 'INCLUDED_IN_ALERT', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "RecruitmentReportSubjectType" AS ENUM ('JOB_POST', 'RECRUITER', 'COMPANY', 'AGENCY');

-- CreateEnum
CREATE TYPE "RecruitmentReportIdentifierType" AS ENUM ('URL', 'PHONE', 'HANDLE', 'PAYMENT_ACCOUNT', 'CLAIMED_ENTITY');

-- CreateEnum
CREATE TYPE "RecruitmentReportBehaviour" AS ENUM ('IDENTITY_DOCUMENT_REQUEST', 'PAYMENT_REQUEST', 'PRESSURE', 'COMPANY_NOT_FOUND', 'CONTRACT_VISA_MISMATCH', 'TRAVEL_ACCOMMODATION_CONTROL', 'IMPERSONATION');

-- CreateTable
CREATE TABLE "RecruitmentReport" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "status" "RecruitmentReportStatus" NOT NULL DEFAULT 'RECEIVED',
    "subjectType" "RecruitmentReportSubjectType" NOT NULL,
    "identifierType" "RecruitmentReportIdentifierType" NOT NULL,
    "privateIdentifier" TEXT NOT NULL,
    "normalizedIdentifierHash" TEXT,
    "privateDescription" TEXT NOT NULL,
    "publicRedactedIdentifier" TEXT NOT NULL,
    "publicRedactedDescription" TEXT NOT NULL,
    "behaviours" "RecruitmentReportBehaviour"[],
    "allowPrivateMatching" BOOLEAN NOT NULL,
    "allowRedactedPublicAlert" BOOLEAN NOT NULL,
    "shareWithNamedPartner" BOOLEAN NOT NULL,
    "namedPartner" TEXT,
    "idempotencyKeyHash" TEXT NOT NULL,
    "submissionPayloadHash" TEXT NOT NULL,
    "recoveryKeyHash" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentReport_publicId_key" ON "RecruitmentReport"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentReport_idempotencyKeyHash_key" ON "RecruitmentReport"("idempotencyKeyHash");

-- CreateIndex
CREATE INDEX "RecruitmentReport_status_submittedAt_idx" ON "RecruitmentReport"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "RecruitmentReport_normalizedIdentifierHash_idx" ON "RecruitmentReport"("normalizedIdentifierHash");
