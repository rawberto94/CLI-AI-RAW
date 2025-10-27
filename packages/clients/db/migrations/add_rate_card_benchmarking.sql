-- CreateEnum for Rate Card Source
CREATE TYPE "RateCardSource" AS ENUM ('PDF_EXTRACTION', 'MANUAL', 'CSV_UPLOAD', 'API', 'EMAIL');

-- CreateEnum for Savings Category
CREATE TYPE "SavingsCategory" AS ENUM ('RATE_REDUCTION', 'SUPPLIER_SWITCH', 'VOLUME_DISCOUNT', 'TERM_RENEGOTIATION', 'GEOGRAPHIC_ARBITRAGE', 'SKILL_OPTIMIZATION');

-- CreateEnum for Effort Level
CREATE TYPE "EffortLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum for Risk Level  
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum for Opportunity Status
CREATE TYPE "OpportunityStatus" AS ENUM ('IDENTIFIED', 'UNDER_REVIEW', 'APPROVED', 'IN_PROGRESS', 'IMPLEMENTED', 'REJECTED', 'EXPIRED');

-- CreateEnum for Comparison Type
CREATE TYPE "ComparisonType" AS ENUM ('SUPPLIER_VS_SUPPLIER', 'YEAR_OVER_YEAR', 'ROLE_VS_ROLE', 'REGION_VS_REGION', 'CUSTOM');

-- CreateTable: Rate Card Suppliers
CREATE TABLE "rate_card_suppliers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "tier" "SupplierTier" NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "averageRate" DECIMAL(10,2),
    "competitivenessScore" DECIMAL(5,2),
    "reliabilityScore" DECIMAL(5,2),
    "savingsPotential" DECIMAL(10,2),
    "totalContracts" INTEGER NOT NULL DEFAULT 0,
    "totalRateCards" INTEGER NOT NULL DEFAULT 0,
    "activeRates" INTEGER NOT NULL DEFAULT 0,
    "typicalPaymentTerms" TEXT,
    "typicalContractLength" TEXT,
    "volumeDiscounts" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_card_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Rate Card Entries (Enhanced)
CREATE TABLE "rate_card_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" "RateCardSource" NOT NULL,
    "contractId" TEXT,
    "importJobId" TEXT,
    "enteredBy" TEXT,
    "supplierId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierTier" "SupplierTier" NOT NULL,
    "supplierCountry" TEXT NOT NULL,
    "supplierRegion" TEXT NOT NULL,
    "roleOriginal" TEXT NOT NULL,
    "roleStandardized" TEXT NOT NULL,
    "roleCategory" TEXT NOT NULL,
    "seniority" "SeniorityLevel" NOT NULL,
    "lineOfService" TEXT NOT NULL,
    "subCategory" TEXT,
    "dailyRate" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "dailyRateUSD" DECIMAL(10,2) NOT NULL,
    "dailyRateCHF" DECIMAL(10,2) NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "city" TEXT,
    "remoteAllowed" BOOLEAN NOT NULL DEFAULT false,
    "contractType" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "contractValue" DECIMAL(15,2),
    "volumeCommitted" INTEGER,
    "marketRateAverage" DECIMAL(10,2),
    "marketRateMedian" DECIMAL(10,2),
    "marketRateP25" DECIMAL(10,2),
    "marketRateP75" DECIMAL(10,2),
    "marketRateP90" DECIMAL(10,2),
    "percentileRank" INTEGER,
    "savingsAmount" DECIMAL(10,2),
    "savingsPercentage" DECIMAL(5,2),
    "isNegotiated" BOOLEAN NOT NULL DEFAULT false,
    "negotiationNotes" TEXT,
    "confidence" DECIMAL(3,2) NOT NULL,
    "dataQuality" "DataQualityLevel" NOT NULL,
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "additionalInfo" JSONB,
    "skills" JSONB DEFAULT '[]',
    "certifications" JSONB DEFAULT '[]',
    "minimumCommitment" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastBenchmarkedAt" TIMESTAMP(3),

    CONSTRAINT "rate_card_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Benchmark Snapshots
