-- Migration: Add Duplicate Detection Tables
-- Description: Adds duplicate resolution tracking for rate card data quality
-- Date: 2025-01-XX

-- Create duplicate_resolutions table
CREATE TABLE IF NOT EXISTS duplicate_resolutions (
  id TEXT PRIMARY KEY,
  duplicate_group_id TEXT NOT NULL,
  
  -- Resolution Details
  action TEXT NOT NULL CHECK (action IN ('MERGED', 'DELETED', 'KEPT_SEPARATE')),
  resolved_by TEXT NOT NULL,
  resolved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  
  -- Merge/Delete Details
  merged_into_id TEXT,
  deleted_ids TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_duplicate_resolutions_duplicate_group_id
  ON duplicate_resolutions(duplicate_group_id);

CREATE INDEX IF NOT EXISTS idx_duplicate_resolutions_resolved_at
  ON duplicate_resolutions(resolved_at);

-- Add comment
COMMENT ON TABLE duplicate_resolutions IS 'Tracks resolution actions taken on duplicate rate cards';
