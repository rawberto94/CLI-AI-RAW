-- Migration: Contract Repository Optimization
-- Description: Adds optimized schema for contract repository with full-text search and vector embeddings
-- Requirements: 3.1, 3.2, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8

-- ============================================================================
-- ENABLE REQUIRED EXTENSIONS
-- ============================================================================

-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- CREATE PARTY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "Party" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "address" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Party_name_type_key" UNIQUE ("name", "type")
);

CREATE INDEX IF NOT EXISTS "Party_type_idx" ON "Party"("type");

-- ============================================================================
-- UPDATE CONTRACT TABLE
-- ============================================================================

-- Add new columns to Contract table if they don't exist
DO $$ 
BEGIN
  -- Add rawText column for full-text search
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'Contract' AND column_name = 'rawText') THEN
    ALTER TABLE "Contract" ADD COLUMN "rawText" TEXT;
  END IF;
  
  -- Add textVector column for full-text search
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'Contract' AND column_name = 'textVector') THEN
    ALTER TABLE "Contract" ADD COLUMN "textVector" tsvector;
  END IF;
  
  -- Add party relationship columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'Contract' AND column_name = 'clientId') THEN
    ALTER TABLE "Contract" ADD COLUMN "clientId" TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'Contract' AND column_name = 'supplierId') THEN
    ALTER TABLE "Contract" ADD COLUMN "supplierId" TEXT;
  END IF;
  
  -- Add financial columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'Contract' AND column_name = 'totalValue') THEN
    ALTER TABLE "Contract" ADD COLUMN "totalValue" DECIMAL(15,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'Contract' AND column_name = 'currency') THEN
    ALTER TABLE "Contract" ADD COLUMN "currency" TEXT;
  END IF;
  
  -- Add date columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'Contract' AND column_name = 'startDate') THEN
    ALTER TABLE "Contract" ADD COLUMN "startDate" TIMESTAMP(3);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'Contract' AND column_name = 'endDate') THEN
    ALTER TABLE "Contract" ADD COLUMN "endDate" TIMESTAMP(3);
  END IF;
END $$;

-- Add foreign key constraints for parties
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Contract_clientId_fkey') THEN
    ALTER TABLE "Contract" 
    ADD CONSTRAINT "Contract_clientId_fkey" 
    FOREIGN KEY ("clientId") REFERENCES "Party"("id") ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Contract_supplierId_fkey') THEN
    ALTER TABLE "Contract" 
    ADD CONSTRAINT "Contract_supplierId_fkey" 
    FOREIGN KEY ("supplierId") REFERENCES "Party"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for Contract table
CREATE INDEX IF NOT EXISTS "Contract_clientId_idx" ON "Contract"("clientId");
CREATE INDEX IF NOT EXISTS "Contract_supplierId_idx" ON "Contract"("supplierId");
CREATE INDEX IF NOT EXISTS "Contract_startDate_endDate_idx" ON "Contract"("startDate", "endDate");

-- Create GIN index for full-text search on textVector
CREATE INDEX IF NOT EXISTS "Contract_textVector_idx" ON "Contract" USING GIN("textVector");

-- Create trigger to automatically update textVector when rawText changes
CREATE OR REPLACE FUNCTION update_contract_text_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW."textVector" := to_tsvector('english', COALESCE(NEW."rawText", ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contract_text_vector_update ON "Contract";
CREATE TRIGGER contract_text_vector_update
  BEFORE INSERT OR UPDATE OF "rawText" ON "Contract"
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_text_vector();

-- ============================================================================
-- CREATE CONTRACT ARTIFACT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ContractArtifact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "ContractArtifact_contractId_fkey" 
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ContractArtifact_contractId_idx" ON "ContractArtifact"("contractId");
CREATE INDEX IF NOT EXISTS "ContractArtifact_contractId_type_idx" ON "ContractArtifact"("contractId", "type");
CREATE INDEX IF NOT EXISTS "ContractArtifact_type_idx" ON "ContractArtifact"("type");

-- ============================================================================
-- CREATE CONTRACT EMBEDDING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ContractEmbedding" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "chunkText" TEXT NOT NULL,
  "embedding" vector(1536),  -- OpenAI text-embedding-3-small dimension
  "chunkType" TEXT,
  "section" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "ContractEmbedding_contractId_fkey" 
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE,
  CONSTRAINT "ContractEmbedding_contractId_chunkIndex_key" 
    UNIQUE ("contractId", "chunkIndex")
);

CREATE INDEX IF NOT EXISTS "ContractEmbedding_contractId_idx" ON "ContractEmbedding"("contractId");
CREATE INDEX IF NOT EXISTS "ContractEmbedding_chunkType_idx" ON "ContractEmbedding"("chunkType");

-- Create index for vector similarity search using cosine distance
CREATE INDEX IF NOT EXISTS "ContractEmbedding_embedding_idx" 
  ON "ContractEmbedding" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================================
-- CREATE CLAUSE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "Clause" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "riskLevel" TEXT,
  "position" INTEGER,
  "libraryClauseId" TEXT,
  "similarity" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Clause_contractId_fkey" 
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Clause_contractId_idx" ON "Clause"("contractId");
CREATE INDEX IF NOT EXISTS "Clause_contractId_category_idx" ON "Clause"("contractId", "category");
CREATE INDEX IF NOT EXISTS "Clause_category_idx" ON "Clause"("category");
CREATE INDEX IF NOT EXISTS "Clause_riskLevel_idx" ON "Clause"("riskLevel");

-- Create GIN index for full-text search on clause text
CREATE INDEX IF NOT EXISTS "Clause_text_gin_idx" ON "Clause" USING GIN(to_tsvector('english', "text"));

-- ============================================================================
-- CREATE PROCESSING JOB TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ProcessingJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "currentStep" TEXT,
  "error" TEXT,
  "errorStack" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "maxRetries" INTEGER NOT NULL DEFAULT 3,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "ProcessingJob_contractId_fkey" 
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ProcessingJob_contractId_idx" ON "ProcessingJob"("contractId");
CREATE INDEX IF NOT EXISTS "ProcessingJob_status_idx" ON "ProcessingJob"("status");
CREATE INDEX IF NOT EXISTS "ProcessingJob_createdAt_idx" ON "ProcessingJob"("createdAt");

-- ============================================================================
-- CREATE CONTRACT VERSION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ContractVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "parentVersionId" TEXT,
  "changes" JSONB,
  "uploadedBy" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "ContractVersion_contractId_fkey" 
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE,
  CONSTRAINT "ContractVersion_contractId_versionNumber_key" 
    UNIQUE ("contractId", "versionNumber")
);

