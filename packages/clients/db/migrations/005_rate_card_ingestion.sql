-- Migration: Rate Card Ingestion System
-- Description: Add tables for automated rate card ingestion, mapping, and management
-- Date: 2025-03-10

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Import source types
CREATE TYPE "ImportSource" AS ENUM ('UPLOAD', 'EMAIL', 'API', 'SCHEDULED');

-- Import status types
CREATE TYPE "ImportStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'MAPPING',
  'VALIDATING',
  'COMPLETED',
  'FAILED',
  'REQUIRES_REVIEW'
);

-- Import priority levels
CREATE TYPE "ImportPriority" AS ENUM ('HIGH', 'NORMAL', 'LOW');

-- File types for import
CREATE TYPE "FileTypeImport" AS ENUM ('XLSX', 'XLS', 'CSV', 'PDF', 'JSON');

-- Supplier tiers
CREATE TYPE "SupplierTier" AS ENUM ('BIG_4', 'TIER_2', 'BOUTIQUE', 'OFFSHORE');

-- Rate card status
CREATE TYPE "RateCardStatus" AS ENUM (
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'ARCHIVED'
);

-- Seniority levels
CREATE TYPE "SeniorityLevel" AS ENUM ('JUNIOR', 'MID', 'SENIOR', 'PRINCIPAL', 'PARTNER');

-- Rate periods
CREATE TYPE "RatePeriod" AS ENUM ('HOURLY', 'DAILY', 'MONTHLY', 'ANNUAL');

-- Data quality levels
CREATE TYPE "DataQualityLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Import Jobs table
CREATE TABLE "ImportJob" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "source" "ImportSource" NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "ImportPriority" NOT NULL DEFAULT 'NORMAL',
  
  -- Source information
  "fileName" TEXT,
  "fileSize" BIGINT,
  "fileType" "FileTypeImport" NOT NULL,
  "emailFrom" TEXT,
  "emailSubject" TEXT,
  "apiSource" TEXT,
  "storagePath" TEXT,
  
  -- Processing metadata
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "processedBy" TEXT,
  
  -- Results
  "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
  "rowsSucceeded" INTEGER NOT NULL DEFAULT 0,
  "rowsFailed" INTEGER NOT NULL DEFAULT 0,
  "errors" JSONB NOT NULL DEFAULT '[]',
  "warnings" JSONB NOT NULL DEFAULT '[]',
  
  -- Mapping
  "mappingTemplateId" TEXT,
  "columnMappings" JSONB NOT NULL DEFAULT '[]',
  "mappingConfidence" DECIMAL(3,2) NOT NULL DEFAULT 0,
  
  -- Extracted data
  "extractedData" JSONB NOT NULL,
  "normalizedData" JSONB,
  
  -- Review
  "requiresReview" BOOLEAN NOT NULL DEFAULT false,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT
);

-- Rate Cards table
CREATE TABLE "RateCard" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "importJobId" TEXT NOT NULL,
  
  -- Supplier information
  "supplierId" TEXT NOT NULL,
  "supplierName" TEXT NOT NULL,
  "supplierTier" "SupplierTier" NOT NULL,
  
  -- Contract information
  "contractId" TEXT,
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "expiryDate" TIMESTAMP(3),
  
  -- Currency
  "originalCurrency" TEXT NOT NULL,
  "baseCurrency" TEXT NOT NULL DEFAULT 'CHF',
  "exchangeRate" DECIMAL(10,6),
  "exchangeRateDate" TIMESTAMP(3),
  
  -- Metadata
  "source" TEXT NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "importedBy" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "RateCardStatus" NOT NULL DEFAULT 'DRAFT',
  
  -- Quality metrics
  "dataQuality" JSONB NOT NULL,
  
  CONSTRAINT "RateCard_importJobId_fkey" FOREIGN KEY ("importJobId") 
    REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Role Rates table
CREATE TABLE "RoleRate" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "rateCardId" TEXT NOT NULL,
  
  -- Role identification
  "originalRoleName" TEXT NOT NULL,
  "standardizedRole" TEXT NOT NULL,
  "roleCategory" TEXT NOT NULL,
  "seniorityLevel" "SeniorityLevel" NOT NULL,
  
  -- Service classification
  "serviceLine" TEXT NOT NULL,
  "subCategory" TEXT,
  "skills" JSONB NOT NULL DEFAULT '[]',
  "certifications" JSONB NOT NULL DEFAULT '[]',
  
  -- Geography
  "originalLocation" TEXT NOT NULL,
  "geography" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "city" TEXT,
  
  -- Rate information
  "originalRate" DECIMAL(10,2) NOT NULL,
  "originalPeriod" "RatePeriod" NOT NULL,
  "originalCurrency" TEXT NOT NULL,
  
  -- Normalized rates
  "hourlyRate" DECIMAL(10,2) NOT NULL,
  "dailyRate" DECIMAL(10,2) NOT NULL,
  "monthlyRate" DECIMAL(10,2) NOT NULL,
  "annualRate" DECIMAL(10,2) NOT NULL,
  "baseCurrency" TEXT NOT NULL,
  
  -- Volume discounts
  "volumeDiscounts" JSONB,
  "minimumHours" INTEGER,
  "minimumDays" INTEGER,
  
  -- Quality indicators
  "confidence" DECIMAL(3,2) NOT NULL,
  "dataQuality" "DataQualityLevel" NOT NULL,
  "issues" JSONB NOT NULL DEFAULT '[]',
  "warnings" JSONB NOT NULL DEFAULT '[]',
  
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "RoleRate_rateCardId_fkey" FOREIGN KEY ("rateCardId") 
    REFERENCES "RateCard"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Mapping Templates table
