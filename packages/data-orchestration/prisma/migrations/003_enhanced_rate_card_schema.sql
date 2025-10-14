-- Enhanced Rate Card Schema Migration
-- This migration adds comprehensive fields for line of service, seniority, geography, skills, and contract terms

-- ============================================================================
-- ENHANCE RATE_CARDS TABLE
-- ============================================================================

-- Add new fields to rate_cards table
ALTER TABLE rate_cards ADD COLUMN line_of_service VARCHAR(100);
ALTER TABLE rate_cards ADD COLUMN country VARCHAR(3); -- ISO 3166-1 alpha-3
ALTER TABLE rate_cards ADD COLUMN state_province VARCHAR(100);
ALTER TABLE rate_cards ADD COLUMN city VARCHAR(100);
ALTER TABLE rate_cards ADD COLUMN cost_of_living_index DECIMAL(5,2);
ALTER TABLE rate_cards ADD COLUMN business_unit VARCHAR(100);
ALTER TABLE rate_cards ADD COLUMN cost_center VARCHAR(50);
ALTER TABLE rate_cards ADD COLUMN project_type VARCHAR(100);
ALTER TABLE rate_cards ADD COLUMN engagement_model VARCHAR(50) DEFAULT 'Staff Augmentation'; -- 'Staff Augmentation', 'Project', 'Outcome'
ALTER TABLE rate_cards ADD COLUMN payment_terms VARCHAR(100);
ALTER TABLE rate_cards ADD COLUMN minimum_commitment_hours INTEGER;
ALTER TABLE rate_cards ADD COLUMN volume_discount_tiers JSON;
ALTER TABLE rate_cards ADD COLUMN escalation_percentage DECIMAL(5,2);
ALTER TABLE rate_cards ADD COLUMN escalation_frequency VARCHAR(20); -- 'Annual', 'Quarterly'
ALTER TABLE rate_cards ADD COLUMN review_cycle_months INTEGER;
ALTER TABLE rate_cards ADD COLUMN approval_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE rate_cards ADD COLUMN approved_by TEXT;
ALTER TABLE rate_cards ADD COLUMN approved_at DATETIME;
ALTER TABLE rate_cards ADD COLUMN approval_notes TEXT;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_rate_cards_line_of_service ON rate_cards(line_of_service);
CREATE INDEX IF NOT EXISTS idx_rate_cards_country ON rate_cards(country);
CREATE INDEX IF NOT EXISTS idx_rate_cards_engagement_model ON rate_cards(engagement_model);
CREATE INDEX IF NOT EXISTS idx_rate_cards_approval_status ON rate_cards(approval_status);
CREATE INDEX IF NOT EXISTS idx_rate_cards_business_unit ON rate_cards(business_unit);

-- ============================================================================
-- ENHANCE RATES TABLE
-- ============================================================================

-- Add new fields to rates table
ALTER TABLE rates ADD COLUMN seniority_level VARCHAR(50); -- 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Principal', 'Director'
ALTER TABLE rates ADD COLUMN weekly_rate DECIMAL(10,2);
ALTER TABLE rates ADD COLUMN annual_rate DECIMAL(12,2);
ALTER TABLE rates ADD COLUMN overtime_multiplier DECIMAL(3,2) DEFAULT 1.5;
ALTER TABLE rates ADD COLUMN required_skills JSON; -- Array of skill requirements
ALTER TABLE rates ADD COLUMN required_certifications JSON; -- Array of certifications
ALTER TABLE rates ADD COLUMN minimum_experience_years INTEGER;
ALTER TABLE rates ADD COLUMN security_clearance_required BOOLEAN DEFAULT FALSE;
ALTER TABLE rates ADD COLUMN remote_work_allowed BOOLEAN DEFAULT TRUE;
ALTER TABLE rates ADD COLUMN travel_percentage INTEGER DEFAULT 0;
ALTER TABLE rates ADD COLUMN rate_type VARCHAR(20) DEFAULT 'standard'; -- 'standard', 'premium', 'discount'
ALTER TABLE rates ADD COLUMN effective_start_date DATE;
ALTER TABLE rates ADD COLUMN effective_end_date DATE;
ALTER TABLE rates ADD COLUMN markup_percentage DECIMAL(5,2);
ALTER TABLE rates ADD COLUMN cost_rate DECIMAL(10,2); -- Internal cost for margin calculation

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_rates_seniority_level ON rates(seniority_level);
CREATE INDEX IF NOT EXISTS idx_rates_rate_type ON rates(rate_type);
CREATE INDEX IF NOT EXISTS idx_rates_effective_dates ON rates(effective_start_date, effective_end_date);
CREATE INDEX IF NOT EXISTS idx_rates_experience ON rates(minimum_experience_years);
CREATE INDEX IF NOT EXISTS idx_rates_remote_work ON rates(remote_work_allowed);