CREATE INDEX IF NOT EXISTS "ContractVersion_contractId_idx" ON "ContractVersion"("contractId");
CREATE INDEX IF NOT EXISTS "ContractVersion_isActive_idx" ON "ContractVersion"("isActive");

-- ============================================================================
-- CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function for hybrid search (combines full-text and vector search)
CREATE OR REPLACE FUNCTION search_contracts(
  search_query TEXT,
  search_embedding vector(1536) DEFAULT NULL,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  contract_id TEXT,
  relevance_score DOUBLE PRECISION,
  snippet TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH text_search AS (
    SELECT 
      c."id" as contract_id,
      ts_rank(c."textVector", plainto_tsquery('english', search_query)) as text_score,
      ts_headline('english', c."rawText", plainto_tsquery('english', search_query),
        'MaxWords=50, MinWords=25') as snippet
    FROM "Contract" c
    WHERE c."textVector" @@ plainto_tsquery('english', search_query)
  ),
  vector_search AS (
    SELECT 
      ce."contractId" as contract_id,
      1 - (ce."embedding" <=> search_embedding) as vector_score,
      ce."chunkText" as snippet
    FROM "ContractEmbedding" ce
    WHERE search_embedding IS NOT NULL
    ORDER BY ce."embedding" <=> search_embedding
    LIMIT limit_count * 2
  )
  SELECT 
    COALESCE(ts.contract_id, vs.contract_id) as contract_id,
    COALESCE(ts.text_score, 0) * 0.5 + COALESCE(vs.vector_score, 0) * 0.5 as relevance_score,
    COALESCE(ts.snippet, vs.snippet) as snippet
  FROM text_search ts
  FULL OUTER JOIN vector_search vs ON ts.contract_id = vs.contract_id
  ORDER BY relevance_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate data quality score
CREATE OR REPLACE FUNCTION calculate_contract_quality(contract_id_param TEXT)
RETURNS DECIMAL AS $$
DECLARE
  quality_score DECIMAL := 0;
  total_fields INTEGER := 10;
  filled_fields INTEGER := 0;
BEGIN
  SELECT 
    (CASE WHEN "rawText" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "contractType" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "clientId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "supplierId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "totalValue" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "currency" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "startDate" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "endDate" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "effectiveDate" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "jurisdiction" IS NOT NULL THEN 1 ELSE 0 END)
  INTO filled_fields
  FROM "Contract"
  WHERE "id" = contract_id_param;
  
  quality_score := (filled_fields::DECIMAL / total_fields::DECIMAL) * 100;
  
  RETURN quality_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE "Party" IS 'Stores contract parties (clients, suppliers, vendors, partners)';
COMMENT ON TABLE "ContractArtifact" IS 'Stores extracted contract artifacts (parties, dates, values, terms)';
COMMENT ON TABLE "ContractEmbedding" IS 'Stores vector embeddings for semantic search';
COMMENT ON TABLE "Clause" IS 'Stores extracted contract clauses with categorization';
COMMENT ON TABLE "ProcessingJob" IS 'Tracks contract processing jobs with status and error handling';
COMMENT ON TABLE "ContractVersion" IS 'Tracks contract versions and amendments';

COMMENT ON COLUMN "Contract"."rawText" IS 'Full extracted text from contract for search indexing';
COMMENT ON COLUMN "Contract"."textVector" IS 'Full-text search vector (automatically updated)';
COMMENT ON COLUMN "ContractEmbedding"."embedding" IS 'Vector embedding for semantic search (1536 dimensions for OpenAI)';

-- ============================================================================
-- GRANT PERMISSIONS (adjust as needed for your setup)
-- ============================================================================

-- Grant permissions to application user (adjust username as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 006_contract_repository_optimization.sql completed successfully';
  RAISE NOTICE 'Added tables: Party, ContractArtifact, ContractEmbedding, Clause, ProcessingJob, ContractVersion';
  RAISE NOTICE 'Added extensions: vector, pg_trgm';
  RAISE NOTICE 'Added full-text search support with tsvector';
  RAISE NOTICE 'Added vector similarity search with pgvector';
END $$;
