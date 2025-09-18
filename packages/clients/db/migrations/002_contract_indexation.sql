-- Enhanced Contract Indexation System
-- Comprehensive metadata extraction and search capabilities

-- Contract metadata table for advanced indexation
CREATE TABLE IF NOT EXISTS contract_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES "Contract"(id) ON DELETE CASCADE,
  
  -- Basic Information
  title VARCHAR(500),
  contract_type VARCHAR(100), -- MSA, SOW, NDA, SLA, etc.
  category VARCHAR(100), -- Technology, Legal, Finance, etc.
  subcategory VARCHAR(100),
  
  -- Parties Information
  client_name VARCHAR(255),
  client_type VARCHAR(100), -- Corporation, LLC, Individual, etc.
  vendor_name VARCHAR(255),
  vendor_type VARCHAR(100),
  
  -- Financial Details
  total_value DECIMAL(15,2),
  currency VARCHAR(10) DEFAULT 'USD',
  payment_terms VARCHAR(100), -- Net 30, Net 45, etc.
  billing_frequency VARCHAR(50), -- Monthly, Quarterly, Annual, etc.
  
  -- Timeline Information
  effective_date DATE,
  expiration_date DATE,
  renewal_date DATE,
  notice_period_days INTEGER,
  auto_renewal BOOLEAN DEFAULT false,
  
  -- Legal & Compliance
  governing_law VARCHAR(100),
  jurisdiction VARCHAR(100),
  liability_cap DECIMAL(15,2),
  has_indemnification BOOLEAN DEFAULT false,
  has_confidentiality BOOLEAN DEFAULT false,
  has_ip_clause BOOLEAN DEFAULT false,
  
  -- Risk & Compliance Scores
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  compliance_score INTEGER CHECK (compliance_score >= 0 AND compliance_score <= 100),
  
  -- Status & Workflow
  status VARCHAR(50) DEFAULT 'active', -- active, expired, terminated, pending
  approval_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  workflow_stage VARCHAR(100),
  
  -- Document Properties
  page_count INTEGER,
  word_count INTEGER,
  language VARCHAR(10) DEFAULT 'en',
  document_format VARCHAR(20), -- PDF, DOCX, etc.
  
  -- AI Analysis Results
  template_match_score DECIMAL(5,2),
  complexity_score INTEGER CHECK (complexity_score >= 1 AND complexity_score <= 10),
  readability_score DECIMAL(5,2),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_reviewed_at TIMESTAMP,
  
  -- Full-text search
  search_vector tsvector
);

-- Contract tags for flexible categorization
CREATE TABLE IF NOT EXISTS contract_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES "Contract"(id) ON DELETE CASCADE,
  tag_name VARCHAR(100) NOT NULL,
  tag_category VARCHAR(50), -- system, user, ai-generated
  confidence_score DECIMAL(3,2), -- For AI-generated tags
  created_by UUID, -- User who added the tag
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(contract_id, tag_name)
);

-- Contract relationships (amendments, renewals, etc.)
CREATE TABLE IF NOT EXISTS contract_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_contract_id UUID REFERENCES "Contract"(id) ON DELETE CASCADE,
  child_contract_id UUID REFERENCES "Contract"(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50), -- amendment, renewal, termination, supersedes
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Key contract clauses for detailed indexation
CREATE TABLE IF NOT EXISTS contract_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES "Contract"(id) ON DELETE CASCADE,
  clause_type VARCHAR(100), -- termination, payment, liability, etc.
  clause_title VARCHAR(255),
  clause_text TEXT,
  page_number INTEGER,
  section_number VARCHAR(20),
  risk_level VARCHAR(20), -- low, medium, high
  compliance_status VARCHAR(50), -- compliant, non-compliant, needs-review
  ai_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Contract milestones and important dates
CREATE TABLE IF NOT EXISTS contract_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES "Contract"(id) ON DELETE CASCADE,
  milestone_type VARCHAR(100), -- renewal, review, payment, deliverable
  milestone_name VARCHAR(255),
  due_date DATE,
  completed_date DATE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, overdue
  description TEXT,
  reminder_days INTEGER DEFAULT 30,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Contract performance metrics
