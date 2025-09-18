-- Enhanced Contract Indexation System
-- Comprehensive metadata and search capabilities

-- Contract metadata and indexation
CREATE TABLE contract_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    -- Core Identification
    document_type VARCHAR(100),
    version VARCHAR(50),
    language VARCHAR(10) DEFAULT 'en',
    
    -- Parties & Relationships
    primary_client VARCHAR(255),
    primary_supplier VARCHAR(255),
    
    -- Financial Details
    total_value DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    payment_terms_days INTEGER,
    budget_category VARCHAR(100),
    cost_center VARCHAR(100),
    
    -- Temporal Information
    effective_date DATE,
    expiration_date DATE,
    renewal_date DATE,
    notice_period_days INTEGER,
    auto_renewal BOOLEAN DEFAULT false,
    
    -- Legal & Compliance
    governing_law VARCHAR(100),
    jurisdiction VARCHAR(100),
    security_classification VARCHAR(50),
    confidentiality_level VARCHAR(50),
    
    -- Risk Assessment
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    
    -- Workflow & Status
    approval_status VARCHAR(50),
    workflow_stage VARCHAR(100),
    last_reviewed_at TIMESTAMP,
    
    -- Integration
    parent_contract_id UUID REFERENCES contracts(id),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes for performance
    UNIQUE(contract_id)
);

-- Contract parties with roles
CREATE TABLE contract_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    party_name VARCHAR(255) NOT NULL,
    party_type VARCHAR(50) CHECK (party_type IN ('client', 'supplier', 'vendor', 'partner', 'subcontractor', 'other')),
    role VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    
    -- Legal entity information
    legal_entity_type VARCHAR(50),
    registration_number VARCHAR(100),
    tax_id VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Financial terms and rate structures
CREATE TABLE contract_financial_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    -- Rate information
    rate_type VARCHAR(50), -- hourly, daily, monthly, fixed, milestone
    role_title VARCHAR(255),
    seniority_level VARCHAR(50),
    rate_amount DECIMAL(10,2),
    rate_currency VARCHAR(3) DEFAULT 'USD',
    rate_unit VARCHAR(20), -- hour, day, month, project
    
    -- Payment terms
    payment_schedule VARCHAR(100),
    payment_method VARCHAR(50),
    late_fee_percentage DECIMAL(5,2),
    discount_terms VARCHAR(255),
    
    -- Budget allocation
    budget_line_item VARCHAR(255),
    cost_allocation_percentage DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Service levels and deliverables
CREATE TABLE contract_service_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    service_name VARCHAR(255) NOT NULL,
    service_description TEXT,
    
    -- SLA metrics
    availability_percentage DECIMAL(5,2),
    response_time_hours INTEGER,
    resolution_time_hours INTEGER,
    
    -- Performance metrics
    quality_threshold DECIMAL(5,2),
    performance_penalty TEXT,
    performance_bonus TEXT,
    
    -- Deliverables
    deliverable_name VARCHAR(255),
    deliverable_description TEXT,
    delivery_date DATE,
    acceptance_criteria TEXT,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Contract milestones and dependencies
CREATE TABLE contract_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    milestone_name VARCHAR(255) NOT NULL,
    milestone_description TEXT,
    due_date DATE,
    completion_date DATE,
    status VARCHAR(50) CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed', 'cancelled')),
    
    -- Financial impact
    milestone_value DECIMAL(12,2),
    payment_trigger BOOLEAN DEFAULT false,
    
    -- Dependencies
    depends_on_milestone_id UUID REFERENCES contract_milestones(id),
    dependency_type VARCHAR(50),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- AI-generated insights and recommendations
CREATE TABLE contract_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    insight_type VARCHAR(50) CHECK (insight_type IN ('risk', 'opportunity', 'recommendation', 'alert', 'optimization')),
    category VARCHAR(100), -- financial, legal, operational, strategic
    
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- Scoring and priority
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    impact_score DECIMAL(3,2) CHECK (impact_score >= 0 AND impact_score <= 1),
    
    -- Financial impact
    estimated_savings DECIMAL(12,2),
    estimated_cost DECIMAL(12,2),
    
    -- Action items
    recommended_action TEXT,
    action_deadline DATE,
    action_owner VARCHAR(255),
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'in_progress', 'resolved', 'dismissed')),
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    
    -- AI metadata
    ai_model VARCHAR(100),
    ai_confidence DECIMAL(3,2),
    source_data JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Smart tagging system
CREATE TABLE contract_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    tag_name VARCHAR(100) NOT NULL,
    tag_category VARCHAR(50) CHECK (tag_category IN ('financial', 'legal', 'operational', 'strategic', 'custom')),
    
    -- Tag metadata
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    source VARCHAR(50) CHECK (source IN ('ai_extracted', 'user_defined', 'template_based', 'rule_based')),
    context TEXT,
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(contract_id, tag_name)
);

-- Contract relationships and references
CREATE TABLE contract_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    source_contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    target_contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    relationship_type VARCHAR(50) CHECK (relationship_type IN ('amendment', 'renewal', 'related', 'supersedes', 'depends_on', 'references')),
    relationship_description TEXT,
    
    -- Relationship strength (for AI recommendations)
    strength_score DECIMAL(3,2) CHECK (strength_score >= 0 AND strength_score <= 1),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(source_contract_id, target_contract_id, relationship_type)
);

