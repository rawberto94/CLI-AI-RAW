-- Migration: Switch ContractEmbedding to 1024-dim vectors with per-artifact chunking
-- Date: 2026-02-23
-- Description:
--   1. Drop HNSW index (required before column type change)
--   2. Truncate existing 1536-dim embeddings (incompatible with new 1024-dim)
--   3. ALTER vector column from vector(1536) to vector(1024)
--   4. Recreate HNSW index for 1024 dimensions
--   5. Add enterprise composite indexes for multi-tenant scale (5000+ contracts)
--   6. Add partial index for artifact chunks (9900-9999 range)
--
-- Multi-tenant safe: All data is per-tenantId; no cross-tenant data mixing.
-- Reversible: Re-run generate-embeddings with RAG_EMBED_DIMENSIONS unset to go back to 1536.
BEGIN;
-- 1. Drop the existing HNSW index (vector_cosine_ops for 1536-dim)
DROP INDEX IF EXISTS "ContractEmbedding_embedding_hnsw_idx";
-- 2. Truncate all existing embeddings (they are 1536-dim, incompatible with 1024)
--    Only 20 rows in dev; production should re-embed after migration.
TRUNCATE TABLE "ContractEmbedding";
-- 3. Change column type from vector(1536) to vector(1024) for Matryoshka embeddings
ALTER TABLE "ContractEmbedding"
ALTER COLUMN "embedding" TYPE vector(1024);
-- 4. Recreate HNSW index with same tuning (m=16, ef_construction=200)
CREATE INDEX "ContractEmbedding_embedding_hnsw_idx" ON "ContractEmbedding" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 200);
-- 5. Enterprise composite indexes for multi-tenant queries at scale
--    These allow fast pre-filtered vector search per tenant.
CREATE INDEX IF NOT EXISTS "ContractEmbedding_tenantId_contractType_idx" ON "ContractEmbedding" ("tenantId", "contractType");
CREATE INDEX IF NOT EXISTS "ContractEmbedding_tenantId_contractId_idx" ON "ContractEmbedding" ("tenantId", "contractId");
CREATE INDEX IF NOT EXISTS "ContractEmbedding_tenantId_chunkType_idx" ON "ContractEmbedding" ("tenantId", "chunkType");
CREATE INDEX IF NOT EXISTS "ContractEmbedding_tenantId_contractId_chunkIndex_idx" ON "ContractEmbedding" ("tenantId", "contractId", "chunkIndex");
-- 6. Partial index for artifact/metadata chunks (chunkIndex >= 9900)
--    Speeds up queries specifically targeting AI-generated intelligence.
CREATE INDEX IF NOT EXISTS "ContractEmbedding_artifact_chunks_idx" ON "ContractEmbedding" ("contractId", "chunkIndex")
WHERE "chunkIndex" >= 9900;
-- 7. Partial index for metadata chunks only
CREATE INDEX IF NOT EXISTS "ContractEmbedding_metadata_type_idx" ON "ContractEmbedding" ("tenantId", "contractId")
WHERE "chunkType" = 'metadata';
COMMIT;