-- Migration: Rate Card Performance Indexes (Fixed for Prisma camelCase)
-- Adds optimized indexes for rate card benchmarking queries

-- Composite index for benchmark cohort queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_benchmark_cohort 
ON rate_card_entries("tenantId", "roleStandardized", seniority, country, "dailyRateUSD");

-- Index for supplier filtering and aggregation
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_supplier_lookup 
ON rate_card_entries("tenantId", "supplierName", "dailyRateUSD");

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_date_range 
ON rate_card_entries("tenantId", "effectiveDate" DESC);

-- Index for rate range filtering
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_rate_range 
ON rate_card_entries("tenantId", "dailyRateUSD");

-- Index for line of service filtering
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_line_of_service 
ON rate_card_entries("tenantId", "lineOfService", "roleStandardized");

-- Index for geographic filtering
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_geography 
ON rate_card_entries("tenantId", country, region);

-- Composite index for market intelligence queries
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_market_intel 
ON rate_card_entries("tenantId", "roleStandardized", seniority, "effectiveDate" DESC);

-- Index for best rate queries
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_best_rates 
ON rate_card_entries("tenantId", "roleStandardized", seniority, country, "dailyRateUSD" ASC);

-- Index for savings opportunity detection
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_savings_detection 
ON rate_card_entries("tenantId", "dailyRateUSD" DESC, "roleStandardized", seniority, country);

-- Index for supplier benchmarking
CREATE INDEX IF NOT EXISTS idx_rate_card_suppliers_tenant 
ON rate_card_suppliers("tenantId", name);

-- Index for benchmark snapshots lookup
CREATE INDEX IF NOT EXISTS idx_benchmark_snapshots_entry_lookup 
ON benchmark_snapshots("rateCardEntryId", "snapshotDate" DESC);

-- Index for benchmark snapshots by tenant
CREATE INDEX IF NOT EXISTS idx_benchmark_snapshots_tenant 
ON benchmark_snapshots("tenantId", "snapshotDate" DESC);

-- Index for savings opportunities
CREATE INDEX IF NOT EXISTS idx_savings_opportunities_tenant_status 
ON rate_savings_opportunities("tenantId", status, "annualSavingsPotential" DESC);

-- Index for savings opportunities by entry
CREATE INDEX IF NOT EXISTS idx_savings_opportunities_entry 
ON rate_savings_opportunities("rateCardEntryId");

-- Index for rate comparisons
CREATE INDEX IF NOT EXISTS idx_rate_comparisons_tenant_user 
ON rate_comparisons("tenantId", "createdBy", "createdAt" DESC);

-- Index for baseline comparisons by entry
CREATE INDEX IF NOT EXISTS idx_baseline_comparisons_entry 
ON baseline_comparisons("rateCardEntryId", "comparisonDate" DESC);

-- Index for baselines lookup
CREATE INDEX IF NOT EXISTS idx_rate_card_baselines_lookup 
ON rate_card_baselines("tenantId", "roleStandardized", seniority, country);

-- Partial index for active baselines only
CREATE INDEX IF NOT EXISTS idx_rate_card_baselines_active 
ON rate_card_baselines("tenantId", "roleStandardized", seniority, country)
WHERE "approvalStatus" = 'APPROVED';

-- Add statistics for better query planning
ANALYZE rate_card_entries;
ANALYZE rate_card_suppliers;
ANALYZE benchmark_snapshots;
ANALYZE rate_savings_opportunities;
ANALYZE rate_comparisons;
ANALYZE rate_card_baselines;
ANALYZE baseline_comparisons;

-- Create materialized view for frequently accessed market intelligence
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_market_intelligence_summary AS
SELECT 
  "tenantId",
  "roleStandardized",
  seniority,
  country,
  COUNT(*) as sample_size,
  AVG("dailyRateUSD") as avg_rate,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "dailyRateUSD") as median_rate,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "dailyRateUSD") as p25_rate,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "dailyRateUSD") as p75_rate,
  MIN("dailyRateUSD") as min_rate,
  MAX("dailyRateUSD") as max_rate,
  STDDEV("dailyRateUSD") as std_dev,
  MAX("effectiveDate") as last_updated
FROM rate_card_entries
GROUP BY "tenantId", "roleStandardized", seniority, country
HAVING COUNT(*) >= 3;

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_market_intel_lookup 
ON mv_market_intelligence_summary("tenantId", "roleStandardized", seniority, country);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_market_intelligence_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_market_intelligence_summary;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON INDEX idx_rate_card_entries_benchmark_cohort IS 'Optimizes benchmark cohort queries - most frequently used';
COMMENT ON INDEX idx_rate_card_entries_supplier_lookup IS 'Optimizes supplier filtering and aggregation queries';
COMMENT ON INDEX idx_rate_card_entries_best_rates IS 'Optimizes best rate lookup queries';
COMMENT ON MATERIALIZED VIEW mv_market_intelligence_summary IS 'Cached market intelligence statistics for faster dashboard loading';
