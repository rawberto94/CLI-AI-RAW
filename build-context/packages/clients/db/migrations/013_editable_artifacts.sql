-- ============================================================================
-- Migration: Editable Artifacts Repository
-- Description: Add editability, version tracking, and propagation tracking to artifacts
-- Date: 2025-10-21
-- ============================================================================

-- Add new columns to Artifact table for editability
ALTER TABLE "Artifact" 
  ADD COLUMN IF NOT EXISTS "isEdited" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "editCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastEditedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "validationStatus" TEXT DEFAULT 'valid',
  ADD COLUMN IF NOT EXISTS "validationIssues" JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "consumedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "lastPropagatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "propagationStatus" TEXT DEFAULT 'synced';

-- Add comments for documentation
COMMENT ON COLUMN "Artifact"."isEdited" IS 'Indicates if artifact has been manually edited';
COMMENT ON COLUMN "Artifact"."editCount" IS 'Number of times artifact has been edited';
COMMENT ON COLUMN "Artifact"."lastEditedBy" IS 'User ID of last editor';
COMMENT ON COLUMN "Artifact"."lastEditedAt" IS 'Timestamp of last edit';
COMMENT ON COLUMN "Artifact"."validationStatus" IS 'Validation status: valid, warning, error';
COMMENT ON COLUMN "Artifact"."validationIssues" IS 'Array of validation issues';
COMMENT ON COLUMN "Artifact"."consumedBy" IS 'List of analytical engines consuming this artifact';
COMMENT ON COLUMN "Artifact"."lastPropagatedAt" IS 'Timestamp of last propagation to analytical engines';
COMMENT ON COLUMN "Artifact"."propagationStatus" IS 'Propagation status: synced, pending, failed';

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS "Artifact_isEdited_idx" ON "Artifact"("isEdited");
CREATE INDEX IF NOT EXISTS "Artifact_validationStatus_idx" ON "Artifact"("validationStatus");
CREATE INDEX IF NOT EXISTS "Artifact_lastPropagatedAt_idx" ON "Artifact"("lastPropagatedAt");
CREATE INDEX IF NOT EXISTS "Artifact_propagationStatus_idx" ON "Artifact"("propagationStatus");
CREATE INDEX IF NOT EXISTS "Artifact_lastEditedAt_idx" ON "Artifact"("lastEditedAt");

-- ============================================================================
-- Create ArtifactEdit table for version history
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ArtifactEdit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "artifactId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "editedBy" TEXT NOT NULL,
  "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changeType" TEXT NOT NULL,
  "changes" JSONB NOT NULL,
  "reason" TEXT,
  "affectedEngines" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "propagationResults" JSONB DEFAULT '[]',
  
  CONSTRAINT "ArtifactEdit_artifactId_fkey" 
    FOREIGN KEY ("artifactId") 
    REFERENCES "Artifact"("id") 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
);

-- Add comments for ArtifactEdit table
COMMENT ON TABLE "ArtifactEdit" IS 'Version history for artifact edits';
COMMENT ON COLUMN "ArtifactEdit"."version" IS 'Sequential version number for this artifact';
COMMENT ON COLUMN "ArtifactEdit"."changeType" IS 'Type of change: field_update, bulk_update, structure_change';
COMMENT ON COLUMN "ArtifactEdit"."changes" IS 'Array of FieldChange objects with oldValue/newValue';
COMMENT ON COLUMN "ArtifactEdit"."affectedEngines" IS 'List of analytical engines notified of this change';
COMMENT ON COLUMN "ArtifactEdit"."propagationResults" IS 'Results of propagation to each engine';

-- Create indexes for ArtifactEdit
CREATE INDEX IF NOT EXISTS "ArtifactEdit_artifactId_idx" ON "ArtifactEdit"("artifactId");
CREATE INDEX IF NOT EXISTS "ArtifactEdit_editedAt_idx" ON "ArtifactEdit"("editedAt");
CREATE INDEX IF NOT EXISTS "ArtifactEdit_editedBy_idx" ON "ArtifactEdit"("editedBy");
CREATE INDEX IF NOT EXISTS "ArtifactEdit_artifactId_version_idx" ON "ArtifactEdit"("artifactId", "version");

-- Create unique constraint for artifact version
CREATE UNIQUE INDEX IF NOT EXISTS "ArtifactEdit_artifactId_version_key" ON "ArtifactEdit"("artifactId", "version");

-- ============================================================================
-- Enhance ContractMetadata table
-- ============================================================================

ALTER TABLE "contract_metadata"
  ADD COLUMN IF NOT EXISTS "artifactSummary" JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "searchKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "relatedContracts" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "dataQualityScore" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "indexedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ragSyncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "analyticsUpdatedAt" TIMESTAMP(3);

-- Add comments for new metadata columns
COMMENT ON COLUMN "contract_metadata"."artifactSummary" IS 'Summary of artifact counts and validation status';
COMMENT ON COLUMN "contract_metadata"."searchKeywords" IS 'Extracted keywords for search optimization';
COMMENT ON COLUMN "contract_metadata"."relatedContracts" IS 'IDs of related contracts';
COMMENT ON COLUMN "contract_metadata"."dataQualityScore" IS 'Overall data quality score 0-100';
COMMENT ON COLUMN "contract_metadata"."indexedAt" IS 'Timestamp of last search index update';
COMMENT ON COLUMN "contract_metadata"."ragSyncedAt" IS 'Timestamp of last RAG knowledge base sync';
COMMENT ON COLUMN "contract_metadata"."analyticsUpdatedAt" IS 'Timestamp of last analytical engines update';

-- Create indexes for metadata columns
CREATE INDEX IF NOT EXISTS "contract_metadata_dataQualityScore_idx" ON "contract_metadata"("dataQualityScore");
CREATE INDEX IF NOT EXISTS "contract_metadata_searchKeywords_idx" ON "contract_metadata" USING GIN("searchKeywords");
CREATE INDEX IF NOT EXISTS "contract_metadata_indexedAt_idx" ON "contract_metadata"("indexedAt");

-- ============================================================================
-- Create trigger for automatic edit tracking
-- ============================================================================

CREATE OR REPLACE FUNCTION update_artifact_edit_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if data has changed
  IF OLD.data IS DISTINCT FROM NEW.data THEN
    NEW."isEdited" = true;
    NEW."editCount" = OLD."editCount" + 1;
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    NEW."propagationStatus" = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS artifact_edit_tracking_trigger ON "Artifact";
CREATE TRIGGER artifact_edit_tracking_trigger
  BEFORE UPDATE ON "Artifact"
  FOR EACH ROW
  EXECUTE FUNCTION update_artifact_edit_tracking();

-- ============================================================================
-- Migration verification queries
-- ============================================================================

-- Verify new columns exist
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.columns 
          WHERE table_name = 'Artifact' AND column_name = 'isEdited') = 1,
         'Column Artifact.isEdited not created';
  
  ASSERT (SELECT COUNT(*) FROM information_schema.tables 
          WHERE table_name = 'ArtifactEdit') = 1,
         'Table ArtifactEdit not created';
  
  ASSERT (SELECT COUNT(*) FROM information_schema.columns 
          WHERE table_name = 'contract_metadata' AND column_name = 'artifactSummary') = 1,
         'Column contract_metadata.artifactSummary not created';
  
  RAISE NOTICE 'Migration 013_editable_artifacts completed successfully';
END $$;