-- ============================================================================
-- LINE OF SERVICE TAXONOMY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS line_of_service_taxonomy (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    service_category VARCHAR(50) NOT NULL, -- 'Technology', 'Consulting', 'Creative', 'Operations'
    subcategory VARCHAR(100),
    description TEXT,
    typical_roles JSON, -- Array of common roles
    skill_domains JSON, -- Array of skill areas
    market_segment VARCHAR(50), -- 'Enterprise', 'SMB', 'Government'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, service_name)
);

CREATE INDEX IF NOT EXISTS idx_los_taxonomy_tenant ON line_of_service_taxonomy(tenant_id);
CREATE INDEX IF NOT EXISTS idx_los_taxonomy_category ON line_of_service_taxonomy(service_category);
CREATE INDEX IF NOT EXISTS idx_los_taxonomy_service_name ON line_of_service_taxonomy(service_name);
CREATE INDEX IF NOT EXISTS idx_los_taxonomy_market_segment ON line_of_service_taxonomy(market_segment);

-- ============================================================================
-- SENIORITY DEFINITIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS seniority_definitions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    level_name VARCHAR(50) NOT NULL,
    level_order INTEGER NOT NULL, -- 1=Junior, 2=Mid-Level, 3=Senior, etc.
    min_experience_years INTEGER,
    max_experience_years INTEGER,
    typical_responsibilities JSON,
    skill_expectations JSON,
    leadership_scope VARCHAR(100),
    decision_authority VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, level_name)
);

CREATE INDEX IF NOT EXISTS idx_seniority_definitions_tenant ON seniority_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seniority_definitions_level_order ON seniority_definitions(level_order);
CREATE INDEX IF NOT EXISTS idx_seniority_definitions_level_name ON seniority_definitions(level_name);

-- ============================================================================
-- GEOGRAPHIC ADJUSTMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS geographic_adjustments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    country VARCHAR(3) NOT NULL,
    state_province VARCHAR(100),
    city VARCHAR(100),
    cost_of_living_index DECIMAL(5,2) NOT NULL, -- Base 100
    currency_code VARCHAR(3) NOT NULL,
    tax_implications JSON,
    labor_market_conditions JSON,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_source VARCHAR(100),
    UNIQUE(country, state_province, city)
);

CREATE INDEX IF NOT EXISTS idx_geographic_adjustments_country ON geographic_adjustments(country);
CREATE INDEX IF NOT EXISTS idx_geographic_adjustments_currency ON geographic_adjustments(currency_code);
CREATE INDEX IF NOT EXISTS idx_geographic_adjustments_cost_index ON geographic_adjustments(cost_of_living_index);

-- ============================================================================
-- SKILLS REGISTRY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS skills_registry (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    skill_name VARCHAR(100) NOT NULL,
    skill_category VARCHAR(50) NOT NULL, -- 'Technical', 'Soft', 'Domain'
    skill_level VARCHAR(20), -- 'Basic', 'Intermediate', 'Advanced', 'Expert'
    market_demand VARCHAR(20), -- 'Low', 'Medium', 'High', 'Critical'
    premium_factor DECIMAL(3,2) DEFAULT 1.0, -- Rate multiplier for this skill
    certifying_bodies JSON,
    related_skills JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(skill_name, skill_level)
);

