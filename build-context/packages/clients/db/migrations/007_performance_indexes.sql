-- Migration 007: Performance Indexes
-- Add critical indexes for query optimization

-- Contracts table indexes
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_status 
  ON contracts(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_contracts_tenant_upload_date 
  ON contracts(tenant_id, upload_date DESC);

CREATE INDEX IF NOT EXISTS idx_contracts_status_upload_date 
  ON contracts(status, upload_date DESC);

CREATE INDEX IF NOT EXISTS idx_contracts_filename 
  ON contracts(filename);

CREATE INDEX IF NOT EXISTS idx_contracts_original_name 
  ON contracts(original_name);

-- Parties table indexes
CREATE INDEX IF NOT EXISTS idx_parties_contract_id 
  ON parties(contract_id);

CREATE INDEX IF NOT EXISTS idx_parties_name 
  ON parties(name);

CREATE INDEX IF NOT EXISTS idx_parties_role 
  ON parties(role);

-- Clauses table indexes
CREATE INDEX IF NOT EXISTS idx_clauses_contract_id 
  ON clauses(contract_id);

CREATE INDEX IF NOT EXISTS idx_clauses_category 
  ON clauses(category);

CREATE INDEX IF NOT EXISTS idx_clauses_risk_level 
  ON clauses(risk_level);

-- Contract artifacts indexes
CREATE INDEX IF NOT EXISTS idx_artifacts_contract_id 
  ON contract_artifacts(contract_id);

CREATE INDEX IF NOT EXISTS idx_artifacts_type 
  ON contract_artifacts(artifact_type);

-- Processing jobs indexes
CREATE INDEX IF NOT EXISTS idx_processing_jobs_contract_id 
  ON processing_jobs(contract_id);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_status 
  ON processing_jobs(status);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_tenant_status 
  ON processing_jobs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at 
  ON processing_jobs(created_at DESC);

-- Full-text search indexes (if not already created)
CREATE INDEX IF NOT EXISTS idx_contracts_fulltext 
  ON contracts USING gin(to_tsvector('english', 
    COALESCE(filename, '') || ' ' || 
    COALESCE(original_name, '') || ' ' || 
    COALESCE(extracted_text, '')
  ));

CREATE INDEX IF NOT EXISTS idx_clauses_fulltext 
  ON clauses USING gin(to_tsvector('english', 
    COALESCE(text, '') || ' ' || 
    COALESCE(category, '')
  ));

-- Vector search indexes (if not already created)
CREATE INDEX IF NOT EXISTS idx_contracts_embedding 
  ON contracts USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_status_date 
  ON contracts(tenant_id, status, upload_date DESC);

CREATE INDEX IF NOT EXISTS idx_parties_contract_role 
  ON parties(contract_id, role);

-- Add statistics for query planner
ANALYZE contracts;
ANALYZE parties;
ANALYZE clauses;
ANALYZE contract_artifacts;
ANALYZE processing_jobs;

-- Comments
COMMENT ON INDEX idx_contracts_tenant_status IS 'Optimize tenant + status queries';
COMMENT ON INDEX idx_contracts_tenant_upload_date IS 'Optimize tenant + date sorting';
COMMENT ON INDEX idx_contracts_fulltext IS 'Full-text search on contracts';
COMMENT ON INDEX idx_contracts_embedding IS 'Vector similarity search';