CREATE TABLE "MappingTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  
  "name" TEXT NOT NULL,
  "supplierId" TEXT,
  "supplierName" TEXT,
  "description" TEXT NOT NULL,
  
  -- Template definition
  "mappings" JSONB NOT NULL,
  "requiredFields" JSONB NOT NULL DEFAULT '[]',
  "optionalFields" JSONB NOT NULL DEFAULT '[]',
  
  -- Pattern matching
  "fileNamePattern" TEXT,
  "headerPatterns" JSONB NOT NULL DEFAULT '[]',
  
  -- Usage stats
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "successRate" DECIMAL(3,2) NOT NULL DEFAULT 0,
  "lastUsed" TIMESTAMP(3),
  
  -- Versioning
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "MappingTemplate_tenantId_name_version_key" 
    UNIQUE ("tenantId", "name", "version")
);

-- Add foreign key for mapping template in ImportJob
ALTER TABLE "ImportJob" 
  ADD CONSTRAINT "ImportJob_mappingTemplateId_fkey" 
  FOREIGN KEY ("mappingTemplateId") 
  REFERENCES "MappingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- ImportJob indexes
CREATE INDEX "ImportJob_tenantId_idx" ON "ImportJob"("tenantId");
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");
CREATE INDEX "ImportJob_source_idx" ON "ImportJob"("source");
CREATE INDEX "ImportJob_priority_idx" ON "ImportJob"("priority");
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");
CREATE INDEX "ImportJob_tenantId_status_idx" ON "ImportJob"("tenantId", "status");
CREATE INDEX "ImportJob_tenantId_source_idx" ON "ImportJob"("tenantId", "source");

-- RateCard indexes
CREATE INDEX "RateCard_tenantId_idx" ON "RateCard"("tenantId");
CREATE INDEX "RateCard_supplierId_idx" ON "RateCard"("supplierId");
CREATE INDEX "RateCard_status_idx" ON "RateCard"("status");
CREATE INDEX "RateCard_effectiveDate_idx" ON "RateCard"("effectiveDate");
CREATE INDEX "RateCard_tenantId_supplierId_idx" ON "RateCard"("tenantId", "supplierId");
CREATE INDEX "RateCard_tenantId_status_idx" ON "RateCard"("tenantId", "status");

-- RoleRate indexes
CREATE INDEX "RoleRate_rateCardId_idx" ON "RoleRate"("rateCardId");
CREATE INDEX "RoleRate_standardizedRole_idx" ON "RoleRate"("standardizedRole");
CREATE INDEX "RoleRate_seniorityLevel_idx" ON "RoleRate"("seniorityLevel");
CREATE INDEX "RoleRate_country_idx" ON "RoleRate"("country");
CREATE INDEX "RoleRate_serviceLine_idx" ON "RoleRate"("serviceLine");
CREATE INDEX "RoleRate_rateCardId_standardizedRole_idx" ON "RoleRate"("rateCardId", "standardizedRole");

-- MappingTemplate indexes
CREATE INDEX "MappingTemplate_tenantId_idx" ON "MappingTemplate"("tenantId");
CREATE INDEX "MappingTemplate_supplierId_idx" ON "MappingTemplate"("supplierId");
CREATE INDEX "MappingTemplate_tenantId_supplierId_idx" ON "MappingTemplate"("tenantId", "supplierId");

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger for RoleRate
CREATE OR REPLACE FUNCTION update_role_rate_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER role_rate_updated_at
  BEFORE UPDATE ON "RoleRate"
  FOR EACH ROW
  EXECUTE FUNCTION update_role_rate_updated_at();

-- Update timestamp trigger for MappingTemplate
CREATE OR REPLACE FUNCTION update_mapping_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mapping_template_updated_at
  BEFORE UPDATE ON "MappingTemplate"
  FOR EACH ROW
  EXECUTE FUNCTION update_mapping_template_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE "ImportJob" IS 'Tracks rate card import jobs from various sources';
COMMENT ON TABLE "RateCard" IS 'Stores normalized rate cards from suppliers';
COMMENT ON TABLE "RoleRate" IS 'Individual role rates within rate cards';
COMMENT ON TABLE "MappingTemplate" IS 'Reusable column mapping templates for imports';

COMMENT ON COLUMN "ImportJob"."extractedData" IS 'Raw data extracted from source file';
COMMENT ON COLUMN "ImportJob"."normalizedData" IS 'Normalized and validated rate card data';
COMMENT ON COLUMN "RateCard"."dataQuality" IS 'Quality metrics for the rate card';
COMMENT ON COLUMN "RoleRate"."volumeDiscounts" IS 'Volume-based discount tiers';
COMMENT ON COLUMN "MappingTemplate"."mappings" IS 'Column mapping definitions';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Rate Card Ingestion migration completed successfully';
  RAISE NOTICE 'Tables created: ImportJob, RateCard, RoleRate, MappingTemplate';
  RAISE NOTICE 'Indexes and triggers created for optimal performance';
END $$;