CREATE INDEX IF NOT EXISTS idx_skills_registry_name ON skills_registry(skill_name);
CREATE INDEX IF NOT EXISTS idx_skills_registry_category ON skills_registry(skill_category);
CREATE INDEX IF NOT EXISTS idx_skills_registry_demand ON skills_registry(market_demand);
CREATE INDEX IF NOT EXISTS idx_skills_registry_premium ON skills_registry(premium_factor DESC);

-- ============================================================================
-- CERTIFICATIONS REGISTRY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS certifications_registry (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    certification_name VARCHAR(200) NOT NULL,
    issuing_organization VARCHAR(100) NOT NULL,
    certification_level VARCHAR(50),
    validity_period_months INTEGER,
    renewal_requirements TEXT,
    market_value VARCHAR(20), -- 'Low', 'Medium', 'High', 'Premium'
    premium_factor DECIMAL(3,2) DEFAULT 1.0,
    related_skills JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(certification_name, issuing_organization)
);

CREATE INDEX IF NOT EXISTS idx_certifications_registry_name ON certifications_registry(certification_name);
CREATE INDEX IF NOT EXISTS idx_certifications_registry_org ON certifications_registry(issuing_organization);
CREATE INDEX IF NOT EXISTS idx_certifications_registry_value ON certifications_registry(market_value);
CREATE INDEX IF NOT EXISTS idx_certifications_registry_premium ON certifications_registry(premium_factor DESC);

-- ============================================================================
-- RATE APPROVAL WORKFLOW TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_approval_workflow (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rate_card_id TEXT NOT NULL,
    workflow_step INTEGER NOT NULL,
    approver_role VARCHAR(100) NOT NULL,
    required_approver TEXT, -- Specific person if needed
    approval_threshold DECIMAL(10,2), -- Rate threshold requiring this approval
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_by TEXT,
    approved_at DATETIME,
    rejection_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rate_card_id) REFERENCES rate_cards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rate_approval_workflow_rate_card ON rate_approval_workflow(rate_card_id);
CREATE INDEX IF NOT EXISTS idx_rate_approval_workflow_status ON rate_approval_workflow(status);
CREATE INDEX IF NOT EXISTS idx_rate_approval_workflow_step ON rate_approval_workflow(workflow_step);

-- ============================================================================
-- RATE CHANGE HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_change_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rate_id TEXT NOT NULL,
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_reason VARCHAR(200),
    changed_by TEXT NOT NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approval_required BOOLEAN DEFAULT FALSE,
    approved_by TEXT,
    approved_at DATETIME,
    FOREIGN KEY (rate_id) REFERENCES rates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rate_change_history_rate_id ON rate_change_history(rate_id);
CREATE INDEX IF NOT EXISTS idx_rate_change_history_changed_at ON rate_change_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_change_history_changed_by ON rate_change_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_rate_change_history_field ON rate_change_history(field_name);

-- ============================================================================
-- ENHANCED VIEWS
-- ============================================================================

-- Enhanced rate cards view with all related data
CREATE VIEW IF NOT EXISTS enhanced_rate_cards_view AS
SELECT 
    rc.*,
    los.service_category,
    los.subcategory as service_subcategory,
    ga.cost_of_living_index as location_cost_index,
    ga.currency_code as location_currency,
    COUNT(r.id) as total_rates,
    AVG(r.hourly_rate) as avg_hourly_rate,
    MIN(r.hourly_rate) as min_hourly_rate,
    MAX(r.hourly_rate) as max_hourly_rate
FROM rate_cards rc
LEFT JOIN line_of_service_taxonomy los ON rc.line_of_service = los.service_name AND rc.tenant_id = los.tenant_id
LEFT JOIN geographic_adjustments ga ON rc.country = ga.country AND rc.state_province = ga.state_province AND rc.city = ga.city
LEFT JOIN rates r ON rc.id = r.rate_card_id
GROUP BY rc.id;

