-- Artifacts System Migration
-- Adds tables for artifact storage, validation, and cost savings

-- Artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('OVERVIEW', 'FINANCIAL', 'CLAUSES', 'RATES', 'COMPLIANCE', 'RISK')),
  data JSONB NOT NULL,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  completeness INTEGER CHECK (completeness >= 0 AND completeness <= 100),
  validation_result JSONB,
  method VARCHAR(20) CHECK (method IN ('ai', 'hybrid', 'rule-based')),
  processing_time INTEGER,
  version INTEGER DEFAULT 1,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(contract_id, type, version)
);

CREATE INDEX idx_artifacts_contract ON artifacts(contract_id);
CREATE INDEX idx_artifacts_tenant ON artifacts(tenant_id);
CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_confidence ON artifacts(confidence);
CREATE INDEX idx_artifacts_created_at ON artifacts(created_at DESC);

-- Cost Savings Opportunities table
CREATE TABLE IF NOT EXISTS cost_savings_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('rate_optimization', 'payment_terms', 'volume_discount', 'supplier_consolidation', 'contract_optimization')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  potential_savings_amount DECIMAL(15,2) NOT NULL,
  potential_savings_currency VARCHAR(3) DEFAULT 'USD',
  potential_savings_percentage DECIMAL(5,2),
  potential_savings_timeframe VARCHAR(20) CHECK (potential_savings_timeframe IN ('monthly', 'quarterly', 'annual')),
  confidence VARCHAR(20) CHECK (confidence IN ('low', 'medium', 'high')),
  effort VARCHAR(20) CHECK (effort IN ('low', 'medium', 'high')),
  priority INTEGER CHECK (priority >= 1 AND priority <= 5),
  action_items JSONB,
  implementation_timeline VARCHAR(100),
  risks JSONB,
  status VARCHAR(50) DEFAULT 'identified' CHECK (status IN ('identified', 'in_progress', 'implemented', 'rejected', 'deferred')),
  tracked_at TIMESTAMP,
  implemented_at TIMESTAMP,
  realized_savings DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cost_savings_contract ON cost_savings_opportunities(contract_id);
CREATE INDEX idx_cost_savings_tenant ON cost_savings_opportunities(tenant_id);
CREATE INDEX idx_cost_savings_category ON cost_savings_opportunities(category);
CREATE INDEX idx_cost_savings_status ON cost_savings_opportunities(status);
CREATE INDEX idx_cost_savings_priority ON cost_savings_opportunities(priority DESC);
CREATE INDEX idx_cost_savings_amount ON cost_savings_opportunities(potential_savings_amount DESC);

-- Validation Issues table
CREATE TABLE IF NOT EXISTS validation_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  field VARCHAR(255) NOT NULL,
  rule VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  message TEXT NOT NULL,
  auto_fixable BOOLEAN DEFAULT FALSE,
  fixed BOOLEAN DEFAULT FALSE,
  fixed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_validation_artifact ON validation_issues(artifact_id);
CREATE INDEX idx_validation_severity ON validation_issues(severity);
CREATE INDEX idx_validation_fixed ON validation_issues(fixed);

-- Artifact Generation Metrics table
CREATE TABLE IF NOT EXISTS artifact_generation_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  artifact_type VARCHAR(50) NOT NULL,
  method VARCHAR(20),
  processing_time INTEGER,
  confidence DECIMAL(3,2),
  completeness INTEGER,
  success BOOLEAN,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_metrics_contract ON artifact_generation_metrics(contract_id);
CREATE INDEX idx_metrics_tenant ON artifact_generation_metrics(tenant_id);
CREATE INDEX idx_metrics_type ON artifact_generation_metrics(artifact_type);
CREATE INDEX idx_metrics_success ON artifact_generation_metrics(success);
CREATE INDEX idx_metrics_created_at ON artifact_generation_metrics(created_at DESC);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_artifacts_updated_at BEFORE UPDATE ON artifacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cost_savings_updated_at BEFORE UPDATE ON cost_savings_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE artifacts IS 'Stores generated contract artifacts with validation and confidence scores';
COMMENT ON TABLE cost_savings_opportunities IS 'Tracks cost savings opportunities identified from contract analysis';
COMMENT ON TABLE validation_issues IS 'Records validation issues found in artifacts';
COMMENT ON TABLE artifact_generation_metrics IS 'Tracks performance metrics for artifact generation';
