-- Performance optimization indexes for rate card engine enhancements
-- Migration: 022_performance_indexes

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_rate_card_entry_tenant_status_created 
ON "RateCardEntry" ("tenantId", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_rate_card_entry_tenant_role_geo 
ON "RateCardEntry" ("tenantId", "role", "geography");

CREATE INDEX IF NOT EXISTS idx_rate_card_entry_tenant_supplier 
ON "RateCardEntry" ("tenantId", "supplierId", "createdAt" DESC);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_timestamp 
ON "AuditLog" ("tenantId", "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_action 
ON "AuditLog" ("tenantId", "action", "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_timestamp 
ON "AuditLog" ("userId", "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity 
ON "AuditLog" ("entityType", "entityId", "timestamp" DESC);

-- Forecast indexes
CREATE INDEX IF NOT EXISTS idx_rate_forecast_tenant_date 
ON "RateForecast" ("tenantId", "forecastDate" DESC);

CREATE INDEX IF NOT EXISTS idx_rate_forecast_ratecard_date 
ON "RateForecast" ("rateCardEntryId", "forecastDate" DESC);

-- Cluster indexes
CREATE INDEX IF NOT EXISTS idx_cluster_tenant_created 
ON "RateCardCluster" ("tenantId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_cluster_member_ratecard 
ON "ClusterMember" ("rateCardEntryId", "similarityScore" DESC);

-- Supplier score indexes
CREATE INDEX IF NOT EXISTS idx_supplier_score_supplier_calc 
ON "SupplierScore" ("supplierId", "calculatedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_score_tenant_score 
ON "SupplierScore" ("tenantId", "overallScore" DESC);

-- Data quality indexes
CREATE INDEX IF NOT EXISTS idx_data_quality_ratecard 
ON "DataQualityScore" ("rateCardEntryId", "calculatedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_data_quality_score 
ON "DataQualityScore" ("overallScore" DESC, "calculatedAt" DESC);

-- Alert indexes
CREATE INDEX IF NOT EXISTS idx_alert_tenant_read_created 
ON "RateCardAlert" ("tenantId", "read", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_alert_user_read 
ON "RateCardAlert" ("userId", "read", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_alert_type_severity 
ON "RateCardAlert" ("type", "severity", "createdAt" DESC);

-- Segment indexes
CREATE INDEX IF NOT EXISTS idx_segment_tenant_shared 
ON "RateCardSegment" ("tenantId", "shared", "usageCount" DESC);

-- Scheduled report indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_report_tenant_enabled 
ON "ScheduledReport" ("tenantId", "enabled", "nextRun");

-- Partial indexes for active records only
CREATE INDEX IF NOT EXISTS idx_rate_card_entry_active 
ON "RateCardEntry" ("tenantId", "createdAt" DESC) 
WHERE "status" = 'active';

CREATE INDEX IF NOT EXISTS idx_alert_unread 
ON "RateCardAlert" ("tenantId", "createdAt" DESC) 
WHERE "read" = false;

-- Covering indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rate_card_entry_benchmark_covering 
ON "RateCardEntry" ("tenantId", "role", "geography", "seniority") 
INCLUDE ("rate", "currency", "createdAt");

-- Add statistics for query planner
ANALYZE "RateCardEntry";
ANALYZE "AuditLog";
ANALYZE "RateForecast";
ANALYZE "RateCardCluster";
ANALYZE "SupplierScore";
ANALYZE "DataQualityScore";
ANALYZE "RateCardAlert";

-- Comments
COMMENT ON INDEX idx_rate_card_entry_tenant_status_created IS 'Optimizes queries filtering by tenant, status, and ordering by creation date';
COMMENT ON INDEX idx_rate_card_entry_benchmark_covering IS 'Covering index for benchmark calculations - includes all needed columns';
COMMENT ON INDEX idx_audit_log_tenant_timestamp IS 'Optimizes audit log queries by tenant and time range';
COMMENT ON INDEX idx_alert_unread IS 'Partial index for unread alerts only';
