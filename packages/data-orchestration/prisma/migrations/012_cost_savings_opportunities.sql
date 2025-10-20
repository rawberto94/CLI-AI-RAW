-- Migration: Add Cost Savings Opportunities Tracking
-- Description: Adds tables and columns for tracking cost savings opportunities identified in artifacts

-- Add cost savings columns to artifacts table
ALTER TABLE artifacts 
ADD COLUMN IF NOT EXISTS cost_savings_data JSONB,
ADD COLUMN IF NOT EXISTS cost_savings_total DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_savings_count INTEGER DEFAULT 0;

-- Create cost savings opportunities table
CREATE TABLE IF NOT EXISTS cost_savings_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  
  -- Opportunity details
  category VARCHAR(50) NOT NULL, -- rate_optimization, payment_terms, volume_discount, supplier_consolidation, contract_optimization
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Savings potential
  potential_savings_amount DECIMAL(15,2) NOT NULL,
  potential_savings_currency VARCHAR(3) DEFAULT 'USD',
  potential_savings_percentage DECIMAL(5,2),
  timeframe VARCHAR(20), -- monthly, quarterly, annual
  
  -- Assessment
  confidence VARCHAR(20) NOT NULL, -- low, medium, high
  effort VARCHAR(20) NOT NULL, -- low, medium, high
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  
  -- Implementation details
  action_items JSONB DEFAULT '[]'::jsonb,
  implementation_timeline VARCHAR(100),
  risks JSONB DEFAULT '[]'::jsonb,
  
  -- Tracking
  status VARCHAR(20) DEFAULT 'identified' CHECK (status IN ('identified', 'in_progress', 'implemented', 'rejected')),
  implemented_at TIMESTAMP,
  actual_savings DECIMAL(15,2),
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cost_savings_contract ON cost_savings_opportunities(contract_id);
CREATE INDEX IF NOT EXISTS idx_cost_savings_artifact ON cost_savings_opportunities(artifact_id);
CREATE INDEX IF NOT EXISTS idx_cost_savings_tenant ON cost_savings_opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_savings_status ON cost_savings_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_cost_savings_category ON cost_savings_opportunities(category);
CREATE INDEX IF NOT EXISTS idx_cost_savings_confidence ON cost_savings_opportunities(confidence);
CREATE INDEX IF NOT EXISTS idx_cost_savings_amount ON cost_savings_opportunities(potential_savings_amount DESC);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_cost_savings_tenant_status ON cost_savings_opportunities(tenant_id, status);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cost_savings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cost_savings_updated_at
  BEFORE UPDATE ON cost_savings_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_cost_savings_updated_at();

-- Add comments for documentation
COMMENT ON TABLE cost_savings_opportunities IS 'Tracks cost savings opportunities identified from contract artifacts';
COMMENT ON COLUMN cost_savings_opportunities.category IS 'Type of savings opportunity: rate_optimization, payment_terms, volume_discount, supplier_consolidation, contract_optimization';
COMMENT ON COLUMN cost_savings_opportunities.confidence IS 'Confidence level in the savings estimate: low, medium, high';
COMMENT ON COLUMN cost_savings_opportunities.effort IS 'Estimated effort to implement: low, medium, high';
COMMENT ON COLUMN cost_savings_opportunities.priority IS 'Priority ranking from 1 (lowest) to 5 (highest)';
COMMENT ON COLUMN cost_savings_opportunities.status IS 'Current status: identified, in_progress, implemented, rejected';
