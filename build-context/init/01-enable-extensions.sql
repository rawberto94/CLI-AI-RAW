-- Initialize database with required extensions for Contract Intelligence Platform

-- Enable pgvector extension for vector embeddings (RAG support)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable btree_gin for composite indexes
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Create indexes for better performance
-- Note: Application-specific tables and indexes will be created by Prisma migrations

-- Log extension creation
DO $$
BEGIN
    RAISE NOTICE 'Database extensions initialized successfully for Contract Intelligence Platform';
    RAISE NOTICE 'Extensions enabled: vector, uuid-ossp, pg_trgm, btree_gin';
END
$$;