-- Full-text search and semantic indexing
CREATE TABLE contract_search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    -- Full text content
    full_text_content TEXT,
    
    -- Extracted key terms
    key_terms TEXT[], -- Array of important terms
    semantic_tags TEXT[], -- AI-generated semantic tags
    
    -- Searchable fields
    searchable_content TSVECTOR, -- PostgreSQL full-text search
    
    -- Language and processing metadata
    content_language VARCHAR(10) DEFAULT 'en',
    processing_version VARCHAR(20),
    last_indexed_at TIMESTAMP DEFAULT NOW(),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(contract_id)
);

-- User search patterns and preferences
CREATE TABLE user_search_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Search query information
    search_query TEXT NOT NULL,
    search_type VARCHAR(50) CHECK (search_type IN ('text', 'semantic', 'voice', 'visual', 'filter')),
    
    -- Results and interaction
    results_count INTEGER,
    clicked_result_ids UUID[],
    search_duration_ms INTEGER,
    
    -- Context
    search_context JSONB, -- Additional context like filters, sort order
    user_satisfaction INTEGER CHECK (user_satisfaction >= 1 AND user_satisfaction <= 5),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_contract_metadata_contract_id ON contract_metadata(contract_id);
CREATE INDEX idx_contract_metadata_expiration ON contract_metadata(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX idx_contract_metadata_risk_level ON contract_metadata(risk_level);
CREATE INDEX idx_contract_metadata_total_value ON contract_metadata(total_value) WHERE total_value IS NOT NULL;

CREATE INDEX idx_contract_parties_contract_id ON contract_parties(contract_id);
CREATE INDEX idx_contract_parties_type ON contract_parties(party_type);
CREATE INDEX idx_contract_parties_name ON contract_parties(party_name);

CREATE INDEX idx_contract_financial_contract_id ON contract_financial_terms(contract_id);
CREATE INDEX idx_contract_financial_rate_type ON contract_financial_terms(rate_type);
CREATE INDEX idx_contract_financial_role ON contract_financial_terms(role_title);

CREATE INDEX idx_contract_insights_contract_id ON contract_insights(contract_id);
CREATE INDEX idx_contract_insights_type ON contract_insights(insight_type);
CREATE INDEX idx_contract_insights_priority ON contract_insights(priority);
CREATE INDEX idx_contract_insights_status ON contract_insights(status);

CREATE INDEX idx_contract_tags_contract_id ON contract_tags(contract_id);
CREATE INDEX idx_contract_tags_name ON contract_tags(tag_name);
CREATE INDEX idx_contract_tags_category ON contract_tags(tag_category);

CREATE INDEX idx_contract_relationships_source ON contract_relationships(source_contract_id);
CREATE INDEX idx_contract_relationships_target ON contract_relationships(target_contract_id);
CREATE INDEX idx_contract_relationships_type ON contract_relationships(relationship_type);

-- Full-text search index
CREATE INDEX idx_contract_search_content ON contract_search_index USING GIN(searchable_content);
CREATE INDEX idx_contract_search_terms ON contract_search_index USING GIN(key_terms);
CREATE INDEX idx_contract_search_semantic ON contract_search_index USING GIN(semantic_tags);

-- Composite indexes for common queries
CREATE INDEX idx_metadata_expiration_risk ON contract_metadata(expiration_date, risk_level) WHERE expiration_date IS NOT NULL;
CREATE INDEX idx_metadata_value_currency ON contract_metadata(total_value, currency) WHERE total_value IS NOT NULL;
CREATE INDEX idx_insights_priority_status ON contract_insights(priority, status);

-- Update triggers for maintaining search index
CREATE OR REPLACE FUNCTION update_contract_search_index()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the searchable content when contract content changes
    UPDATE contract_search_index 
    SET searchable_content = to_tsvector('english', 
        COALESCE(NEW.name, '') || ' ' || 
        COALESCE((SELECT string_agg(party_name, ' ') FROM contract_parties WHERE contract_id = NEW.id), '') || ' ' ||
        COALESCE((SELECT string_agg(tag_name, ' ') FROM contract_tags WHERE contract_id = NEW.id), '')
    ),
    last_indexed_at = NOW()
    WHERE contract_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_search_index
    AFTER UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_contract_search_index();

-- Function to calculate contract health score
CREATE OR REPLACE FUNCTION calculate_contract_health_score(contract_uuid UUID)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    health_score DECIMAL(3,2) := 1.0;
    risk_penalty DECIMAL(3,2) := 0.0;
    compliance_bonus DECIMAL(3,2) := 0.0;
    expiration_penalty DECIMAL(3,2) := 0.0;
BEGIN
    -- Reduce score based on risk level
    SELECT CASE 
        WHEN risk_level = 'critical' THEN 0.4
        WHEN risk_level = 'high' THEN 0.2
        WHEN risk_level = 'medium' THEN 0.1
        ELSE 0.0
    END INTO risk_penalty
    FROM contract_metadata 
    WHERE contract_id = contract_uuid;
    
    -- Reduce score if expiring soon (within 30 days)
    SELECT CASE 
        WHEN expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 0.2
        WHEN expiration_date <= CURRENT_DATE + INTERVAL '90 days' THEN 0.1
        ELSE 0.0
    END INTO expiration_penalty
    FROM contract_metadata 
    WHERE contract_id = contract_uuid;
    
    -- Calculate final score
    health_score := health_score - risk_penalty - expiration_penalty;
    
    -- Ensure score is between 0 and 1
    RETURN GREATEST(0.0, LEAST(1.0, health_score));
END;
$$ LANGUAGE plpgsql;