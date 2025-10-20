/*
  Warnings:

  - You are about to drop the column `parties` on the `Contract` table. All the data in the column will be lost.
  - You are about to drop the column `processingStatus` on the `Contract` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('CLIENT', 'SUPPLIER', 'VENDOR', 'PARTNER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('UPLOAD', 'EMAIL', 'API', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'MAPPING', 'VALIDATING', 'COMPLETED', 'FAILED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "ImportPriority" AS ENUM ('HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "FileTypeImport" AS ENUM ('XLSX', 'XLS', 'CSV', 'PDF', 'JSON');

-- CreateEnum
CREATE TYPE "SupplierTier" AS ENUM ('BIG_4', 'TIER_2', 'BOUTIQUE', 'OFFSHORE');

-- CreateEnum
CREATE TYPE "RateCardStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SeniorityLevel" AS ENUM ('JUNIOR', 'MID', 'SENIOR', 'PRINCIPAL', 'PARTNER');

-- CreateEnum
CREATE TYPE "RatePeriod" AS ENUM ('HOURLY', 'DAILY', 'MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "DataQualityLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- DropIndex
DROP INDEX "Contract_processingStatus_idx";

-- AlterTable
ALTER TABLE "Contract" DROP COLUMN "parties",
DROP COLUMN "processingStatus",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "contractTitle" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "keywords" JSONB,
ADD COLUMN     "lastViewedAt" TIMESTAMP(3),
ADD COLUMN     "lastViewedBy" TEXT,
ADD COLUMN     "rawText" TEXT,
ADD COLUMN     "searchableText" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "supplierName" TEXT,
ADD COLUMN     "tags" JSONB DEFAULT '[]',
ADD COLUMN     "textVector" tsvector,
ADD COLUMN     "totalValue" DECIMAL(15,2),
ADD COLUMN     "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'PROCESSING';

-- CreateTable
CREATE TABLE "contract_metadata" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT,
    "tags" TEXT[],
    "systemFields" JSONB NOT NULL DEFAULT '{}',
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "path" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "icon" TEXT NOT NULL DEFAULT 'folder',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taxonomy_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartyType" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractArtifact" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractEmbedding" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkText" TEXT NOT NULL,
    "embedding" vector,
    "chunkType" TEXT,
    "section" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clause" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "riskLevel" TEXT,
    "position" INTEGER,
    "libraryClauseId" TEXT,
    "similarity" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "totalStages" INTEGER NOT NULL DEFAULT 5,
    "error" TEXT,
    "errorStack" TEXT,
    "errorCategory" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "queuePosition" INTEGER,
    "lastCheckpoint" TEXT,
    "checkpointData" JSONB,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "estimatedCompletionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractVersion" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "parentVersionId" TEXT,
    "changes" JSONB,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" "ImportSource" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "ImportPriority" NOT NULL DEFAULT 'NORMAL',
    "fileName" TEXT,
    "fileSize" BIGINT,
    "fileType" "FileTypeImport" NOT NULL,
    "emailFrom" TEXT,
    "emailSubject" TEXT,
    "apiSource" TEXT,
    "storagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
    "rowsSucceeded" INTEGER NOT NULL DEFAULT 0,
    "rowsFailed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "mappingTemplateId" TEXT,
    "columnMappings" JSONB NOT NULL DEFAULT '[]',
    "mappingConfidence" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "extractedData" JSONB NOT NULL,
    "normalizedData" JSONB,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateCard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierTier" "SupplierTier" NOT NULL,
    "contractId" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "originalCurrency" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'CHF',
    "exchangeRate" DECIMAL(10,6),
    "exchangeRateDate" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "RateCardStatus" NOT NULL DEFAULT 'DRAFT',
    "dataQuality" JSONB NOT NULL,

    CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleRate" (
    "id" TEXT NOT NULL,
    "rateCardId" TEXT NOT NULL,
    "originalRoleName" TEXT NOT NULL,
    "standardizedRole" TEXT NOT NULL,
    "roleCategory" TEXT NOT NULL,
    "seniorityLevel" "SeniorityLevel" NOT NULL,
    "serviceLine" TEXT NOT NULL,
    "subCategory" TEXT,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "certifications" JSONB NOT NULL DEFAULT '[]',
    "originalLocation" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "originalRate" DECIMAL(10,2) NOT NULL,
    "originalPeriod" "RatePeriod" NOT NULL,
    "originalCurrency" TEXT NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "dailyRate" DECIMAL(10,2) NOT NULL,
    "monthlyRate" DECIMAL(10,2) NOT NULL,
    "annualRate" DECIMAL(10,2) NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "volumeDiscounts" JSONB,
    "minimumHours" INTEGER,
    "minimumDays" INTEGER,
    "confidence" DECIMAL(3,2) NOT NULL,
    "dataQuality" "DataQualityLevel" NOT NULL,
    "issues" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MappingTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "description" TEXT NOT NULL,
    "mappings" JSONB NOT NULL,
    "requiredFields" JSONB NOT NULL DEFAULT '[]',
    "optionalFields" JSONB NOT NULL DEFAULT '[]',
    "fileNamePattern" TEXT,
    "headerPatterns" JSONB NOT NULL DEFAULT '[]',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MappingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "goals" JSONB NOT NULL DEFAULT '[]',
    "dashboardLayout" JSONB,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "notifications" JSONB NOT NULL DEFAULT '{}',
    "onboardingState" JSONB,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingSkipped" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "helpToursCompleted" JSONB NOT NULL DEFAULT '[]',
    "customSettings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingAnalytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timeSpent" INTEGER,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "details" TEXT,
    "error" TEXT,
    "estimatedTime" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpAnalytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tourId" TEXT,
    "stepId" TEXT,
    "contentId" TEXT,
    "action" TEXT NOT NULL,
    "query" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WidgetAnalytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "widgetType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "duration" INTEGER,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WidgetAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_savings_opportunities" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "potentialSavingsAmount" DECIMAL(15,2) NOT NULL,
    "potentialSavingsCurrency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "potentialSavingsPercentage" DECIMAL(5,2),
    "timeframe" VARCHAR(20),
    "confidence" VARCHAR(20) NOT NULL,
    "effort" VARCHAR(20) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "actionItems" JSONB DEFAULT '[]',
    "implementationTimeline" VARCHAR(100),
    "risks" JSONB DEFAULT '[]',
    "status" VARCHAR(20) NOT NULL DEFAULT 'identified',
    "implementedAt" TIMESTAMP(3),
    "actualSavings" DECIMAL(15,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "cost_savings_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_metadata_contractId_key" ON "contract_metadata"("contractId");

-- CreateIndex
CREATE INDEX "contract_metadata_tenantId_idx" ON "contract_metadata"("tenantId");

-- CreateIndex
CREATE INDEX "contract_metadata_categoryId_idx" ON "contract_metadata"("categoryId");

-- CreateIndex
CREATE INDEX "contract_metadata_tags_idx" ON "contract_metadata"("tags");

-- CreateIndex
CREATE INDEX "taxonomy_categories_tenantId_idx" ON "taxonomy_categories"("tenantId");

-- CreateIndex
CREATE INDEX "taxonomy_categories_parentId_idx" ON "taxonomy_categories"("parentId");

-- CreateIndex
CREATE INDEX "taxonomy_categories_path_idx" ON "taxonomy_categories"("path");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomy_categories_tenantId_name_key" ON "taxonomy_categories"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Party_type_idx" ON "Party"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Party_name_type_key" ON "Party"("name", "type");

-- CreateIndex
CREATE INDEX "ContractArtifact_contractId_idx" ON "ContractArtifact"("contractId");

-- CreateIndex
CREATE INDEX "ContractArtifact_contractId_type_idx" ON "ContractArtifact"("contractId", "type");

-- CreateIndex
CREATE INDEX "ContractArtifact_type_idx" ON "ContractArtifact"("type");

-- CreateIndex
CREATE INDEX "ContractEmbedding_contractId_idx" ON "ContractEmbedding"("contractId");

-- CreateIndex
CREATE INDEX "ContractEmbedding_chunkType_idx" ON "ContractEmbedding"("chunkType");

-- CreateIndex
CREATE UNIQUE INDEX "ContractEmbedding_contractId_chunkIndex_key" ON "ContractEmbedding"("contractId", "chunkIndex");

-- CreateIndex
CREATE INDEX "Clause_contractId_idx" ON "Clause"("contractId");

-- CreateIndex
CREATE INDEX "Clause_contractId_category_idx" ON "Clause"("contractId", "category");

-- CreateIndex
CREATE INDEX "Clause_category_idx" ON "Clause"("category");

-- CreateIndex
CREATE INDEX "Clause_riskLevel_idx" ON "Clause"("riskLevel");

-- CreateIndex
CREATE INDEX "ProcessingJob_contractId_idx" ON "ProcessingJob"("contractId");

-- CreateIndex
CREATE INDEX "ProcessingJob_tenantId_idx" ON "ProcessingJob"("tenantId");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_idx" ON "ProcessingJob"("status");

-- CreateIndex
CREATE INDEX "ProcessingJob_createdAt_idx" ON "ProcessingJob"("createdAt");

-- CreateIndex
CREATE INDEX "ProcessingJob_priority_idx" ON "ProcessingJob"("priority");

-- CreateIndex
CREATE INDEX "ProcessingJob_nextRetryAt_idx" ON "ProcessingJob"("nextRetryAt");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_priority_createdAt_idx" ON "ProcessingJob"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "ContractVersion_contractId_idx" ON "ContractVersion"("contractId");

-- CreateIndex
CREATE INDEX "ContractVersion_isActive_idx" ON "ContractVersion"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ContractVersion_contractId_versionNumber_key" ON "ContractVersion"("contractId", "versionNumber");

-- CreateIndex
CREATE INDEX "ImportJob_tenantId_idx" ON "ImportJob"("tenantId");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportJob_source_idx" ON "ImportJob"("source");

-- CreateIndex
CREATE INDEX "ImportJob_priority_idx" ON "ImportJob"("priority");

-- CreateIndex
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_tenantId_status_idx" ON "ImportJob"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ImportJob_tenantId_source_idx" ON "ImportJob"("tenantId", "source");

-- CreateIndex
CREATE INDEX "RateCard_tenantId_idx" ON "RateCard"("tenantId");

-- CreateIndex
CREATE INDEX "RateCard_supplierId_idx" ON "RateCard"("supplierId");

-- CreateIndex
CREATE INDEX "RateCard_status_idx" ON "RateCard"("status");

-- CreateIndex
CREATE INDEX "RateCard_effectiveDate_idx" ON "RateCard"("effectiveDate");

-- CreateIndex
CREATE INDEX "RateCard_tenantId_supplierId_idx" ON "RateCard"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "RateCard_tenantId_status_idx" ON "RateCard"("tenantId", "status");

-- CreateIndex
CREATE INDEX "RoleRate_rateCardId_idx" ON "RoleRate"("rateCardId");

-- CreateIndex
CREATE INDEX "RoleRate_standardizedRole_idx" ON "RoleRate"("standardizedRole");

-- CreateIndex
CREATE INDEX "RoleRate_seniorityLevel_idx" ON "RoleRate"("seniorityLevel");

-- CreateIndex
CREATE INDEX "RoleRate_country_idx" ON "RoleRate"("country");

-- CreateIndex
CREATE INDEX "RoleRate_serviceLine_idx" ON "RoleRate"("serviceLine");

-- CreateIndex
CREATE INDEX "RoleRate_rateCardId_standardizedRole_idx" ON "RoleRate"("rateCardId", "standardizedRole");

-- CreateIndex
CREATE INDEX "MappingTemplate_tenantId_idx" ON "MappingTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "MappingTemplate_supplierId_idx" ON "MappingTemplate"("supplierId");

-- CreateIndex
CREATE INDEX "MappingTemplate_tenantId_supplierId_idx" ON "MappingTemplate"("tenantId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "MappingTemplate_tenantId_name_version_key" ON "MappingTemplate"("tenantId", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE INDEX "UserPreferences_userId_idx" ON "UserPreferences"("userId");

-- CreateIndex
CREATE INDEX "OnboardingAnalytics_userId_idx" ON "OnboardingAnalytics"("userId");

-- CreateIndex
CREATE INDEX "OnboardingAnalytics_stepId_idx" ON "OnboardingAnalytics"("stepId");

-- CreateIndex
CREATE INDEX "OnboardingAnalytics_timestamp_idx" ON "OnboardingAnalytics"("timestamp");

-- CreateIndex
CREATE INDEX "ProgressEvent_jobId_idx" ON "ProgressEvent"("jobId");

-- CreateIndex
CREATE INDEX "ProgressEvent_jobId_timestamp_idx" ON "ProgressEvent"("jobId", "timestamp");

-- CreateIndex
CREATE INDEX "BackgroundJob_userId_idx" ON "BackgroundJob"("userId");

-- CreateIndex
CREATE INDEX "BackgroundJob_status_idx" ON "BackgroundJob"("status");

-- CreateIndex
CREATE INDEX "BackgroundJob_userId_status_idx" ON "BackgroundJob"("userId", "status");

-- CreateIndex
CREATE INDEX "HelpAnalytics_userId_idx" ON "HelpAnalytics"("userId");

-- CreateIndex
CREATE INDEX "HelpAnalytics_tourId_idx" ON "HelpAnalytics"("tourId");

-- CreateIndex
CREATE INDEX "HelpAnalytics_action_idx" ON "HelpAnalytics"("action");

-- CreateIndex
CREATE INDEX "HelpAnalytics_timestamp_idx" ON "HelpAnalytics"("timestamp");

-- CreateIndex
CREATE INDEX "WidgetAnalytics_userId_idx" ON "WidgetAnalytics"("userId");

-- CreateIndex
CREATE INDEX "WidgetAnalytics_widgetType_idx" ON "WidgetAnalytics"("widgetType");

-- CreateIndex
CREATE INDEX "WidgetAnalytics_timestamp_idx" ON "WidgetAnalytics"("timestamp");

-- CreateIndex
CREATE INDEX "cost_savings_opportunities_contractId_idx" ON "cost_savings_opportunities"("contractId");

-- CreateIndex
CREATE INDEX "cost_savings_opportunities_tenantId_idx" ON "cost_savings_opportunities"("tenantId");

-- CreateIndex
CREATE INDEX "cost_savings_opportunities_status_idx" ON "cost_savings_opportunities"("status");

-- CreateIndex
CREATE INDEX "cost_savings_opportunities_category_idx" ON "cost_savings_opportunities"("category");

-- CreateIndex
CREATE INDEX "cost_savings_opportunities_confidence_idx" ON "cost_savings_opportunities"("confidence");

-- CreateIndex
CREATE INDEX "cost_savings_opportunities_potentialSavingsAmount_idx" ON "cost_savings_opportunities"("potentialSavingsAmount" DESC);

-- CreateIndex
CREATE INDEX "cost_savings_opportunities_tenantId_status_idx" ON "cost_savings_opportunities"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Contract_startDate_endDate_idx" ON "Contract"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Contract_clientId_idx" ON "Contract"("clientId");

-- CreateIndex
CREATE INDEX "Contract_supplierId_idx" ON "Contract"("supplierId");

-- CreateIndex
CREATE INDEX "Contract_clientName_idx" ON "Contract"("clientName");

-- CreateIndex
CREATE INDEX "Contract_supplierName_idx" ON "Contract"("supplierName");

-- CreateIndex
CREATE INDEX "Contract_category_idx" ON "Contract"("category");

-- CreateIndex
CREATE INDEX "Contract_tenantId_clientName_idx" ON "Contract"("tenantId", "clientName");

-- CreateIndex
CREATE INDEX "Contract_tenantId_supplierName_idx" ON "Contract"("tenantId", "supplierName");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_metadata" ADD CONSTRAINT "contract_metadata_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomy_categories" ADD CONSTRAINT "taxonomy_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "taxonomy_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractArtifact" ADD CONSTRAINT "ContractArtifact_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractEmbedding" ADD CONSTRAINT "ContractEmbedding_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clause" ADD CONSTRAINT "Clause_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJob" ADD CONSTRAINT "ProcessingJob_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_mappingTemplateId_fkey" FOREIGN KEY ("mappingTemplateId") REFERENCES "MappingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleRate" ADD CONSTRAINT "RoleRate_rateCardId_fkey" FOREIGN KEY ("rateCardId") REFERENCES "RateCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingAnalytics" ADD CONSTRAINT "OnboardingAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelpAnalytics" ADD CONSTRAINT "HelpAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WidgetAnalytics" ADD CONSTRAINT "WidgetAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_savings_opportunities" ADD CONSTRAINT "cost_savings_opportunities_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
