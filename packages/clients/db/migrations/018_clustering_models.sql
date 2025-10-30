-- Migration: Add Clustering and Consolidation Models
-- Description: Creates tables for rate card clustering, consolidation opportunities, and geographic arbitrage

-- Create rate_card_clusters table
CREATE TABLE IF NOT EXISTS rate_card_clusters (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    cluster_type TEXT NOT NULL DEFAULT 'K_MEANS',
    member_count INTEGER NOT NULL,
    avg_rate DECIMAL(10, 2) NOT NULL,
    min_rate DECIMAL(10, 2) NOT NULL,
    max_rate DECIMAL(10, 2) NOT NULL,
    characteristics JSONB NOT NULL DEFAULT '{}',
    centroid JSONB NOT NULL DEFAULT '{}',
    consolidation_savings DECIMAL(15, 2) NOT NULL,
    supplier_count INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create cluster_members table
CREATE TABLE IF NOT EXISTS cluster_members (
    id TEXT PRIMARY KEY,
    cluster_id TEXT NOT NULL,
    rate_card_entry_id TEXT NOT NULL,
    similarity_score DECIMAL(5, 2) NOT NULL,
    distance_to_centroid DECIMAL(10, 6) NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT cluster_members_cluster_id_rate_card_entry_id_key UNIQUE (cluster_id, rate_card_entry_id),
    CONSTRAINT cluster_members_cluster_id_fkey FOREIGN KEY (cluster_id) REFERENCES rate_card_clusters(id) ON DELETE CASCADE
);

-- Create consolidation_opportunities table
CREATE TABLE IF NOT EXISTS consolidation_opportunities (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    cluster_id TEXT NOT NULL,
    opportunity_name TEXT NOT NULL,
    description TEXT,
    current_supplier_count INTEGER NOT NULL,
    recommended_supplier_id TEXT NOT NULL,
    recommended_supplier_name TEXT NOT NULL,
    suppliers_to_consolidate TEXT[] DEFAULT ARRAY[]::TEXT[],
    current_annual_cost DECIMAL(15, 2) NOT NULL,
    projected_annual_cost DECIMAL(15, 2) NOT NULL,
    annual_savings DECIMAL(15, 2) NOT NULL,
    savings_percentage DECIMAL(5, 2) NOT NULL,
    total_volume INTEGER NOT NULL,
    volume_by_supplier JSONB NOT NULL DEFAULT '{}',
    risk_level TEXT NOT NULL,
    risk_factors TEXT[] DEFAULT ARRAY[]::TEXT[],
    implementation_complexity TEXT NOT NULL,
    estimated_timeframe TEXT NOT NULL,
    action_items TEXT[] DEFAULT ARRAY[]::TEXT[],
    confidence DECIMAL(5, 2) NOT NULL,
    data_quality DECIMAL(5, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'IDENTIFIED',
    assigned_to TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    implemented_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create geographic_arbitrage_opportunities table
CREATE TABLE IF NOT EXISTS geographic_arbitrage_opportunities (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    cluster_id TEXT NOT NULL,
    source_country TEXT NOT NULL,
    source_region TEXT NOT NULL,
    target_country TEXT NOT NULL,
    target_region TEXT NOT NULL,
    current_average_rate DECIMAL(10, 2) NOT NULL,
    target_average_rate DECIMAL(10, 2) NOT NULL,
    rate_difference DECIMAL(10, 2) NOT NULL,
    savings_percentage DECIMAL(5, 2) NOT NULL,
    annual_savings_potential DECIMAL(15, 2) NOT NULL,
    affected_roles INTEGER NOT NULL,
    estimated_ftes INTEGER NOT NULL,
    quality_difference TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    risk_factors TEXT[] DEFAULT ARRAY[]::TEXT[],
    feasibility TEXT NOT NULL,
    considerations TEXT[] DEFAULT ARRAY[]::TEXT[],
    recommendations TEXT[] DEFAULT ARRAY[]::TEXT[],
    confidence DECIMAL(5, 2) NOT NULL,
    source_sample_size INTEGER NOT NULL,
    target_sample_size INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'IDENTIFIED',
    assigned_to TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    implemented_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for rate_card_clusters
CREATE INDEX IF NOT EXISTS idx_rate_card_clusters_tenant_id ON rate_card_clusters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rate_card_clusters_consolidation_savings ON rate_card_clusters(consolidation_savings DESC);
CREATE INDEX IF NOT EXISTS idx_rate_card_clusters_created_at ON rate_card_clusters(created_at);

-- Create indexes for cluster_members
CREATE INDEX IF NOT EXISTS idx_cluster_members_cluster_id ON cluster_members(cluster_id);
CREATE INDEX IF NOT EXISTS idx_cluster_members_rate_card_entry_id ON cluster_members(rate_card_entry_id);

-- Create indexes for consolidation_opportunities
CREATE INDEX IF NOT EXISTS idx_consolidation_opportunities_tenant_id ON consolidation_opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_opportunities_cluster_id ON consolidation_opportunities(cluster_id);
CREATE INDEX IF NOT EXISTS idx_consolidation_opportunities_status ON consolidation_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_consolidation_opportunities_annual_savings ON consolidation_opportunities(annual_savings DESC);
CREATE INDEX IF NOT EXISTS idx_consolidation_opportunities_tenant_status ON consolidation_opportunities(tenant_id, status);

-- Create indexes for geographic_arbitrage_opportunities
CREATE INDEX IF NOT EXISTS idx_geographic_arbitrage_tenant_id ON geographic_arbitrage_opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_geographic_arbitrage_cluster_id ON geographic_arbitrage_opportunities(cluster_id);
CREATE INDEX IF NOT EXISTS idx_geographic_arbitrage_status ON geographic_arbitrage_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_geographic_arbitrage_savings ON geographic_arbitrage_opportunities(annual_savings_potential DESC);
CREATE INDEX IF NOT EXISTS idx_geographic_arbitrage_source_country ON geographic_arbitrage_opportunities(source_country);
CREATE INDEX IF NOT EXISTS idx_geographic_arbitrage_target_country ON geographic_arbitrage_opportunities(target_country);
CREATE INDEX IF NOT EXISTS idx_geographic_arbitrage_tenant_status ON geographic_arbitrage_opportunities(tenant_id, status);

-- Add comments
COMMENT ON TABLE rate_card_clusters IS 'Stores rate card clustering results using K-means and other algorithms';
COMMENT ON TABLE cluster_members IS 'Maps rate card entries to their assigned clusters';
COMMENT ON TABLE consolidation_opportunities IS 'Tracks supplier consolidation opportunities identified from clustering analysis';
COMMENT ON TABLE geographic_arbitrage_opportunities IS 'Tracks geographic arbitrage opportunities for cost savings';