CREATE TABLE "benchmark_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rateCardEntryId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "cohortDefinition" JSONB NOT NULL,
    "cohortSize" INTEGER NOT NULL,
    "average" DECIMAL(10,2) NOT NULL,
    "median" DECIMAL(10,2) NOT NULL,
    "mode" DECIMAL(10,2),
    "standardDeviation" DECIMAL(10,2) NOT NULL,
    "percentile25" DECIMAL(10,2) NOT NULL,
    "percentile50" DECIMAL(10,2) NOT NULL,
    "percentile75" DECIMAL(10,2) NOT NULL,
    "percentile90" DECIMAL(10,2) NOT NULL,
    "percentile95" DECIMAL(10,2) NOT NULL,
    "min" DECIMAL(10,2) NOT NULL,
    "max" DECIMAL(10,2) NOT NULL,
    "positionInMarket" TEXT NOT NULL,
    "percentileRank" INTEGER NOT NULL,
    "potentialSavings" DECIMAL(10,2),
    "savingsToMedian" DECIMAL(10,2),
    "savingsToP25" DECIMAL(10,2),
    "marketTrend" TEXT,
    "trendPercentage" DECIMAL(5,2),
    "competitorCount" INTEGER NOT NULL,
    "competitorAverage" DECIMAL(10,2),

    CONSTRAINT "benchmark_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Market Rate Intelligence
CREATE TABLE "market_rate_intelligence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roleStandardized" TEXT NOT NULL,
    "seniority" "SeniorityLevel" NOT NULL,
    "lineOfService" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "averageRate" DECIMAL(10,2) NOT NULL,
    "medianRate" DECIMAL(10,2) NOT NULL,
    "p25Rate" DECIMAL(10,2) NOT NULL,
    "p75Rate" DECIMAL(10,2) NOT NULL,
    "minRate" DECIMAL(10,2) NOT NULL,
    "maxRate" DECIMAL(10,2) NOT NULL,
    "supplierDistribution" JSONB NOT NULL,
    "topSuppliers" JSONB NOT NULL,
    "trendDirection" TEXT NOT NULL,
    "monthOverMonth" DECIMAL(5,2),
    "yearOverYear" DECIMAL(5,2),
    "insights" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_rate_intelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Rate Savings Opportunities
CREATE TABLE "rate_savings_opportunities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rateCardEntryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "SavingsCategory" NOT NULL,
    "currentAnnualCost" DECIMAL(15,2) NOT NULL,
    "projectedAnnualCost" DECIMAL(15,2) NOT NULL,
    "annualSavings" DECIMAL(15,2) NOT NULL,
    "savingsPercentage" DECIMAL(5,2) NOT NULL,
    "effort" "EffortLevel" NOT NULL,
    "risk" "RiskLevel" NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "alternativeSuppliers" JSONB,
    "negotiationPoints" JSONB,
    "implementationTime" TEXT,
    "expectedRealization" TIMESTAMP(3),
    "status" "OpportunityStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "assignedTo" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "implementedAt" TIMESTAMP(3),
    "actualSavings" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_savings_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Rate Comparisons
CREATE TABLE "rate_comparisons" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "comparisonName" TEXT NOT NULL,
    "comparisonType" "ComparisonType" NOT NULL,
    "createdBy" TEXT NOT NULL,
    "targetRateId" TEXT NOT NULL,
    "comparisonRates" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendations" JSONB,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "sharedWith" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Supplier Benchmarks
CREATE TABLE "supplier_benchmarks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "averageRate" DECIMAL(10,2) NOT NULL,
    "medianRate" DECIMAL(10,2) NOT NULL,
    "marketAverage" DECIMAL(10,2) NOT NULL,
    "competitivenessScore" DECIMAL(5,2) NOT NULL,
    "totalRoles" INTEGER NOT NULL,
    "totalContracts" INTEGER NOT NULL,
    "geographicCoverage" JSONB NOT NULL,
    "serviceLineCoverage" JSONB NOT NULL,
    "dataQualityScore" DECIMAL(5,2) NOT NULL,
    "responseTime" INTEGER,
    "negotiationFlexibility" DECIMAL(3,2),
    "totalAnnualValue" DECIMAL(15,2) NOT NULL,
    "potentialSavings" DECIMAL(15,2) NOT NULL,
    "costRank" INTEGER,
    "qualityRank" INTEGER,
    "overallRank" INTEGER,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_card_suppliers_tenantId_idx" ON "rate_card_suppliers"("tenantId");
