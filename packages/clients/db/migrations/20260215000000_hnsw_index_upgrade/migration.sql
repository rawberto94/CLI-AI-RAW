-- Migration: Upgrade ContractEmbedding from IVFFlat to HNSW index
-- HNSW provides ~95%+ recall vs ~80% for IVFFlat at similar latencies.
-- Parameters: m=16 (bidirectional links), ef_construction=200 (build quality)
-- At query time, SET hnsw.ef_search = 100 for high recall.
-- Drop the old IVFFlat index
DROP INDEX IF EXISTS "ContractEmbedding_embedding_idx";
-- Create HNSW index (this may take a few minutes on large datasets)
CREATE INDEX "ContractEmbedding_embedding_hnsw_idx" ON "ContractEmbedding" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 200);
-- Add composite index for chunk-level pre-filtering + vector search
-- pgvector can leverage partial indexes + HNSW for filtered queries
CREATE INDEX IF NOT EXISTS "ContractEmbedding_chunkType_idx" ON "ContractEmbedding" ("chunkType");
CREATE INDEX IF NOT EXISTS "ContractEmbedding_section_idx" ON "ContractEmbedding" ("section")
WHERE "section" IS NOT NULL;
-- Composite index: tenantId (via Contract JOIN) is already covered by the JOIN
-- But we can add a direct tenantId column for faster pre-filtered ANN queries
-- Step 1: Add tenantId column directly to ContractEmbedding (denormalized for perf)
ALTER TABLE "ContractEmbedding"
ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
-- Backfill tenantId from Contract table
UPDATE "ContractEmbedding" ce
SET "tenantId" = c."tenantId"
FROM "Contract" c
WHERE ce."contractId" = c.id
    AND ce."tenantId" IS NULL;
-- Create index for tenant-scoped vector searches
CREATE INDEX IF NOT EXISTS "ContractEmbedding_tenantId_idx" ON "ContractEmbedding" ("tenantId");
-- Add contractType for richer pre-filtering (denormalized)
ALTER TABLE "ContractEmbedding"
ADD COLUMN IF NOT EXISTS "contractType" TEXT;
-- Backfill contractType from Contract table  
UPDATE "ContractEmbedding" ce
SET "contractType" = c."contractType"
FROM "Contract" c
WHERE ce."contractId" = c.id
    AND ce."contractType" IS NULL;
CREATE INDEX IF NOT EXISTS "ContractEmbedding_contractType_idx" ON "ContractEmbedding" ("contractType")
WHERE "contractType" IS NOT NULL;
-- Analyze table to update planner statistics after index changes
ANALYZE "ContractEmbedding";