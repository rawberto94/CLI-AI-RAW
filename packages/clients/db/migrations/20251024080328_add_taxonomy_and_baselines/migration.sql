-- CreateEnum
CREATE TYPE "SpendType" AS ENUM ('DIRECT', 'INDIRECT', 'CAPEX', 'OPEX');

-- CreateEnum
CREATE TYPE "BaselineType" AS ENUM ('TARGET_RATE', 'MARKET_BENCHMARK', 'HISTORICAL_BEST', 'COMPETITIVE_BID', 'NEGOTIATED_CAP', 'INDUSTRY_STANDARD', 'REGULATORY_LIMIT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BaselineSource" AS ENUM ('INTERNAL', 'EXTERNAL_PROVIDER', 'COMPETITIVE_BID', 'MARKET_RESEARCH', 'HISTORICAL_DATA', 'INDUSTRY_REPORT', 'MANUAL_ENTRY', 'IMPORTED_FILE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "categoryL1" TEXT,
ADD COLUMN     "categoryL2" TEXT,
ADD COLUMN     "procurementCategoryId" TEXT,
ADD COLUMN     "spendType" TEXT DEFAULT 'INDIRECT';

-- CreateTable
CREATE TABLE "procurement_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryL1" TEXT NOT NULL,
    "categoryL2" TEXT NOT NULL,
    "categoryL3" TEXT,
    "categoryPath" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "isDirectSpend" BOOLEAN NOT NULL DEFAULT false,
    "isIndirectSpend" BOOLEAN NOT NULL DEFAULT true,
    "spendType" "SpendType" NOT NULL DEFAULT 'INDIRECT',
    "enableBenchmarking" BOOLEAN NOT NULL DEFAULT true,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "typicalPricingModel" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiClassificationPrompt" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "procurement_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_card_baselines" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "baselineName" TEXT NOT NULL,
    "baselineType" "BaselineType" NOT NULL,
    "description" TEXT,
    "procurementCategoryId" TEXT,
    "categoryL1" TEXT,
    "categoryL2" TEXT,
    "roleStandardized" TEXT NOT NULL,
    "roleCategory" TEXT,
    "seniority" "SeniorityLevel",
    "lineOfService" TEXT,
    "country" TEXT,
    "region" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "targetRate" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "targetRateUSD" DECIMAL(10,2) NOT NULL,
    "rateUnit" TEXT NOT NULL DEFAULT 'daily',
    "minimumRate" DECIMAL(10,2),
    "maximumRate" DECIMAL(10,2),
    "tolerancePercentage" DECIMAL(5,2),
    "source" "BaselineSource" NOT NULL,
    "sourceDetails" TEXT,
    "importJobId" TEXT,
    "contractId" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "savingsRealized" DECIMAL(15,2),
    "lastAppliedAt" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "rate_card_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline_comparisons" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "comparisonName" TEXT NOT NULL,
    "comparisonDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baselineId" TEXT NOT NULL,
    "rateCardEntryId" TEXT,
    "actualRate" DECIMAL(10,2),
    "actualRateSource" TEXT,
    "variance" DECIMAL(10,2) NOT NULL,
    "variancePercentage" DECIMAL(5,2) NOT NULL,
    "isWithinTolerance" BOOLEAN NOT NULL,
    "potentialSavings" DECIMAL(10,2),
    "annualSavingsImpact" DECIMAL(15,2),
    "volumeImpacted" INTEGER,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "recommendation" TEXT,
    "actionRequired" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "assignedTo" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "baseline_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline_import_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "importType" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" BIGINT,
    "filePath" TEXT,
    "status" "JobStatus" NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalRows" INTEGER,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "successfulRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "importedBaselines" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "warnings" JSONB,
    "summary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "startedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "baseline_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "procurement_categories_tenantId_idx" ON "procurement_categories"("tenantId");

-- CreateIndex
CREATE INDEX "procurement_categories_categoryL1_idx" ON "procurement_categories"("categoryL1");

-- CreateIndex
CREATE INDEX "procurement_categories_categoryL2_idx" ON "procurement_categories"("categoryL2");

-- CreateIndex
CREATE INDEX "procurement_categories_spendType_idx" ON "procurement_categories"("spendType");

-- CreateIndex
CREATE INDEX "procurement_categories_isActive_idx" ON "procurement_categories"("isActive");

-- CreateIndex
CREATE INDEX "procurement_categories_tenantId_categoryL1_categoryL2_idx" ON "procurement_categories"("tenantId", "categoryL1", "categoryL2");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_categories_tenantId_categoryL1_categoryL2_key" ON "procurement_categories"("tenantId", "categoryL1", "categoryL2");

-- CreateIndex
CREATE INDEX "rate_card_baselines_tenantId_idx" ON "rate_card_baselines"("tenantId");

-- CreateIndex
CREATE INDEX "rate_card_baselines_baselineType_idx" ON "rate_card_baselines"("baselineType");

-- CreateIndex
CREATE INDEX "rate_card_baselines_roleStandardized_idx" ON "rate_card_baselines"("roleStandardized");

-- CreateIndex
CREATE INDEX "rate_card_baselines_country_idx" ON "rate_card_baselines"("country");

-- CreateIndex
CREATE INDEX "rate_card_baselines_isActive_idx" ON "rate_card_baselines"("isActive");

-- CreateIndex
CREATE INDEX "rate_card_baselines_effectiveDate_idx" ON "rate_card_baselines"("effectiveDate");

-- CreateIndex
CREATE INDEX "rate_card_baselines_approvalStatus_idx" ON "rate_card_baselines"("approvalStatus");

-- CreateIndex
CREATE INDEX "rate_card_baselines_tenantId_roleStandardized_country_idx" ON "rate_card_baselines"("tenantId", "roleStandardized", "country");

-- CreateIndex
CREATE INDEX "rate_card_baselines_tenantId_categoryL1_categoryL2_idx" ON "rate_card_baselines"("tenantId", "categoryL1", "categoryL2");

-- CreateIndex
CREATE UNIQUE INDEX "rate_card_baselines_tenantId_baselineName_key" ON "rate_card_baselines"("tenantId", "baselineName");

-- CreateIndex
CREATE INDEX "baseline_comparisons_tenantId_idx" ON "baseline_comparisons"("tenantId");

-- CreateIndex
CREATE INDEX "baseline_comparisons_baselineId_idx" ON "baseline_comparisons"("baselineId");

-- CreateIndex
CREATE INDEX "baseline_comparisons_rateCardEntryId_idx" ON "baseline_comparisons"("rateCardEntryId");

-- CreateIndex
CREATE INDEX "baseline_comparisons_status_idx" ON "baseline_comparisons"("status");

-- CreateIndex
CREATE INDEX "baseline_comparisons_comparisonDate_idx" ON "baseline_comparisons"("comparisonDate");

-- CreateIndex
CREATE INDEX "baseline_comparisons_variance_idx" ON "baseline_comparisons"("variance" DESC);

-- CreateIndex
CREATE INDEX "baseline_comparisons_potentialSavings_idx" ON "baseline_comparisons"("potentialSavings" DESC);

-- CreateIndex
CREATE INDEX "baseline_import_jobs_tenantId_idx" ON "baseline_import_jobs"("tenantId");

-- CreateIndex
CREATE INDEX "baseline_import_jobs_status_idx" ON "baseline_import_jobs"("status");

-- CreateIndex
CREATE INDEX "baseline_import_jobs_startedAt_idx" ON "baseline_import_jobs"("startedAt");

-- CreateIndex
CREATE INDEX "Contract_procurementCategoryId_idx" ON "Contract"("procurementCategoryId");

-- CreateIndex
CREATE INDEX "Contract_categoryL1_idx" ON "Contract"("categoryL1");

-- CreateIndex
CREATE INDEX "Contract_categoryL2_idx" ON "Contract"("categoryL2");

-- CreateIndex
CREATE INDEX "Contract_tenantId_categoryL1_categoryL2_idx" ON "Contract"("tenantId", "categoryL1", "categoryL2");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_procurementCategoryId_fkey" FOREIGN KEY ("procurementCategoryId") REFERENCES "procurement_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_card_baselines" ADD CONSTRAINT "rate_card_baselines_procurementCategoryId_fkey" FOREIGN KEY ("procurementCategoryId") REFERENCES "procurement_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_comparisons" ADD CONSTRAINT "baseline_comparisons_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "rate_card_baselines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_comparisons" ADD CONSTRAINT "baseline_comparisons_rateCardEntryId_fkey" FOREIGN KEY ("rateCardEntryId") REFERENCES "rate_card_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
