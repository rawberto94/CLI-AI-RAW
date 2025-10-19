-- Migration 006: Artifact Versioning Schema
-- Adds versioning support to artifacts with history tracking

-- Create artifact_versions table
CREATE TABLE IF NOT EXISTS artifact_versions (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  schema_version TEXT NOT NULL DEFAULT 'v1',
  hash TEXT,
  confidence DECIMAL(3, 2),
  processing_time INTEGER,
  size INTEGER,
  
  -- Version metadata
  parent_version_id TEXT,
  change_summary TEXT,
  change_reason TEXT,
  changed_fields JSONB DEFAULT '[]'::jsonb,
  
  -- Audit fields
  created_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT false,
  superseded_at TIMESTAMP,
  superseded_by TEXT,
  
  -- Foreign keys
  CONSTRAINT fk_artifact_version_artifact FOREIGN KEY (artifact_id) 
    REFERENCES "Artifact"(id) ON DELETE CASCADE,
  CONSTRAINT fk_artifact_version_contract FOREIGN KEY (contract_id) 
    REFERENCES "Contract"(id) ON DELETE CASCADE,
  CONSTRAINT fk_artifact_version_parent FOREIGN KEY (parent_version_id) 
    REFERENCES artifact_versions(id) ON DELETE SET NULL,
  
  -- Unique constraint
  CONSTRAINT uq_artifact_version UNIQUE (artifact_id, version_number)
);

-- Create indexes for artifact_versions
CREATE INDEX IF NOT EXISTS idx_artifact_versions_artifact_id ON artifact_versions(artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_contract_id ON artifact_versions(contract_id);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_tenant_id ON artifact_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_type ON artifact_versions(type);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_is_active ON artifact_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_created_at ON artifact_versions(created_at);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_artifact_version ON artifact_versions(artifact_id, version_number);
CREATE INDEX IF NOT EXISTS idx_artifact_versions_tenant_type ON artifact_versions(tenant_id, type);

-- Add version tracking fields to Artifact table
ALTER TABLE "Artifact" 
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_version_id TEXT,
  ADD COLUMN IF NOT EXISTS is_latest BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- Create index for version tracking
CREATE INDEX IF NOT EXISTS idx_artifact_version ON "Artifact"(version);
CREATE INDEX IF NOT EXISTS idx_artifact_is_latest ON "Artifact"(is_latest);
CREATE INDEX IF NOT EXISTS idx_artifact_contract_type_latest ON "Artifact"(contract_id, type, is_latest);

-- Create function to auto-increment version number
CREATE OR REPLACE FUNCTION increment_artifact_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the max version for this artifact type and contract
  SELECT COALESCE(MAX(version), 0) + 1 INTO NEW.version
  FROM "Artifact"
  WHERE contract_id = NEW.contract_id AND type = NEW.type;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-versioning (optional, can be controlled by application)
-- Commented out by default to allow application-level control
-- CREATE TRIGGER trigger_artifact_version
-- BEFORE INSERT ON "Artifact"
-- FOR EACH ROW
-- EXECUTE FUNCTION increment_artifact_version();

-- Create view for latest artifact versions
CREATE OR REPLACE VIEW latest_artifacts AS
SELECT 
  a.*,
  av.version_number as latest_version_number,
  av.created_at as version_created_at,
  av.created_by as version_created_by
FROM "Artifact" a
LEFT JOIN artifact_versions av ON a.id = av.artifact_id AND av.is_active = true
WHERE a.is_latest = true;

-- Create view for artifact version history
CREATE OR REPLACE VIEW artifact_version_history AS
SELECT 
  av.id as version_id,
  av.artifact_id,
  av.contract_id,
  av.tenant_id,
  av.version_number,
  av.type,
  av.change_summary,
  av.change_reason,
  av.changed_fields,
  av.created_by,
  av.created_at,
  av.is_active,
  av.superseded_at,
  av.superseded_by,
  av.confidence,
  av.processing_time,
  a.id as current_artifact_id,
  a.version as current_version
FROM artifact_versions av
JOIN "Artifact" a ON av.artifact_id = a.id
ORDER BY av.contract_id, av.type, av.version_number DESC;

-- Add comments for documentation
COMMENT ON TABLE artifact_versions IS 'Stores historical versions of artifacts for audit and comparison';
COMMENT ON COLUMN artifact_versions.version_number IS 'Sequential version number for this artifact';
COMMENT ON COLUMN artifact_versions.change_summary IS 'Brief summary of what changed in this version';
COMMENT ON COLUMN artifact_versions.change_reason IS 'Reason for creating this version (e.g., manual correction, re-processing)';
COMMENT ON COLUMN artifact_versions.changed_fields IS 'Array of field paths that changed from previous version';
COMMENT ON COLUMN artifact_versions.is_active IS 'Whether this is the currently active version';
COMMENT ON COLUMN "Artifact".is_latest IS 'Whether this is the latest version of the artifact';
