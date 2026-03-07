-- Enhanced Contract Intelligence Database Schema Migration
-- This migration creates the complete database schema with proper indexing and constraints

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE', 'DELETED');
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIAL', 'EXPIRED', 'CANCELLED');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE "ContractStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED', 'ARCHIVED', 'DELETED');
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'INGESTION', 'TEMPLATE_ANALYSIS', 'FINANCIAL_ANALYSIS', 'OVERVIEW_ANALYSIS', 'CLAUSES_ANALYSIS', 'COMPLIANCE_ANALYSIS', 'RISK_ANALYSIS', 'RATES_ANALYSIS', 'BENCHMARK_ANALYSIS', 'REPORT_GENERATION', 'COMPLETED', 'FAILED');
CREATE TYPE "ArtifactType" AS ENUM ('INGESTION', 'TEMPLATE', 'FINANCIAL', 'OVERVIEW', 'CLAUSES', 'RATES', 'COMPLIANCE', 'BENCHMARK', 'RISK', 'REPORT');
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- Performance optimization: Create indexes for frequently queried columns
-- These indexes will be created automatically by Prisma based on the schema

-- Create materialized views for analytics (optional performance optimization)
CREATE MATERIALIZED VIEW IF NOT EXISTS contract_analytics AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    COUNT(c.id) as total_contracts,
    COUNT(CASE WHEN c.status = 'COMPLETED' THEN 1 END) as completed_contracts,
    COUNT(CASE WHEN c.status = 'PROCESSING' THEN 1 END) as processing_contracts,
    COUNT(CASE WHEN c.status = 'FAILED' THEN 1 END) as failed_contracts,
    AVG(CASE WHEN r.completed_at IS NOT NULL AND r.started_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (r.completed_at - r.started_at)) END) as avg_processing_time_seconds,
    MAX(c.created_at) as last_upload_date
FROM "Tenant" t
LEFT JOIN "Contract" c ON t.id = c.tenant_id
LEFT JOIN "Run" r ON c.id = r.contract_id AND r.status = 'COMPLETED'
GROUP BY t.id, t.name;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_analytics_tenant_id ON contract_analytics (tenant_id);

-- Function to refresh materialized views (can be called periodically)
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY contract_analytics;
END;
$$ LANGUAGE plpgsql;

-- Create function for automatic audit logging
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS trigger AS $$
BEGIN
    -- This function can be attached to tables to automatically create audit logs
    -- Implementation would depend on specific audit requirements
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create function for updating tenant usage statistics
CREATE OR REPLACE FUNCTION update_tenant_usage(
    p_tenant_id TEXT,
    p_contracts_increment INTEGER DEFAULT 0,
    p_tokens_increment BIGINT DEFAULT 0,
    p_storage_increment BIGINT DEFAULT 0,
    p_api_calls_increment INTEGER DEFAULT 0
)
RETURNS void AS $$
BEGIN
    INSERT INTO "TenantUsage" (
        id, tenant_id, contracts_processed, ai_tokens_used, 
        storage_used, api_calls_count, reset_date
    )
    VALUES (
        gen_random_uuid()::text,
        p_tenant_id,
        p_contracts_increment,
        p_tokens_increment,
        p_storage_increment,
        p_api_calls_increment,
        date_trunc('month', CURRENT_DATE) + interval '1 month'
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
        contracts_processed = "TenantUsage".contracts_processed + p_contracts_increment,
        ai_tokens_used = "TenantUsage".ai_tokens_used + p_tokens_increment,
        storage_used = "TenantUsage".storage_used + p_storage_increment,
        api_calls_count = "TenantUsage".api_calls_count + p_api_calls_increment,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create function for cleaning up old data
CREATE OR REPLACE FUNCTION cleanup_old_data(
    p_days_to_keep INTEGER DEFAULT 90
)
RETURNS void AS $$
BEGIN
    -- Clean up old audit logs
    DELETE FROM "AuditLog" 
    WHERE created_at < CURRENT_DATE - INTERVAL '1 day' * p_days_to_keep;
    
    -- Clean up old metrics
    DELETE FROM "Metric" 
    WHERE timestamp < CURRENT_DATE - INTERVAL '1 day' * p_days_to_keep;
    
    -- Clean up expired user sessions
    DELETE FROM "UserSession" 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Clean up deleted contracts and related data
    DELETE FROM "Contract" 
    WHERE status = 'DELETED' 
    AND updated_at < CURRENT_DATE - INTERVAL '1 day' * 30;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance optimization
-- Note: Most indexes are created automatically by Prisma based on the schema
-- These are additional performance indexes

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_contract_tenant_status_created 
ON "Contract" (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_artifact_tenant_type_created 
ON "Artifact" (tenant_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_run_tenant_status_started 
ON "Run" (tenant_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_action_created 
ON "AuditLog" (tenant_id, action, created_at DESC);

-- Partial indexes for active records only
CREATE INDEX IF NOT EXISTS idx_tenant_active 
ON "Tenant" (id) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_user_active 
ON "User" (tenant_id, id) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_contract_processing 
ON "Contract" (tenant_id, id) WHERE status IN ('UPLOADED', 'PROCESSING');

-- Text search indexes (if full-text search is needed)
-- CREATE INDEX IF NOT EXISTS idx_contract_filename_search 
-- ON "Contract" USING gin(to_tsvector('english', filename));

-- Performance monitoring view
CREATE OR REPLACE VIEW performance_metrics AS
SELECT 
    'database_size' as metric_name,
    pg_size_pretty(pg_database_size(current_database())) as metric_value,
    CURRENT_TIMESTAMP as measured_at
UNION ALL
SELECT 
    'total_contracts' as metric_name,
    COUNT(*)::text as metric_value,
    CURRENT_TIMESTAMP as measured_at
FROM "Contract"
UNION ALL
SELECT 
    'active_tenants' as metric_name,
    COUNT(*)::text as metric_value,
    CURRENT_TIMESTAMP as measured_at
FROM "Tenant" 
WHERE status = 'ACTIVE';

-- Grant necessary permissions (adjust as needed for your environment)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;