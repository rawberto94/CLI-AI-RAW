-- Migration: Supplier Alert System
-- Description: Creates tables for tracking supplier performance alerts and resolutions
-- Requirements: 4.2

-- Create SupplierAlert table
CREATE TABLE IF NOT EXISTS "SupplierAlert" (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "supplierName" TEXT NOT NULL,
  
  -- Alert Details
  "alertType" TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Metrics
  "currentMetric" DECIMAL(10, 2) NOT NULL,
  "thresholdMetric" DECIMAL(10, 2) NOT NULL,
  deviation DECIMAL(10, 2) NOT NULL,
  
  -- Context
  "affectedRateCards" INTEGER NOT NULL DEFAULT 0,
  "estimatedAnnualImpact" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  
  -- Recommendations
  recommendations JSONB DEFAULT '[]',
  "actionItems" JSONB DEFAULT '[]',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
  "acknowledgedBy" TEXT,
  "acknowledgedAt" TIMESTAMP,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP,
  resolution TEXT,
  
  -- Timestamps
  "detectedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Foreign Keys
  CONSTRAINT "fk_supplier_alert_tenant" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE,
  CONSTRAINT "fk_supplier_alert_supplier" FOREIGN KEY ("supplierId") REFERENCES "RateCardSupplier"(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "idx_supplier_alert_tenant" ON "SupplierAlert"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_supplier_alert_supplier" ON "SupplierAlert"("supplierId");
CREATE INDEX IF NOT EXISTS "idx_supplier_alert_status" ON "SupplierAlert"(status);
CREATE INDEX IF NOT EXISTS "idx_supplier_alert_severity" ON "SupplierAlert"(severity);
CREATE INDEX IF NOT EXISTS "idx_supplier_alert_type" ON "SupplierAlert"("alertType");
CREATE INDEX IF NOT EXISTS "idx_supplier_alert_detected" ON "SupplierAlert"("detectedAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_supplier_alert_tenant_status" ON "SupplierAlert"("tenantId", status);
CREATE INDEX IF NOT EXISTS "idx_supplier_alert_tenant_severity" ON "SupplierAlert"("tenantId", severity);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS "idx_supplier_alert_active_by_severity" 
  ON "SupplierAlert"("tenantId", status, severity DESC, "detectedAt" DESC)
  WHERE status IN ('active', 'acknowledged');

-- Create SupplierScore table (if not exists from previous migration)
CREATE TABLE IF NOT EXISTS "SupplierScore" (
  id TEXT PRIMARY KEY,
  "supplierId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "overallScore" DECIMAL(5, 2) NOT NULL,
  "priceCompetitiveness" DECIMAL(5, 2) NOT NULL,
  "geographicCoverage" DECIMAL(5, 2) NOT NULL,
  "rateStability" DECIMAL(5, 2) NOT NULL,
  "growthTrajectory" DECIMAL(5, 2) NOT NULL,
  ranking INTEGER NOT NULL,
  trend TEXT NOT NULL CHECK (trend IN ('improving', 'declining', 'stable')),
  "calculatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Foreign Keys
  CONSTRAINT "fk_supplier_score_supplier" FOREIGN KEY ("supplierId") REFERENCES "RateCardSupplier"(id) ON DELETE CASCADE,
  CONSTRAINT "fk_supplier_score_tenant" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE
);

-- Create indexes for SupplierScore
CREATE INDEX IF NOT EXISTS "idx_supplier_score_supplier" ON "SupplierScore"("supplierId");
CREATE INDEX IF NOT EXISTS "idx_supplier_score_tenant" ON "SupplierScore"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_supplier_score_calculated" ON "SupplierScore"("calculatedAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_supplier_score_overall" ON "SupplierScore"("overallScore" DESC);
CREATE INDEX IF NOT EXISTS "idx_supplier_score_tenant_overall" ON "SupplierScore"("tenantId", "overallScore" DESC);

-- Add comment to tables
COMMENT ON TABLE "SupplierAlert" IS 'Tracks supplier performance alerts and deteriorating conditions';
COMMENT ON TABLE "SupplierScore" IS 'Stores historical supplier competitiveness scores';

-- Add comments to key columns
COMMENT ON COLUMN "SupplierAlert"."alertType" IS 'Type of alert: ABOVE_MARKET_RATE_INCREASE, DETERIORATING_COMPETITIVENESS, ACCELERATING_RATE_INCREASES, MARKET_POSITION_DECLINE, QUALITY_SCORE_DROP, COVERAGE_REDUCTION';
COMMENT ON COLUMN "SupplierAlert".severity IS 'Alert severity level: low, medium, high, critical';
COMMENT ON COLUMN "SupplierAlert".status IS 'Alert status: active, acknowledged, resolved, dismissed';
COMMENT ON COLUMN "SupplierAlert"."estimatedAnnualImpact" IS 'Estimated annual financial impact in USD';
