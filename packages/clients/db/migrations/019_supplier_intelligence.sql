-- Migration: Add Supplier Intelligence Models
-- Description: Creates supplier_scores table for tracking multi-factor supplier competitiveness
-- Date: 2025-10-29

-- CreateTable: Supplier Scores
CREATE TABLE "supplier_scores" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    
    -- Overall Score
    "overallScore" DECIMAL(5,2) NOT NULL,
    
    -- Multi-Factor Scores
    "priceCompetitiveness" DECIMAL(5,2) NOT NULL,
    "geographicCoverage" DECIMAL(5,2) NOT NULL,
    "rateStability" DECIMAL(5,2) NOT NULL,
    "growthTrajectory" DECIMAL(5,2) NOT NULL,
    
    -- Ranking
    "ranking" INTEGER NOT NULL,
    "totalSuppliers" INTEGER NOT NULL,
    
    -- Trend Analysis
    "trend" TEXT NOT NULL,
    "previousScore" DECIMAL(5,2),
    "scoreChange" DECIMAL(5,2),
    
    -- Calculation Metadata
    "calculationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataPointsUsed" INTEGER NOT NULL,
    "confidenceLevel" DECIMAL(5,2) NOT NULL,
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Supplier and calculation date for historical tracking
CREATE INDEX "supplier_scores_supplierId_calculationDate_idx" ON "supplier_scores"("supplierId", "calculationDate");

-- CreateIndex: Tenant and overall score for rankings
CREATE INDEX "supplier_scores_tenantId_overallScore_idx" ON "supplier_scores"("tenantId", "overallScore");

-- CreateIndex: Tenant and calculation date for time-based queries
CREATE INDEX "supplier_scores_tenantId_calculationDate_idx" ON "supplier_scores"("tenantId", "calculationDate");

-- CreateIndex: Ranking for leaderboard queries
CREATE INDEX "supplier_scores_ranking_idx" ON "supplier_scores"("ranking");

-- AddForeignKey: Link to rate_card_suppliers
ALTER TABLE "supplier_scores" ADD CONSTRAINT "supplier_scores_supplierId_fkey" 
    FOREIGN KEY ("supplierId") REFERENCES "rate_card_suppliers"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Add comment to table
COMMENT ON TABLE "supplier_scores" IS 'Tracks multi-factor competitiveness scores for suppliers over time';

-- Add comments to key columns
COMMENT ON COLUMN "supplier_scores"."overallScore" IS 'Weighted overall competitiveness score (0-100)';
COMMENT ON COLUMN "supplier_scores"."priceCompetitiveness" IS 'Price competitiveness score based on market position (0-100)';
COMMENT ON COLUMN "supplier_scores"."geographicCoverage" IS 'Geographic coverage score based on countries served (0-100)';
COMMENT ON COLUMN "supplier_scores"."rateStability" IS 'Rate stability score based on historical variance (0-100)';
COMMENT ON COLUMN "supplier_scores"."growthTrajectory" IS 'Growth trajectory score based on rate trends (0-100)';
COMMENT ON COLUMN "supplier_scores"."ranking" IS 'Supplier ranking within tenant (1 = best)';
COMMENT ON COLUMN "supplier_scores"."trend" IS 'Score trend: improving, declining, or stable';
