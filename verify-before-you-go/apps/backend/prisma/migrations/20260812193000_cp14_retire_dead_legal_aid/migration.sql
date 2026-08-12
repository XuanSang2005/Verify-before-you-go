-- Deployment-safe reconciliation for a previously active directory row whose URL is retired.
UPDATE "SupportContact"
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'support-cambodia-legal-aid';
