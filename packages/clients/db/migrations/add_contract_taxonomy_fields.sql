-- Contract Taxonomy Migration
-- Adds new fields for taxonomy-based contract classification

-- Add new taxonomy classification fields to Contract table
ALTER TABLE "Contract" 
  ADD COLUMN IF NOT EXISTS "contractCategoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "contractSubtype" TEXT,
  ADD COLUMN IF NOT EXISTS "documentRole" TEXT,
  ADD COLUMN IF NOT EXISTS "classificationConf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "classificationMeta" JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "classifiedAt" TIMESTAMP(3);

-- Add taxonomy tag dimensions
ALTER TABLE "Contract"
  ADD COLUMN IF NOT EXISTS "pricingModels" JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "deliveryModels" JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "dataProfiles" JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "riskFlags" JSONB DEFAULT '[]';

-- Create indexes for taxonomy fields
CREATE INDEX IF NOT EXISTS "Contract_contractCategoryId_idx" ON "Contract"("contractCategoryId");
CREATE INDEX IF NOT EXISTS "Contract_documentRole_idx" ON "Contract"("documentRole");
CREATE INDEX IF NOT EXISTS "Contract_tenantId_contractCategoryId_idx" ON "Contract"("tenantId", "contractCategoryId");
CREATE INDEX IF NOT EXISTS "Contract_tenantId_documentRole_idx" ON "Contract"("tenantId", "documentRole");
CREATE INDEX IF NOT EXISTS "Contract_tenantId_contractCategoryId_createdAt_idx" ON "Contract"("tenantId", "contractCategoryId", "createdAt" DESC);

-- Create GIN indexes for JSON array searches (tag dimensions)
CREATE INDEX IF NOT EXISTS "Contract_pricingModels_idx" ON "Contract" USING GIN ("pricingModels");
CREATE INDEX IF NOT EXISTS "Contract_deliveryModels_idx" ON "Contract" USING GIN ("deliveryModels");
CREATE INDEX IF NOT EXISTS "Contract_dataProfiles_idx" ON "Contract" USING GIN ("dataProfiles");
CREATE INDEX IF NOT EXISTS "Contract_riskFlags_idx" ON "Contract" USING GIN ("riskFlags");

-- Add comment to contractType to mark as legacy
COMMENT ON COLUMN "Contract"."contractType" IS 'LEGACY: Use contractCategoryId instead. Kept for backward compatibility.';

-- Add comments for new fields
COMMENT ON COLUMN "Contract"."contractCategoryId" IS 'Contract category from taxonomy (e.g., master_framework, scope_work_authorization)';
COMMENT ON COLUMN "Contract"."contractSubtype" IS 'Specific subtype from taxonomy (e.g., Master Services Agreement, Statement of Work)';
COMMENT ON COLUMN "Contract"."documentRole" IS 'Document role from taxonomy (e.g., governing_agreement, execution_document)';
COMMENT ON COLUMN "Contract"."classificationConf" IS 'Classification confidence score (0.0 to 1.0)';
COMMENT ON COLUMN "Contract"."classificationMeta" IS 'Full classification metadata including alternatives and reasoning';
COMMENT ON COLUMN "Contract"."pricingModels" IS 'Pricing model tags (e.g., ["fixed_fee", "subscription"])';
COMMENT ON COLUMN "Contract"."deliveryModels" IS 'Delivery model tags (e.g., ["consulting", "managed_services"])';
COMMENT ON COLUMN "Contract"."dataProfiles" IS 'Data profile tags (e.g., ["personal_data", "cross_border_transfer"])';
COMMENT ON COLUMN "Contract"."riskFlags" IS 'Risk flag tags (e.g., ["auto_renewal", "uncapped_liability"])';
