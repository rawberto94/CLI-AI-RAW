-- Enhanced Search Indexation Migration
-- This migration creates the infrastructure for comprehensive contract search indexation

-- Create contract search index table
CREATE TABLE IF NOT EXISTS contract_search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    search_vector TSVECTOR NOT NULL,
    semantic_embedding VECTOR(1536), -- For OpenAI embeddings (optional)
    metadata JSONB NOT NULL DEFAULT '{}',
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_contract_search_index UNIQUE (contract_id)
);

-- Create indexes for efficient search
CREATE INDEX IF NOT EXISTS idx_contract_search_vector ON contract_search_index USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_contract_search_metadata ON contract_search_index USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_contract_search_tenant ON contract_search_index(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contract_search_updated ON contract_search_index(updated_at DESC);

-- Create semantic search index if vector extension is available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        CREATE INDEX IF NOT EXISTS idx_contract_semantic_embedding ON contract_search_index 
        USING ivfflat (semantic_embedding vector_cosine_ops) WITH (lists = 100);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Vector extension not available, skip semantic index
        NULL;
END $$;

-- Add search metadata to contracts table
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS search_metadata JSONB DEFAULT '{}';

-- Create index on contract search metadata
CREATE INDEX IF NOT EXISTS idx_contracts_search_metadata ON contracts USING GIN(search_metadata);

-- Create search analytics table for tracking search performance
CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    query_filters JSONB DEFAULT '{}',
    results_count INTEGER NOT NULL DEFAULT 0,
    response_time_ms INTEGER NOT NULL DEFAULT 0,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    clicked_results UUID[] DEFAULT '{}',
    search_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for analytics
    INDEX (tenant_id, search_timestamp DESC),
    INDEX (query_text),
    INDEX USING GIN(query_filters)
);

-- Create materialized view for search performance metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS search_performance_metrics AS
SELECT 
    tenant_id,
    DATE_TRUNC('day', search_timestamp) as search_date,
    COUNT(*) as total_searches,
    AVG(response_time_ms) as avg_response_time,
    AVG(results_count) as avg_results_count,
    COUNT(DISTINCT user_id) as unique_users,
    -- Top queries
    array_agg(DISTINCT query_text ORDER BY query_text) FILTER (WHERE query_text != '') as popular_queries
FROM search_analytics
GROUP BY tenant_id, DATE_TRUNC('day', search_timestamp);

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_performance_metrics_unique 
ON search_performance_metrics(tenant_id, search_date);

-- Create function to refresh search performance metrics
CREATE OR REPLACE FUNCTION refresh_search_performance_metrics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY search_performance_metrics;
END;
$$ LANGUAGE plpgsql;

-- Create contract indexation queue table for async processing
CREATE TABLE IF NOT EXISTS contract_indexation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 5, -- 1 = highest, 10 = lowest
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_priority CHECK (priority BETWEEN 1 AND 10),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT valid_retry_count CHECK (retry_count >= 0 AND retry_count <= max_retries)
);

-- Create indexes for indexation queue
CREATE INDEX IF NOT EXISTS idx_indexation_queue_status ON contract_indexation_queue(status, priority, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_indexation_queue_tenant ON contract_indexation_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_indexation_queue_contract ON contract_indexation_queue(contract_id);

-- Create function to automatically queue contracts for indexation
CREATE OR REPLACE FUNCTION queue_contract_for_indexation()
RETURNS TRIGGER AS $$
BEGIN
    -- Queue new contracts for indexation
    IF TG_OP = 'INSERT' THEN
        INSERT INTO contract_indexation_queue (contract_id, tenant_id, priority)
        VALUES (NEW.id, NEW.tenant_id, 3) -- Medium priority for new contracts
        ON CONFLICT DO NOTHING;
        RETURN NEW;
    END IF;
    
    -- Re-queue contracts when artifacts are updated
    IF TG_OP = 'UPDATE' AND OLD.updated_at != NEW.updated_at THEN
        INSERT INTO contract_indexation_queue (contract_id, tenant_id, priority)
        VALUES (NEW.id, NEW.tenant_id, 5) -- Lower priority for updates
        ON CONFLICT (contract_id) DO UPDATE SET
            status = 'pending',
            retry_count = 0,
            scheduled_at = NOW(),
            updated_at = NOW();
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically queue contracts for indexation
DROP TRIGGER IF EXISTS trigger_queue_contract_indexation ON contracts;
CREATE TRIGGER trigger_queue_contract_indexation
    AFTER INSERT OR UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION queue_contract_for_indexation();

-- Create function to automatically re-index when artifacts change
CREATE OR REPLACE FUNCTION queue_contract_reindexation_on_artifact_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Re-queue contract for indexation when artifacts are added/updated
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        INSERT INTO contract_indexation_queue (contract_id, tenant_id, priority)
        VALUES (NEW.contract_id, NEW.tenant_id, 4) -- Medium-high priority for artifact changes
        ON CONFLICT (contract_id) DO UPDATE SET
            status = 'pending',
            retry_count = 0,
            scheduled_at = NOW(),
            updated_at = NOW();
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for artifact changes
DROP TRIGGER IF EXISTS trigger_reindex_on_artifact_change ON artifacts;
CREATE TRIGGER trigger_reindex_on_artifact_change
    AFTER INSERT OR UPDATE ON artifacts
    FOR EACH ROW
    EXECUTE FUNCTION queue_contract_reindexation_on_artifact_change();

-- Create search suggestions table for autocomplete
CREATE TABLE IF NOT EXISTS search_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    suggestion_text TEXT NOT NULL,
    suggestion_type VARCHAR(50) NOT NULL, -- 'term', 'party', 'contract_type', etc.
    usage_count INTEGER NOT NULL DEFAULT 1,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_tenant_suggestion UNIQUE (tenant_id, suggestion_text, suggestion_type)
);