CREATE TABLE IF NOT EXISTS contract_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES "Contract"(id) ON DELETE CASCADE,
  metric_name VARCHAR(100), -- sla_compliance, payment_timeliness, etc.
  metric_value DECIMAL(10,2),
  metric_unit VARCHAR(50),
  measurement_date DATE,
  target_value DECIMAL(10,2),
  status VARCHAR(50), -- on-track, at-risk, breach
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contract_metadata_contract_id ON contract_metadata(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_metadata_type ON contract_metadata(contract_type);
CREATE INDEX IF NOT EXISTS idx_contract_metadata_status ON contract_metadata(status);
CREATE INDEX IF NOT EXISTS idx_contract_metadata_expiration ON contract_metadata(expiration_date);
CREATE INDEX IF NOT EXISTS idx_contract_metadata_value ON contract_metadata(total_value);
CREATE INDEX IF NOT EXISTS idx_contract_metadata_risk ON contract_metadata(risk_score);
CREATE INDEX IF NOT EXISTS idx_contract_metadata_search ON contract_metadata USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_contract_tags_contract_id ON contract_tags(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_tags_name ON contract_tags(tag_name);

CREATE INDEX IF NOT EXISTS idx_contract_clauses_contract_id ON contract_clauses(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_clauses_type ON contract_clauses(clause_type);
CREATE INDEX IF NOT EXISTS idx_contract_clauses_risk ON contract_clauses(risk_level);

CREATE INDEX IF NOT EXISTS idx_contract_milestones_contract_id ON contract_milestones(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_milestones_due_date ON contract_milestones(due_date);
CREATE INDEX IF NOT EXISTS idx_contract_milestones_status ON contract_milestones(status);

-- Full-text search function
CREATE OR REPLACE FUNCTION update_contract_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.client_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.vendor_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.contract_type, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.governing_law, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.status, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic search vector updates
DROP TRIGGER IF EXISTS update_contract_metadata_search_vector ON contract_metadata;
CREATE TRIGGER update_contract_metadata_search_vector
  BEFORE INSERT OR UPDATE ON contract_metadata
  FOR EACH ROW EXECUTE FUNCTION update_contract_search_vector();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contract_metadata_updated_at ON contract_metadata;
CREATE TRIGGER update_contract_metadata_updated_at
  BEFORE UPDATE ON contract_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE OR REPLACE VIEW contract_summary AS
SELECT 
  c.id,
  c.name,
  c.status as contract_status,
  cm.title,
  cm.contract_type,
  cm.client_name,
  cm.vendor_name,
  cm.total_value,
  cm.currency,
  cm.effective_date,
  cm.expiration_date,
  cm.risk_score,
  cm.compliance_score,
  cm.status as metadata_status,
  c."createdAt" as created_at,
  cm.updated_at as metadata_updated_at
FROM "Contract" c
LEFT JOIN contract_metadata cm ON c.id = cm.contract_id;

-- View for expiring contracts
CREATE OR REPLACE VIEW expiring_contracts AS
SELECT 
  cs.*,
  EXTRACT(days FROM (cm.expiration_date - CURRENT_DATE)) as days_until_expiration
FROM contract_summary cs
JOIN contract_metadata cm ON cs.id = cm.contract_id
WHERE cm.expiration_date IS NOT NULL 
  AND cm.expiration_date > CURRENT_DATE
  AND cm.expiration_date <= CURRENT_DATE + INTERVAL '90 days'
ORDER BY cm.expiration_date ASC;

-- View for high-risk contracts
CREATE OR REPLACE VIEW high_risk_contracts AS
SELECT cs.*
FROM contract_summary cs
JOIN contract_metadata cm ON cs.id = cm.contract_id
WHERE cm.risk_score >= 70
ORDER BY cm.risk_score DESC;

-- Sample data for demonstration (only if no contracts exist)
DO $$
DECLARE
    contract_count INTEGER;
    sample_contract_id UUID;
BEGIN
    SELECT COUNT(*) INTO contract_count FROM "Contract";
    
    IF contract_count = 0 THEN
        -- Insert a sample contract first
        INSERT INTO "Contract" (id, name, status, "tenantId", "createdAt", "updatedAt")
        VALUES (
            gen_random_uuid(),
            'Sample Master Service Agreement',
            'ACTIVE',
            (SELECT id FROM "Tenant" LIMIT 1),
            NOW(),
            NOW()
        ) RETURNING id INTO sample_contract_id;
        
        -- Insert sample metadata
        INSERT INTO contract_metadata (
          contract_id, title, contract_type, category, client_name, vendor_name,
          total_value, currency, payment_terms, effective_date, expiration_date,
          governing_law, risk_score, compliance_score, status
        ) VALUES (
          sample_contract_id,
          'Master Service Agreement - Technology Services',
          'MSA',
          'Technology',
          'TechCorp Inc.',
          'ServiceProvider LLC',
          2400000.00,
          'USD',
          'Net 30',
          '2024-01-01',
          '2025-12-31',
          'California',
          25,
          94,
          'active'
        );
        
        -- Add some sample tags
        INSERT INTO contract_tags (contract_id, tag_name, tag_category, confidence_score)
        VALUES 
          (sample_contract_id, 'technology', 'ai-generated', 0.95),
          (sample_contract_id, 'high-value', 'ai-generated', 0.90),
          (sample_contract_id, 'multi-year', 'ai-generated', 0.85),
          (sample_contract_id, 'msa', 'system', 1.0);
    END IF;
END $$;