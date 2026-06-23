-- Migration: Add metadataVersion field for optimistic locking
-- Date: 2026-06-22
-- Purpose: Prevent concurrent metadata edit conflicts by tracking version numbers

-- Add metadataVersion column to Contract table
-- Defaults to 1 for existing contracts
-- Incremented on each metadata update via putContractMetadata endpoint
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "metadataVersion" INTEGER NOT NULL DEFAULT 1;

-- Index for performance (optional, but helpful for version-based queries)
CREATE INDEX IF NOT EXISTS "idx_Contract_metadataVersion" ON "Contract"("tenantId", "metadataVersion");

-- Document the pattern:
-- 1. Client fetches contract with metadataVersion: N
-- 2. Client sends PUT /api/contracts/[id]/metadata with metadataVersion: N
-- 3. Server checks: if stored metadataVersion != N, return 409 Conflict
-- 4. On successful update, server increments metadataVersion to N+1
-- 5. Response includes new metadataVersion for next update
--
-- This prevents lost-update problem:
-- - User A loads contract (metadataVersion: 1)
-- - User B loads contract (metadataVersion: 1)
-- - User B updates contract → metadataVersion becomes 2
-- - User A updates contract with metadataVersion: 1 → Gets 409 Conflict, must retry
