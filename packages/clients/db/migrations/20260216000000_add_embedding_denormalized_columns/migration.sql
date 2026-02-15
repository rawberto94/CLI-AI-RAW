-- AlterTable: Add denormalized tenantId and contractType to ContractEmbedding
-- These columns enable faster pre-filtering during vector search without JOINs

ALTER TABLE "ContractEmbedding" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "ContractEmbedding" ADD COLUMN IF NOT EXISTS "contractType" TEXT;

-- Backfill from Contract table
UPDATE "ContractEmbedding" ce
SET "tenantId" = c."tenantId",
    "contractType" = c."type"
FROM "Contract" c
WHERE ce."contractId" = c."id"
  AND (ce."tenantId" IS NULL OR ce."contractType" IS NULL);

-- Create indexes for pre-filtering
CREATE INDEX IF NOT EXISTS "ContractEmbedding_tenantId_idx" ON "ContractEmbedding"("tenantId");
CREATE INDEX IF NOT EXISTS "ContractEmbedding_contractType_idx" ON "ContractEmbedding"("contractType");
