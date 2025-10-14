-- Analytical Intelligence Database Schema Migration
-- This migration adds all tables needed for the analytical intelligence layer

-- ============================================================================
-- RATE CARD BENCHMARKING TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_cards (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    contract_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    effective_date DATETIME NOT NULL,
    currency VARCHAR(3) NOT NULL,
    region VARCHAR(100) NOT NULL,
    delivery_model VARCHAR(50) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rate_cards_contract_id ON rate_cards(contract_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_supplier_id ON rate_cards(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_tenant_effective ON rate_cards(tenant_id, effective_date);

CREATE TABLE IF NOT EXISTS rates (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rate_card_id TEXT NOT NULL,
    role VARCHAR(200) NOT NULL,
    level VARCHAR(100),
    hourly_rate DECIMAL(10,2),
    daily_rate DECIMAL(10,2),
    monthly_rate DECIMAL(10,2),
    billable_hours INTEGER DEFAULT 8,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rate_card_id) REFERENCES rate_cards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rates_rate_card_id ON rates(rate_card_id);
CREATE INDEX IF NOT EXISTS idx_rates_role_level ON rates(role, level);

CREATE TABLE IF NOT EXISTS benchmarks (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    cohort_hash VARCHAR(64) UNIQUE NOT NULL,
    tenant_id TEXT NOT NULL,
    role VARCHAR(200) NOT NULL,
    level VARCHAR(100),
    region VARCHAR(100) NOT NULL,
    delivery_model VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    p25 DECIMAL(10,2) NOT NULL,
    p50 DECIMAL(10,2) NOT NULL,
    p75 DECIMAL(10,2) NOT NULL,
    p90 DECIMAL(10,2) NOT NULL,
    mean DECIMAL(10,2) NOT NULL,
    std_dev DECIMAL(10,2) NOT NULL,
    sample_size INTEGER NOT NULL,
    confidence DECIMAL(5,2) NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_tenant_id ON benchmarks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_benchmarks_cohort ON benchmarks(role, level, region, delivery_model);
CREATE INDEX IF NOT EXISTS idx_benchmarks_cohort_hash ON benchmarks(cohort_hash);

-- ============================================================================
-- RENEWAL RADAR TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS renewal_alerts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    contract_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    due_date DATETIME NOT NULL,
    days_until_due INTEGER NOT NULL,
    priority VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at DATETIME,
    actioned_at DATETIME,
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_renewal_alerts_contract_id ON renewal_alerts(contract_id);
CREATE INDEX IF NOT EXISTS idx_renewal_alerts_tenant_due_date ON renewal_alerts(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_renewal_alerts_priority_status ON renewal_alerts(tenant_id, priority, status);

-- ============================================================================
-- COMPLIANCE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS compliance_policies (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    clause_type VARCHAR(50) NOT NULL,
    requirement VARCHAR(10) NOT NULL,
    weight DECIMAL(3,2) NOT NULL,
    template TEXT,
    validation_rules JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compliance_policies_tenant_id ON compliance_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_policies_clause_type ON compliance_policies(tenant_id, clause_type);

CREATE TABLE IF NOT EXISTS compliance_scores (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    contract_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    overall_score DECIMAL(5,2) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    clause_scores JSON NOT NULL,
    recommendations JSON,
    last_assessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_compliance_scores_contract_id ON compliance_scores(contract_id);
CREATE INDEX IF NOT EXISTS idx_compliance_scores_risk_level ON compliance_scores(tenant_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_compliance_scores_assessed ON compliance_scores(tenant_id, last_assessed);

-- ============================================================================
-- SUPPLIER INTELLIGENCE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplier_intelligence (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    supplier_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    financial_health DECIMAL(5,2),
    performance_score DECIMAL(5,2),
    risk_score DECIMAL(5,2),
    compliance_score DECIMAL(5,2),
    relationship_metrics JSON,
    external_data JSON,
    ai_summary TEXT,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_intelligence_supplier_id ON supplier_intelligence(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_intelligence_tenant_id ON supplier_intelligence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_intelligence_updated ON supplier_intelligence(tenant_id, last_updated);

-- ============================================================================
-- SPEND OVERLAY TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS spend_data (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    supplier_id TEXT,
    category VARCHAR(200) NOT NULL,
    cost_center VARCHAR(100),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    period VARCHAR(20) NOT NULL,
    po_reference VARCHAR(100),
    description TEXT,
    source VARCHAR(50) NOT NULL,
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_spend_data_tenant_id ON spend_data(tenant_id);
CREATE INDEX IF NOT EXISTS idx_spend_data_supplier_period ON spend_data(supplier_id, period);
CREATE INDEX IF NOT EXISTS idx_spend_data_category_period ON spend_data(tenant_id, category, period);

CREATE TABLE IF NOT EXISTS spend_analysis (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    supplier_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    period VARCHAR(20) NOT NULL,
    contracted_spend DECIMAL(12,2),
    actual_spend DECIMAL(12,2) NOT NULL,
    variance DECIMAL(12,2) NOT NULL,
    variance_percentage DECIMAL(5,2) NOT NULL,
    leakage_amount DECIMAL(12,2),
    utilization_rate DECIMAL(5,2),
    analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, tenant_id, period)
);

CREATE INDEX IF NOT EXISTS idx_spend_analysis_supplier_id ON spend_analysis(supplier_id);
CREATE INDEX IF NOT EXISTS idx_spend_analysis_tenant_period ON spend_analysis(tenant_id, period);
CREATE INDEX IF NOT EXISTS idx_spend_analysis_analyzed ON spend_analysis(tenant_id, analyzed_at);

-- ============================================================================
-- NATURAL LANGUAGE QUERY TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS query_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    session_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    query TEXT NOT NULL,
    response JSON NOT NULL,
    confidence DECIMAL(5,2),
    response_time INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_query_history_session ON query_history(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_query_history_tenant ON query_history(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_query_history_user ON query_history(user_id, created_at);