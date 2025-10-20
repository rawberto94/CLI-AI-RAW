-- ============================================================================
-- Rollback Migration: Editable Artifacts Repository
-- Description: Safely rollback all changes from 013_editable_artifacts.sql
-- Date: 2025-10-21
-- ============================================================================

-- Drop trigger first
DROP TRIGGER IF EXISTS artifact_edit_tracking_trigger ON "Artifact";
DROP FUNCTION IF EXISTS update_artifact_edit_tracking();

-- Drop ArtifactEdit table
DROP TABLE IF EXISTS "ArtifactEdit" CASCADE;

-- Remove columns from contract_metadata
ALTER TABLE "contract_metadata"
  DROP COLUMN IF EXISTS "artifactSummary",
  DROP COLUMN IF EXISTS "searchKeywords",
  DROP COLUMN IF EXISTS "relatedContracts",
  DROP COLUMN IF EXISTS "dataQualityScore",
  DROP COLUMN IF EXISTS "indexedAt",
  DROP COLUMN IF EXISTS "ragSyncedAt",
  DROP COLUMN IF EXISTS "analyticsUpdatedAt";

-- Remove columns from Artifact table
ALTER TABLE "Artifact"
  DROP COLUMN IF EXISTS "isEdited",
  DROP COLUMN IF EXISTS "editCount",
  DROP COLUMN IF EXISTS "lastEditedBy",
  DROP COLUMN IF EXISTS "lastEditedAt",
  DROP COLUMN IF EXISTS "validationStatus",
  DROP COLUMN IF EXISTS "validationIssues",
  DROP COLUMN IF EXISTS "consumedBy",
  DROP COLUMN IF EXISTS "lastPropagatedAt",
  DROP COLUMN IF EXISTS "propagationStatus";

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Rollback of migration 013_editable_artifacts completed successfully';
END $$;