-- Create indexes for search suggestions
CREATE INDEX IF NOT EXISTS idx_search_suggestions_tenant_type ON search_suggestions(tenant_id, suggestion_type);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_usage ON search_suggestions(usage_count DESC, last_used DESC);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_text ON search_suggestions USING GIN(to_tsvector('english', suggestion_text));

-- Create function to update search suggestions
CREATE OR REPLACE FUNCTION update_search_suggestions(
    p_tenant_id UUID,
    p_suggestion_text TEXT,
    p_suggestion_type VARCHAR(50)
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO search_suggestions (tenant_id, suggestion_text, suggestion_type)
    VALUES (p_tenant_id, p_suggestion_text, p_suggestion_type)
    ON CONFLICT (tenant_id, suggestion_text, suggestion_type) DO UPDATE SET
        usage_count = search_suggestions.usage_count + 1,
        last_used = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create search history table for user search tracking
CREATE TABLE IF NOT EXISTS user_search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    query_filters JSONB DEFAULT '{}',
    results_count INTEGER NOT NULL DEFAULT 0,
    clicked_contracts UUID[] DEFAULT '{}',
    search_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX (user_id, search_timestamp DESC),
    INDEX (tenant_id, search_timestamp DESC),
    INDEX USING GIN(query_filters)
);

-- Create function to clean up old search data
CREATE OR REPLACE FUNCTION cleanup_old_search_data()
RETURNS VOID AS $$
BEGIN
    -- Clean up search analytics older than 1 year
    DELETE FROM search_analytics 
    WHERE search_timestamp < NOW() - INTERVAL '1 year';
    
    -- Clean up user search history older than 6 months
    DELETE FROM user_search_history 
    WHERE search_timestamp < NOW() - INTERVAL '6 months';
    
    -- Clean up completed indexation queue items older than 1 week
    DELETE FROM contract_indexation_queue 
    WHERE status = 'completed' AND completed_at < NOW() - INTERVAL '1 week';
    
    -- Clean up failed indexation queue items older than 1 month
    DELETE FROM contract_indexation_queue 
    WHERE status = 'failed' AND updated_at < NOW() - INTERVAL '1 month';
    
    -- Refresh search performance metrics
    PERFORM refresh_search_performance_metrics();
END;
$$ LANGUAGE plpgsql;

-- Create view for search index health monitoring
CREATE OR REPLACE VIEW search_index_health AS
SELECT 
    t.name as tenant_name,
    t.id as tenant_id,
    COUNT(c.id) as total_contracts,
    COUNT(csi.id) as indexed_contracts,
    ROUND(
        (COUNT(csi.id)::float / NULLIF(COUNT(c.id), 0) * 100)::numeric, 2
    ) as indexation_percentage,
    AVG((csi.metadata->>'confidenceScore')::float) as avg_confidence_score,
    MAX(csi.updated_at) as last_indexation,
    COUNT(CASE WHEN ciq.status = 'pending' THEN 1 END) as pending_indexations,
    COUNT(CASE WHEN ciq.status = 'failed' THEN 1 END) as failed_indexations
FROM tenants t
LEFT JOIN contracts c ON t.id = c.tenant_id
LEFT JOIN contract_search_index csi ON c.id = csi.contract_id
LEFT JOIN contract_indexation_queue ciq ON c.id = ciq.contract_id
GROUP BY t.id, t.name
ORDER BY indexation_percentage DESC;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON contract_search_index TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON search_analytics TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON contract_indexation_queue TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON search_suggestions TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_search_history TO app_user;
GRANT SELECT ON search_performance_metrics TO app_user;
GRANT SELECT ON search_index_health TO app_user;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Create initial search suggestions for common terms
INSERT INTO search_suggestions (tenant_id, suggestion_text, suggestion_type) 
SELECT 
    t.id,
    unnest(ARRAY[
        'payment terms', 'liability', 'termination', 'confidentiality', 'intellectual property',
        'service level agreement', 'indemnification', 'force majeure', 'governing law',
        'dispute resolution', 'renewal', 'cancellation', 'warranty', 'limitation of liability'
    ]),
    'term'
FROM tenants t
ON CONFLICT DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE contract_search_index IS 'Enhanced search index for contracts with full-text and semantic search capabilities';
COMMENT ON TABLE search_analytics IS 'Analytics data for search performance monitoring and optimization';
COMMENT ON TABLE contract_indexation_queue IS 'Queue for asynchronous contract indexation processing';
COMMENT ON TABLE search_suggestions IS 'Autocomplete suggestions for search queries';
COMMENT ON TABLE user_search_history IS 'User search history for personalization and analytics';
COMMENT ON VIEW search_index_health IS 'Monitoring view for search index health and coverage';