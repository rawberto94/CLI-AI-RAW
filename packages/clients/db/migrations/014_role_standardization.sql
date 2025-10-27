-- Role Standardization Tables
-- Supports AI-powered role standardization with taxonomy and learning

-- Role Taxonomy: Master list of standardized roles
CREATE TABLE IF NOT EXISTS role_taxonomy (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  standardized_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  sub_category TEXT,
  aliases TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  industry TEXT,
  line_of_service TEXT,
  seniority_level TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Role Mappings: Track original to standardized role mappings
CREATE TABLE IF NOT EXISTS role_mappings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  original_role TEXT NOT NULL,
  standardized_role TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.70,
  source TEXT NOT NULL CHECK (source IN ('AI', 'USER_CORRECTION', 'MANUAL')),
  user_id TEXT,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_role_mappings_tenant FOREIGN KEY (tenant_id) 
    REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_taxonomy_category ON role_taxonomy(category);
CREATE INDEX IF NOT EXISTS idx_role_taxonomy_usage ON role_taxonomy(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_role_taxonomy_standardized_name ON role_taxonomy(standardized_name);

CREATE INDEX IF NOT EXISTS idx_role_mappings_tenant ON role_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_mappings_original ON role_mappings(original_role);
CREATE INDEX IF NOT EXISTS idx_role_mappings_standardized ON role_mappings(standardized_role);
CREATE INDEX IF NOT EXISTS idx_role_mappings_source ON role_mappings(source);
CREATE INDEX IF NOT EXISTS idx_role_mappings_tenant_original ON role_mappings(tenant_id, original_role);

-- GIN index for array searches
CREATE INDEX IF NOT EXISTS idx_role_taxonomy_aliases_gin ON role_taxonomy USING GIN(aliases);
CREATE INDEX IF NOT EXISTS idx_role_taxonomy_keywords_gin ON role_taxonomy USING GIN(keywords);

-- Seed initial taxonomy with common roles
INSERT INTO role_taxonomy (standardized_name, category, sub_category, aliases, keywords) VALUES
  ('Software Engineer', 'Engineering', 'Software Development', 
   ARRAY['developer', 'programmer', 'software dev', 'swe'], 
   ARRAY['software', 'engineer', 'developer']),
  
  ('Data Scientist', 'Data & Analytics', 'Data Science',
   ARRAY['data analyst', 'ml engineer', 'data engineer'],
   ARRAY['data', 'scientist', 'analytics']),
  
  ('Product Manager', 'Product', NULL,
   ARRAY['pm', 'product owner', 'product lead'],
   ARRAY['product', 'manager']),
  
  ('Business Analyst', 'Consulting', 'Business Analysis',
   ARRAY['ba', 'analyst', 'business consultant'],
   ARRAY['business', 'analyst']),
  
  ('DevOps Engineer', 'Engineering', 'DevOps',
   ARRAY['sre', 'site reliability engineer', 'devops'],
   ARRAY['devops', 'engineer', 'operations']),
  
  ('UX Designer', 'Design', 'User Experience',
   ARRAY['ux/ui designer', 'user experience designer', 'ui designer'],
   ARRAY['ux', 'designer', 'user', 'experience']),
  
  ('Solution Architect', 'Architecture', 'Solutions',
   ARRAY['architect', 'technical architect', 'systems architect'],
   ARRAY['solution', 'architect', 'architecture']),
  
  ('Project Manager', 'Project Management', NULL,
   ARRAY['pm', 'program manager', 'delivery manager'],
   ARRAY['project', 'manager']),
  
  ('QA Engineer', 'Engineering', 'Quality Assurance',
   ARRAY['qa', 'test engineer', 'quality engineer', 'sdet'],
   ARRAY['qa', 'quality', 'assurance', 'test']),
  
  ('Scrum Master', 'Agile', NULL,
   ARRAY['agile coach', 'scrum coach'],
   ARRAY['scrum', 'master', 'agile']),
  
  ('SAP Consultant', 'ERP Consulting', 'SAP',
   ARRAY['sap specialist', 'sap developer'],
   ARRAY['sap', 'consultant']),
  
  ('Salesforce Developer', 'CRM Development', 'Salesforce',
   ARRAY['sfdc developer', 'salesforce engineer'],
   ARRAY['salesforce', 'developer', 'sfdc']),
  
  ('Cloud Architect', 'Architecture', 'Cloud',
   ARRAY['aws architect', 'azure architect', 'gcp architect'],
   ARRAY['cloud', 'architect']),
  
  ('Security Engineer', 'Engineering', 'Security',
   ARRAY['cybersecurity engineer', 'infosec engineer'],
   ARRAY['security', 'engineer', 'cybersecurity']),
  
  ('Frontend Developer', 'Engineering', 'Frontend',
   ARRAY['front end developer', 'ui developer', 'web developer'],
   ARRAY['frontend', 'developer', 'web']),
  
  ('Backend Developer', 'Engineering', 'Backend',
   ARRAY['back end developer', 'server developer'],
   ARRAY['backend', 'developer', 'server']),
  
  ('Full Stack Developer', 'Engineering', 'Full Stack',
   ARRAY['fullstack developer', 'full-stack developer'],
   ARRAY['full', 'stack', 'developer']),
  
  ('Mobile Developer', 'Engineering', 'Mobile',
   ARRAY['ios developer', 'android developer', 'mobile engineer'],
   ARRAY['mobile', 'developer', 'app']),
  
  ('Database Administrator', 'Data & Analytics', 'Database',
   ARRAY['dba', 'database engineer'],
   ARRAY['database', 'administrator', 'dba']),
  
  ('Network Engineer', 'Engineering', 'Networking',
   ARRAY['network administrator', 'network architect'],
   ARRAY['network', 'engineer'])
ON CONFLICT (standardized_name) DO NOTHING;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_role_taxonomy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER role_taxonomy_updated_at
  BEFORE UPDATE ON role_taxonomy
  FOR EACH ROW
  EXECUTE FUNCTION update_role_taxonomy_updated_at();

-- Comments
COMMENT ON TABLE role_taxonomy IS 'Master taxonomy of standardized role names with aliases and metadata';
COMMENT ON TABLE role_mappings IS 'Tracks mappings from original role names to standardized names, including user corrections';
COMMENT ON COLUMN role_taxonomy.usage_count IS 'Number of times this role has been used in mappings';
COMMENT ON COLUMN role_mappings.source IS 'Source of the mapping: AI (generated), USER_CORRECTION (user fixed), or MANUAL (manually entered)';
COMMENT ON COLUMN role_mappings.confidence IS 'Confidence score of the mapping (0.00 to 1.00)';
