-- Migration: Rate Card Performance Indexes
-- Adds optimized indexes for rate card benchmarking queries

-- Composite index for benchmark cohort queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_benchmark_cohort 
ON rate_card_entries(tenant_id, role_standardized, seniority, country, daily_rate_usd);

-- Index for supplier filtering and aggregation
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_supplier_lookup 
ON rate_card_entries(tenant_id, supplier_name, daily_rate_usd);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_date_range 
ON rate_card_entries(tenant_id, effective_date DESC);

-- Index for rate range filtering
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_rate_range 
ON rate_card_entries(tenant_id, daily_rate_usd);

-- Index for line of service filtering
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_line_of_service 
ON rate_card_entries(tenant_id, line_of_service, role_standardized);

-- Index for geographic filtering
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_geography 
ON rate_card_entries(tenant_id, country, region);

-- Composite index for market intelligence queries
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_market_intel 
ON rate_card_entries(tenant_id, role_standardized, seniority, effective_date DESC);

-- Index for best rate queries
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_best_rates 
ON rate_card_entries(tenant_id, role_standardized, seniority, country, daily_rate_usd ASC);

-- Index for savings opportunity detection
CREATE INDEX IF NOT EXISTS idx_rate_card_entries_savings_detection 
ON rate_card_entries(tenant_id, daily_rate_usd DESC, role_standardized, seniority, country);

-- Index for supplier benchmarking
CREATE INDEX IF NOT EXISTS idx_rate_card_suppliers_tenant 
ON rate_card_suppliers(tenant_id, name);

-- Index for benchmark snapshots lookup
CREATE INDEX IF NOT EXISTS idx_benchmark_snapshots_entry_lookup 
ON benchmark_snapshots(rate_card_entry_id, calculated_at DESC);

-- Index for benchmark snapshots by tenant
CREATE INDEX IF NOT EXISTS idx_benchmark_snapshots_tenant 
ON benchmark_snapshots(tenant_id, calculated_at DESC);

-- Index for savings opportunities
CREATE INDEX IF NOT EXISTS idx_savings_opportunities_tenant_status 
ON rate_savings_opportunities(tenant_id, status, potential_annual_savings DESC);

-- Index for savings opportunities by entry
CREATE INDEX IF NOT EXISTS idx_savings_opportunities_entry 
ON rate_savings_opportunities(rate_card_entry_id);

-- Index for rate comparisons
CREATE INDEX IF NOT EXISTS idx_rate_comparisons_tenant_user 
ON rate_comparisons(tenant_id, created_by, created_at DESC);

-- Index for baseline comparisons
CREATE INDEX IF NOT EXISTS idx_baseline_comparisons_entry 
ON baseline_comparisons(rate_card_entry_id, comparison_date DESC);

-- Index for baseline comparisons by baseline
CREATE INDEX IF NOT EXISTS idx_baseline_comparisons_baseline 
ON rate_card_baselines(tenant_id, role_standardized, seniority, country);

-- Partial index for active baselines only
CREATE INDEX IF NOT EXISTS idx_rate_card_baselines_active 
ON rate_card_baselines(tenant_id, role_standardized, seniority, country)
WHERE status = 'APPROVED';

-- Index for filter presets
CREATE INDEX IF NOT EXISTS idx_filter_presets_user 
ON rate_card_filter_presets(tenant_id, user_id, created_at DESC);

-- Index for shared filter presets
CREATE INDEX IF NOT EXISTS idx_filter_presets_shared 
ON rate_card_filter_presets(tenant_id, is_shared)
WHERE is_shared = true;

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
  tenant_id,
  role_standardized,
  seniority,
  country,
  COUNT(*) as sample_size,
  AVG(daily_rate_usd) as avg_rate,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY daily_rate_usd) as median_rate,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY daily_rate_usd) as p25_rate,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY daily_rate_usd) as p75_rate,
  MIN(daily_rate_usd) as min_rate,
  MAX(daily_rate_usd) as max_rate,
  STDDEV(daily_rate_usd) as std_dev,
  MAX(effective_date) as last_updated
FROM rate_card_entries
GROUP BY tenant_id, role_standardized, seniority, country
HAVING COUNT(*) >= 3;

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_market_intel_lookup 
ON mv_market_intelligence_summary(tenant_id, role_standardized, seniority, country);

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
