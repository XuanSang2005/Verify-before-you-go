CREATE TABLE "FoundationMetadata" (
    "id" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "initializedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FoundationMetadata_pkey" PRIMARY KEY ("id")
);