CREATE INDEX "rate_card_suppliers_competitivenessScore_idx" ON "rate_card_suppliers"("competitivenessScore");
CREATE UNIQUE INDEX "rate_card_suppliers_tenantId_name_key" ON "rate_card_suppliers"("tenantId", "name");

CREATE INDEX "rate_card_entries_tenantId_idx" ON "rate_card_entries"("tenantId");
CREATE INDEX "rate_card_entries_supplierId_idx" ON "rate_card_entries"("supplierId");
CREATE INDEX "rate_card_entries_roleStandardized_idx" ON "rate_card_entries"("roleStandardized");
CREATE INDEX "rate_card_entries_country_idx" ON "rate_card_entries"("country");
CREATE INDEX "rate_card_entries_lineOfService_idx" ON "rate_card_entries"("lineOfService");
CREATE INDEX "rate_card_entries_seniority_idx" ON "rate_card_entries"("seniority");
CREATE INDEX "rate_card_entries_effectiveDate_idx" ON "rate_card_entries"("effectiveDate");
CREATE INDEX "rate_card_entries_tenantId_roleStandardized_country_idx" ON "rate_card_entries"("tenantId", "roleStandardized", "country");
CREATE INDEX "rate_card_entries_tenantId_supplierId_idx" ON "rate_card_entries"("tenantId", "supplierId");
CREATE INDEX "rate_card_entries_dailyRateUSD_idx" ON "rate_card_entries"("dailyRateUSD");

CREATE INDEX "benchmark_snapshots_tenantId_idx" ON "benchmark_snapshots"("tenantId");
CREATE INDEX "benchmark_snapshots_rateCardEntryId_idx" ON "benchmark_snapshots"("rateCardEntryId");
CREATE INDEX "benchmark_snapshots_snapshotDate_idx" ON "benchmark_snapshots"("snapshotDate");

CREATE INDEX "market_rate_intelligence_tenantId_idx" ON "market_rate_intelligence"("tenantId");
CREATE INDEX "market_rate_intelligence_roleStandardized_idx" ON "market_rate_intelligence"("roleStandardized");
CREATE INDEX "market_rate_intelligence_country_idx" ON "market_rate_intelligence"("country");
CREATE INDEX "market_rate_intelligence_periodStart_idx" ON "market_rate_intelligence"("periodStart");
CREATE UNIQUE INDEX "market_rate_intelligence_tenantId_roleStandardized_seniority_country_periodStart_key" ON "market_rate_intelligence"("tenantId", "roleStandardized", "seniority", "country", "periodStart");

CREATE INDEX "rate_savings_opportunities_tenantId_idx" ON "rate_savings_opportunities"("tenantId");
CREATE INDEX "rate_savings_opportunities_status_idx" ON "rate_savings_opportunities"("status");
CREATE INDEX "rate_savings_opportunities_annualSavings_idx" ON "rate_savings_opportunities"("annualSavings" DESC);

CREATE INDEX "rate_comparisons_tenantId_idx" ON "rate_comparisons"("tenantId");
CREATE INDEX "rate_comparisons_createdBy_idx" ON "rate_comparisons"("createdBy");

CREATE INDEX "supplier_benchmarks_tenantId_idx" ON "supplier_benchmarks"("tenantId");
CREATE INDEX "supplier_benchmarks_supplierId_idx" ON "supplier_benchmarks"("supplierId");
CREATE INDEX "supplier_benchmarks_periodStart_idx" ON "supplier_benchmarks"("periodStart");

-- AddForeignKey
ALTER TABLE "rate_card_entries" ADD CONSTRAINT "rate_card_entries_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "rate_card_entries" ADD CONSTRAINT "rate_card_entries_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "rate_card_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "benchmark_snapshots" ADD CONSTRAINT "benchmark_snapshots_rateCardEntryId_fkey" FOREIGN KEY ("rateCardEntryId") REFERENCES "rate_card_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rate_savings_opportunities" ADD CONSTRAINT "rate_savings_opportunities_rateCardEntryId_fkey" FOREIGN KEY ("rateCardEntryId") REFERENCES "rate_card_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rate_comparisons" ADD CONSTRAINT "rate_comparisons_targetRateId_fkey" FOREIGN KEY ("targetRateId") REFERENCES "rate_card_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_benchmarks" ADD CONSTRAINT "supplier_benchmarks_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "rate_card_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
