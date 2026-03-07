-- Performance Optimization Migration
-- Adds indexes, materialized views, and performance enhancements for artifact storage

-- Create optimized indexes for contract queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_tenant_status 
ON contracts (tenant_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_created_at 
ON contracts (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_total_value 
ON contracts (total_value) WHERE total_value IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_effective_date 
ON contracts (effective_date) WHERE effective_date IS NOT NULL;

-- Create optimized indexes for artifact queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artifacts_contract_type 
ON artifacts (contract_id, type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artifacts_tenant_created 
ON artifacts (tenant_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artifacts_confidence_score 
ON artifacts (confidence_score) WHERE confidence_score IS NOT NULL;

-- Create GIN index for full-text search on artifacts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artifacts_search_content 
ON artifacts USING gin(to_tsvector('english', searchable_content)) 
WHERE searchable_content IS NOT NULL;

-- Create composite index for artifact search by type and tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artifacts_tenant_type_created 
ON artifacts (tenant_id, type, created_at DESC);

-- Create indexes for contract relationships
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contract_relationships_source 
ON contract_relationships (source_contract_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contract_relationships_target 
ON contract_relationships (target_contract_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contract_relationships_type_strength 
ON contract_relationships (relationship_type, strength DESC);

-- Create indexes for contract patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contract_patterns_tenant_type 
ON contract_patterns (tenant_id, pattern_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contract_patterns_frequency 
ON contract_patterns (frequency DESC);

-- Create indexes for portfolio insights
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_insights_tenant_category 
ON portfolio_insights (tenant_id, category);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_portfolio_insights_impact_confidence 
ON portfolio_insights (impact, confidence DESC);

-- Create indexes for user activity and audit logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_user_timestamp 
ON user_activity (user_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_tenant_action 
ON user_activity (tenant_id, action);

-- Create partial indexes for active/recent data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_active_recent 
ON contracts (tenant_id, updated_at DESC) 
WHERE status IN ('ACTIVE', 'PENDING', 'UNDER_REVIEW');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artifacts_recent_high_confidence 
ON artifacts (contract_id, created_at DESC) 
WHERE confidence_score > 0.8 AND created_at > CURRENT_DATE - INTERVAL '30 days';

-- Create materialized view for contract analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_contract_analytics AS
SELECT 
    tenant_id,
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as contract_count,
    COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_contracts,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_contracts,
    COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired_contracts,
    AVG(CASE WHEN total_value IS NOT NULL THEN total_value ELSE 0 END) as avg_value,
    SUM(CASE WHEN total_value IS NOT NULL THEN total_value ELSE 0 END) as total_value,
    COUNT(CASE WHEN total_value > 100000 THEN 1 END) as high_value_contracts,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_processing_hours
FROM contracts 
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY tenant_id, DATE_TRUNC('day', created_at);

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_contract_analytics_tenant_date 
ON mv_contract_analytics (tenant_id, date);

-- Create materialized view for artifact performance
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_artifact_performance AS
SELECT 
    tenant_id,
    type as artifact_type,
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as artifact_count,
    AVG(confidence_score) as avg_confidence,
    MIN(confidence_score) as min_confidence,
    MAX(confidence_score) as max_confidence,
    AVG(processing_time_ms) as avg_processing_time,
    MAX(processing_time_ms) as max_processing_time,
    COUNT(CASE WHEN confidence_score > 0.9 THEN 1 END) as high_confidence_count,
    COUNT(CASE WHEN confidence_score < 0.5 THEN 1 END) as low_confidence_count
FROM artifacts 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  AND confidence_score IS NOT NULL
GROUP BY tenant_id, type, DATE_TRUNC('hour', created_at);

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_artifact_performance_tenant_type_hour 
ON mv_artifact_performance (tenant_id, artifact_type, hour);

-- Create materialized view for relationship insights
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_relationship_insights AS
SELECT 
    c.tenant_id,
    cr.relationship_type,
    COUNT(*) as relationship_count,
    AVG(cr.strength) as avg_strength,
    MIN(cr.strength) as min_strength,
    MAX(cr.strength) as max_strength,
    COUNT(DISTINCT cr.source_contract_id) as unique_sources,
    COUNT(DISTINCT cr.target_contract_id) as unique_targets,
    COUNT(CASE WHEN cr.strength > 0.8 THEN 1 END) as strong_relationships,
    COUNT(CASE WHEN cr.strength < 0.3 THEN 1 END) as weak_relationships
FROM contract_relationships cr
JOIN contracts c ON cr.source_contract_id = c.id
WHERE cr.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.tenant_id, cr.relationship_type;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_relationship_insights_tenant_type 
ON mv_relationship_insights (tenant_id, relationship_type);

-- Create materialized view for portfolio insights summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_portfolio_summary AS
SELECT 
    tenant_id,
    COUNT(DISTINCT id) as total_contracts,
    COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_contracts,
    SUM(CASE WHEN total_value IS NOT NULL THEN total_value ELSE 0 END) as total_portfolio_value,
    AVG(CASE WHEN total_value IS NOT NULL THEN total_value ELSE 0 END) as avg_contract_value,
    COUNT(DISTINCT vendor) as unique_vendors,
    COUNT(DISTINCT contract_type) as unique_contract_types,
    MIN(created_at) as oldest_contract_date,
    MAX(created_at) as newest_contract_date,
    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as contracts_last_30_days,
    COUNT(CASE WHEN effective_date <= CURRENT_DATE AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE) THEN 1 END) as currently_effective_contracts
FROM contracts
GROUP BY tenant_id;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_portfolio_summary_tenant 
ON mv_portfolio_summary (tenant_id);

-- Create function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_performance_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_contract_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_artifact_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_relationship_insights;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_portfolio_summary;
END;
$$ LANGUAGE plpgsql;

-- Create function to get table statistics
CREATE OR REPLACE FUNCTION get_table_performance_stats(table_name text)
RETURNS TABLE(
    table_name text,
    row_count bigint,
    table_size text,
    index_size text,
    total_size text,
    seq_scan bigint,
    seq_tup_read bigint,
    idx_scan bigint,
    idx_tup_fetch bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        n_tup_ins + n_tup_upd + n_tup_del as row_count,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch
    FROM pg_stat_user_tables 
    WHERE tablename = table_name OR table_name IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Create function to analyze slow queries
CREATE OR REPLACE FUNCTION analyze_slow_queries()
RETURNS TABLE(
    query text,
    calls bigint,
    total_time double precision,
    mean_time double precision,
    max_time double precision,
    stddev_time double precision
) AS $$
BEGIN
    -- This would work with pg_stat_statements extension
    -- For now, return empty result
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Add table partitioning for large tables (if needed)
-- This is commented out as it requires careful planning and data migration

-- -- Partition user_activity by month
-- CREATE TABLE IF NOT EXISTS user_activity_partitioned (
--     LIKE user_activity INCLUDING ALL
-- ) PARTITION BY RANGE (timestamp);

-- -- Create partitions for current and next few months
-- CREATE TABLE IF NOT EXISTS user_activity_2024_01 PARTITION OF user_activity_partitioned
--     FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Add comments for documentation
COMMENT ON INDEX idx_contracts_tenant_status IS 'Optimized index for filtering contracts by tenant and status';
COMMENT ON INDEX idx_artifacts_search_content IS 'Full-text search index for artifact content';
COMMENT ON MATERIALIZED VIEW mv_contract_analytics IS 'Daily contract analytics aggregated by tenant';
COMMENT ON MATERIALIZED VIEW mv_artifact_performance IS 'Hourly artifact processing performance metrics';
COMMENT ON MATERIALIZED VIEW mv_relationship_insights IS 'Contract relationship analysis summary';
COMMENT ON MATERIALIZED VIEW mv_portfolio_summary IS 'High-level portfolio summary by tenant';

-- Create scheduled job to refresh materialized views (requires pg_cron extension)
-- SELECT cron.schedule('refresh-mv', '0 */6 * * *', 'SELECT refresh_performance_materialized_views();');

-- Grant appropriate permissions
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
-- GRANT SELECT ON mv_contract_analytics TO analytics_user;
-- GRANT SELECT ON mv_artifact_performance TO analytics_user;
-- GRANT SELECT ON mv_relationship_insights TO analytics_user;
-- GRANT SELECT ON mv_portfolio_summary TO analytics_user;