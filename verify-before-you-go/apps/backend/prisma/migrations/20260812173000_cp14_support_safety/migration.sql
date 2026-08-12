-- AddEnumValue
ALTER TYPE "SupportContactKind" ADD VALUE 'CONSULAR';

-- CreateEnum
CREATE TYPE "SupportLanguageStatus" AS ENUM ('CONFIRMED', 'UNCONFIRMED');

-- AlterTable
ALTER TABLE "SupportContact"
ADD COLUMN "languageStatus" "SupportLanguageStatus" NOT NULL DEFAULT 'UNCONFIRMED';

-- Existing rows used placeholder strings rather than verified language names.
UPDATE "SupportContact"
SET "languages" = ARRAY[]::TEXT[],
    "languageStatus" = 'UNCONFIRMED';
