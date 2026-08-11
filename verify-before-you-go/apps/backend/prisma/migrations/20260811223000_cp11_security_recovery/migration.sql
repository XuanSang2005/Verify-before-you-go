ALTER TABLE "RecruitmentReport"
  ALTER COLUMN "publicRedactedIdentifier" DROP NOT NULL,
  ALTER COLUMN "publicRedactedDescription" DROP NOT NULL,
  ADD COLUMN "recoveryKeyDeliveryCiphertext" TEXT,
  ADD COLUMN "recoveryKeyDeliverUntil" TIMESTAMP(3);

UPDATE "RecruitmentReport"
SET
  "publicRedactedIdentifier" = NULL,
  "publicRedactedDescription" = NULL
WHERE "allowRedactedPublicAlert" = false;
