-- Enhanced Contract Search Indexing
-- This migration adds comprehensive indexes for fast contract search and retrieval

-- 1. Add GIN index on searchMetadata JSONB for flexible metadata search
CREATE INDEX IF NOT EXISTS "idx_contract_search_metadata" ON "Contract" USING gin ("searchMetadata");

-- 2. Add GIN index on keywords JSONB for tag-based search
CREATE INDEX IF NOT EXISTS "idx_contract_keywords" ON "Contract" USING gin ("keywords");

-- 3. Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS "idx_contract_tenant_status_date" 
ON "Contract" ("tenantId", "status", "createdAt" DESC);

-- 4. Index for file name search (case-insensitive)
CREATE INDEX IF NOT EXISTS "idx_contract_filename_lower" 
ON "Contract" (LOWER("fileName"));

-- 5. Index for contract title search (case-insensitive)
CREATE INDEX IF NOT EXISTS "idx_contract_title_lower" 
ON "Contract" (LOWER("contractTitle"));

-- 6. Index for uploaded by user
CREATE INDEX IF NOT EXISTS "idx_contract_uploaded_by" 
ON "Contract" ("tenantId", "uploadedBy");

-- 7. Index for date range queries (uploaded at)
CREATE INDEX IF NOT EXISTS "idx_contract_uploaded_at" 
ON "Contract" ("tenantId", "uploadedAt" DESC);

-- 8. Composite index for financial queries
CREATE INDEX IF NOT EXISTS "idx_contract_value_currency" 
ON "Contract" ("tenantId", "totalValue" DESC NULLS LAST, "currency");

-- 9. Enhanced full-text search with ALL searchable fields
CREATE INDEX IF NOT EXISTS "idx_contract_fulltext_enhanced" ON "Contract" 
USING gin (
  to_tsvector('english', 
    COALESCE("contractTitle", '') || ' ' ||
    COALESCE("description", '') || ' ' ||
    COALESCE("clientName", '') || ' ' ||
    COALESCE("supplierName", '') || ' ' ||
    COALESCE("fileName", '') || ' ' ||
    COALESCE("category", '') || ' ' ||
    COALESCE("contractType", '') || ' ' ||
    COALESCE("searchableText", '')
  )
);

-- 10. Index for artifact search (if you want to search by artifacts)
CREATE INDEX IF NOT EXISTS "idx_artifact_contract_type" 
ON "Artifact" ("contractId", "type");

-- 11. Index for recent contracts (most common query)
CREATE INDEX IF NOT EXISTS "idx_contract_recent" 
ON "Contract" ("tenantId", "status", "createdAt" DESC)
WHERE "status" IN ('COMPLETED', 'PROCESSING');

-- 12. Index for expiring contracts (useful for renewals)
CREATE INDEX IF NOT EXISTS "idx_contract_expiring" 
ON "Contract" ("tenantId", "expirationDate")
WHERE "expirationDate" IS NOT NULL;

-- 13. Add computed column for better search if not exists
DO $$ 
BEGIN
  -- Create a materialized view for complex searches (optional)
  CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_contract_search" AS
  SELECT 
    c.id,
    c."tenantId",
    c."fileName",
    c."contractTitle",
    c."clientName",
    c."supplierName",
    c."contractType",
    c.status,
    c."totalValue",
    c.currency,
    c."createdAt",
    c."uploadedAt",
    c."expirationDate",
    c.category,
    c.description,
    -- Aggregate artifacts
    COUNT(a.id) as artifact_count,
    -- Create searchable text
    to_tsvector('english', 
      COALESCE(c."contractTitle", '') || ' ' ||
      COALESCE(c."description", '') || ' ' ||
      COALESCE(c."clientName", '') || ' ' ||
      COALESCE(c."supplierName", '') || ' ' ||
      COALESCE(c."fileName", '') || ' ' ||
      COALESCE(c."category", '') || ' ' ||
      COALESCE(c."contractType", '')
    ) as search_vector
  FROM "Contract" c
  LEFT JOIN "Artifact" a ON a."contractId" = c.id
  GROUP BY c.id;

  -- Create index on the materialized view
  CREATE INDEX IF NOT EXISTS "idx_mv_contract_search_vector" 
  ON "mv_contract_search" USING gin (search_vector);
  
  CREATE INDEX IF NOT EXISTS "idx_mv_contract_tenant_status" 
  ON "mv_contract_search" ("tenantId", status, "createdAt" DESC);
  
EXCEPTION
  WHEN duplicate_table THEN
    NULL;  -- Materialized view already exists
END $$;

-- Add comment for documentation
COMMENT ON INDEX "idx_contract_fulltext_enhanced" IS 
'Enhanced full-text search across all textual contract fields using PostgreSQL GIN index';

COMMENT ON INDEX "idx_contract_search_metadata" IS 
'JSONB index for flexible metadata search including extracted entities';

-- Show index summary
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('Contract', 'Artifact')
ORDER BY tablename, indexname;