-- Enhanced rates view with seniority and skill information
CREATE VIEW IF NOT EXISTS enhanced_rates_view AS
SELECT 
    r.*,
    rc.line_of_service,
    rc.country,
    rc.engagement_model,
    sd.level_order as seniority_order,
    sd.min_experience_years as seniority_min_exp,
    sd.max_experience_years as seniority_max_exp,
    CASE 
        WHEN r.daily_rate IS NOT NULL THEN r.daily_rate
        WHEN r.hourly_rate IS NOT NULL THEN r.hourly_rate * 8
        ELSE NULL
    END as calculated_daily_rate,
    CASE 
        WHEN r.hourly_rate IS NOT NULL THEN r.hourly_rate
        WHEN r.daily_rate IS NOT NULL THEN r.daily_rate / 8
        ELSE NULL
    END as calculated_hourly_rate
FROM rates r
JOIN rate_cards rc ON r.rate_card_id = rc.id
LEFT JOIN seniority_definitions sd ON r.seniority_level = sd.level_name AND rc.tenant_id = sd.tenant_id;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC CALCULATIONS
-- ============================================================================

-- Trigger to automatically calculate equivalent rates
CREATE TRIGGER IF NOT EXISTS calculate_equivalent_rates
AFTER INSERT ON rates
WHEN NEW.hourly_rate IS NOT NULL AND NEW.daily_rate IS NULL
BEGIN
    UPDATE rates 
    SET daily_rate = NEW.hourly_rate * 8,
        weekly_rate = NEW.hourly_rate * 40,
        monthly_rate = NEW.hourly_rate * 160,
        annual_rate = NEW.hourly_rate * 2080
    WHERE id = NEW.id;
END;

-- Trigger to calculate rates from daily rate
CREATE TRIGGER IF NOT EXISTS calculate_from_daily_rate
AFTER INSERT ON rates
WHEN NEW.daily_rate IS NOT NULL AND NEW.hourly_rate IS NULL
BEGIN
    UPDATE rates 
    SET hourly_rate = NEW.daily_rate / 8,
        weekly_rate = NEW.daily_rate * 5,
        monthly_rate = NEW.daily_rate * 20,
        annual_rate = NEW.daily_rate * 260
    WHERE id = NEW.id;
END;

-- Trigger to update rate change history
CREATE TRIGGER IF NOT EXISTS track_rate_changes
AFTER UPDATE ON rates
FOR EACH ROW
WHEN OLD.hourly_rate != NEW.hourly_rate OR OLD.daily_rate != NEW.daily_rate
BEGIN
    INSERT INTO rate_change_history (rate_id, field_name, old_value, new_value, changed_by, change_reason)
    VALUES (NEW.id, 'hourly_rate', OLD.hourly_rate, NEW.hourly_rate, 'system', 'Rate update');
END;

-- ============================================================================
-- INITIAL DATA CONSTRAINTS
-- ============================================================================

-- Add check constraints for data integrity
-- Note: SQLite doesn't support adding constraints to existing tables, so these would be for new installations

-- Ensure seniority levels are valid
-- ALTER TABLE rates ADD CONSTRAINT chk_seniority_level 
-- CHECK (seniority_level IN ('Junior', 'Mid-Level', 'Senior', 'Lead', 'Principal', 'Director'));

-- Ensure engagement models are valid
-- ALTER TABLE rate_cards ADD CONSTRAINT chk_engagement_model 
-- CHECK (engagement_model IN ('Staff Augmentation', 'Project', 'Outcome'));

-- Ensure rate types are valid
-- ALTER TABLE rates ADD CONSTRAINT chk_rate_type 
-- CHECK (rate_type IN ('standard', 'premium', 'discount'));

-- Ensure approval status is valid
-- ALTER TABLE rate_cards ADD CONSTRAINT chk_approval_status 
-- CHECK (approval_status IN ('pending', 'approved', 'rejected'));