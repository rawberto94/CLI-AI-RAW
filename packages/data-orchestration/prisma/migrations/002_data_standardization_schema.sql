-- Data Standardization Database Schema Migration
-- This migration adds tables for data standardization and clustering

-- ============================================================================
-- STANDARDIZATION RULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS standardization_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'line_of_service', 'supplier', 'role', 'seniority'
    source_value TEXT NOT NULL,
    standard_value TEXT NOT NULL,
    confidence DECIMAL(5,2) NOT NULL,
    aliases JSON,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    UNIQUE(tenant_id, category, source_value)
);

CREATE INDEX IF NOT EXISTS idx_standardization_rules_tenant_category ON standardization_rules(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_standardization_rules_source_value ON standardization_rules(source_value);
CREATE INDEX IF NOT EXISTS idx_standardization_rules_standard_value ON standardization_rules(standard_value);
CREATE INDEX IF NOT EXISTS idx_standardization_rules_confidence ON standardization_rules(confidence DESC);

-- ============================================================================
-- CLUSTER DEFINITIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS cluster_definitions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'line_of_service', 'supplier', 'role', 'seniority'
    cluster_name TEXT NOT NULL,
    standard_value TEXT NOT NULL,
    members JSON NOT NULL, -- Array of member values
    confidence DECIMAL(5,2) NOT NULL,
    characteristics JSON, -- Additional cluster metadata
    member_count INTEGER GENERATED ALWAYS AS (json_array_length(members)) STORED,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cluster_definitions_tenant_category ON cluster_definitions(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_cluster_definitions_standard_value ON cluster_definitions(standard_value);
CREATE INDEX IF NOT EXISTS idx_cluster_definitions_confidence ON cluster_definitions(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_cluster_definitions_member_count ON cluster_definitions(member_count DESC);

-- ============================================================================
-- STANDARDIZATION ANALYTICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS standardization_analytics (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    analysis_date DATE NOT NULL,
    total_items INTEGER NOT NULL,
    clustered_items INTEGER NOT NULL,
    clusters_created INTEGER NOT NULL,
    standardization_rate DECIMAL(5,2) NOT NULL,
    confidence_score DECIMAL(5,2) NOT NULL,
    recommendations JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, category, analysis_date)
);

CREATE INDEX IF NOT EXISTS idx_standardization_analytics_tenant ON standardization_analytics(tenant_id, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_standardization_analytics_category ON standardization_analytics(category, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_standardization_analytics_rate ON standardization_analytics(standardization_rate DESC);

-- ============================================================================
-- STANDARDIZATION HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS standardization_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    original_value TEXT NOT NULL,
    standardized_value TEXT NOT NULL,
    confidence DECIMAL(5,2) NOT NULL,
    method VARCHAR(50) NOT NULL, -- 'exact_match', 'fuzzy_match', 'ml_classification', 'manual'
    cluster_id TEXT,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    applied_by TEXT,
    FOREIGN KEY (cluster_id) REFERENCES cluster_definitions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_standardization_history_tenant ON standardization_history(tenant_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_standardization_history_category ON standardization_history(category, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_standardization_history_original ON standardization_history(original_value);
CREATE INDEX IF NOT EXISTS idx_standardization_history_cluster ON standardization_history(cluster_id);

-- ============================================================================
-- SUPPLIER MASTER DATA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_master_data (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    standard_name TEXT NOT NULL,
    variations JSON NOT NULL, -- Array of name variations
    duns_number VARCHAR(20),
    tax_id VARCHAR(50),
    headquarters_country VARCHAR(3),
    industry_code VARCHAR(10),
    employee_count INTEGER,
    annual_revenue DECIMAL(15,2),
    website_url TEXT,
    primary_contact JSON,
    risk_rating VARCHAR(20),
    certification_status JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, standard_name)
);

CREATE INDEX IF NOT EXISTS idx_supplier_master_tenant ON supplier_master_data(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_master_standard_name ON supplier_master_data(standard_name);
CREATE INDEX IF NOT EXISTS idx_supplier_master_duns ON supplier_master_data(duns_number);
CREATE INDEX IF NOT EXISTS idx_supplier_master_industry ON supplier_master_data(industry_code);
CREATE INDEX IF NOT EXISTS idx_supplier_master_risk ON supplier_master_data(risk_rating);

-- ============================================================================
-- ROLE TAXONOMY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_taxonomy (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    standard_role TEXT NOT NULL,
    role_family VARCHAR(100) NOT NULL, -- 'Engineering', 'Consulting', 'Management', etc.
    seniority_level VARCHAR(50) NOT NULL, -- 'Junior', 'Mid', 'Senior', 'Lead', 'Principal'
    skill_categories JSON, -- Array of skill categories
    typical_responsibilities JSON, -- Array of responsibilities
    experience_range JSON, -- {min: 0, max: 3} years
    salary_band VARCHAR(20),
    variations JSON NOT NULL, -- Array of role title variations
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, standard_role, seniority_level)
);

CREATE INDEX IF NOT EXISTS idx_role_taxonomy_tenant ON role_taxonomy(tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_taxonomy_family ON role_taxonomy(role_family);
CREATE INDEX IF NOT EXISTS idx_role_taxonomy_seniority ON role_taxonomy(seniority_level);
CREATE INDEX IF NOT EXISTS idx_role_taxonomy_standard_role ON role_taxonomy(standard_role);

-- ============================================================================
-- LINE OF SERVICE TAXONOMY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS line_of_service_taxonomy (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    standard_service TEXT NOT NULL,
    service_category VARCHAR(100) NOT NULL, -- 'Technology', 'Consulting', 'Finance', etc.
    subcategory VARCHAR(100),
    description TEXT,
    typical_roles JSON, -- Array of typical roles in this service line
    skill_requirements JSON, -- Array of required skills
    variations JSON NOT NULL, -- Array of service name variations
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, standard_service)
);

CREATE INDEX IF NOT EXISTS idx_los_taxonomy_tenant ON line_of_service_taxonomy(tenant_id);
CREATE INDEX IF NOT EXISTS idx_los_taxonomy_category ON line_of_service_taxonomy(service_category);
CREATE INDEX IF NOT EXISTS idx_los_taxonomy_standard ON line_of_service_taxonomy(standard_service);

-- ============================================================================
-- STANDARDIZATION QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS standardization_queue (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    source_value TEXT NOT NULL,
    suggested_standard TEXT,
    confidence DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'manual_review'
    priority INTEGER DEFAULT 5, -- 1-10, higher is more urgent
    source_table TEXT, -- Which table/source this came from
    source_id TEXT, -- ID of the source record
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    reviewed_by TEXT,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_standardization_queue_tenant ON standardization_queue(tenant_id, status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_standardization_queue_category ON standardization_queue(category, status);
CREATE INDEX IF NOT EXISTS idx_standardization_queue_confidence ON standardization_queue(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_standardization_queue_created ON standardization_queue(created_at DESC);

-- ============================================================================
-- VIEWS FOR EASY QUERYING
-- ============================================================================

-- View for standardization coverage by category
CREATE VIEW IF NOT EXISTS standardization_coverage AS
SELECT 
    sr.tenant_id,
    sr.category,
    COUNT(DISTINCT sr.source_value) as standardized_values,
    COUNT(DISTINCT sr.standard_value) as unique_standards,
    AVG(sr.confidence) as avg_confidence,
    SUM(sr.usage_count) as total_usage
FROM standardization_rules sr
GROUP BY sr.tenant_id, sr.category;

-- View for cluster summary
CREATE VIEW IF NOT EXISTS cluster_summary AS
SELECT 
    cd.tenant_id,
    cd.category,
    COUNT(*) as total_clusters,
    AVG(cd.member_count) as avg_cluster_size,
    AVG(cd.confidence) as avg_confidence,
    SUM(cd.member_count) as total_clustered_items
FROM cluster_definitions cd
GROUP BY cd.tenant_id, cd.category;

-- View for standardization queue summary
CREATE VIEW IF NOT EXISTS standardization_queue_summary AS
SELECT 
    sq.tenant_id,
    sq.category,
    sq.status,
    COUNT(*) as item_count,
    AVG(sq.confidence) as avg_confidence,
    MIN(sq.created_at) as oldest_item,
    MAX(sq.created_at) as newest_item
FROM standardization_queue sq
GROUP BY sq.tenant_id, sq.category, sq.status;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Trigger to update usage count when standardization rule is used
CREATE TRIGGER IF NOT EXISTS update_standardization_usage
AFTER INSERT ON standardization_history
BEGIN
    UPDATE standardization_rules 
    SET usage_count = usage_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = NEW.tenant_id 
    AND category = NEW.category 
    AND source_value = NEW.original_value;
END;

-- Trigger to update cluster member count when members change
CREATE TRIGGER IF NOT EXISTS update_cluster_updated_at
AFTER UPDATE ON cluster_definitions
BEGIN
    UPDATE cluster_definitions 
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;