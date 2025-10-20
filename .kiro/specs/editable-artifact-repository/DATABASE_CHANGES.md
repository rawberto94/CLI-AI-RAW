# Database Schema Changes

This document outlines all database schema changes required for the Editable Artifact Repository feature. These changes ensure consistency with existing schema and maintain all relationships.

## 1. Artifact Model Extensions

**File**: `packages/clients/db/schema.prisma`

**Changes to existing `Artifact` model**:

```prisma
model Artifact {
  // ===== EXISTING FIELDS (DO NOT MODIFY) =====
  id              String       @id @default(cuid())
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  contractId      String
  tenantId        String
  type            ArtifactType
  data            Json
  schemaVersion   String       @default("v1")
  hash            String?
  location        String?
  confidence      Decimal?     @db.Decimal(3, 2)
  processingTime  Int?
  size            Int?
  storageProvider String?      @default("database")
  
  // ===== NEW FIELDS TO ADD =====
  isEdited        Boolean      @default(false)
  editCount       Int          @default(0)
  lastEditedBy    String?
  lastEditedAt    DateTime?
  validationStatus String?     @default("valid") // valid, warning, error
  validationIssues Json?       @default("[]")
  consumedBy       String[]    @default([])
  lastPropagatedAt DateTime?
  propagationStatus String?    @default("synced") // synced, pending, failed
  
  // ===== EXISTING RELATIONS (DO NOT MODIFY) =====
  contract        Contract     @relation(fields: [contractId], references: [id], onDelete: Cascade)
  
  // ===== NEW RELATIONS TO ADD =====
  editHistory     ArtifactEdit[]
  
  // ===== EXISTING INDEXES (DO NOT MODIFY) =====
  @@unique([contractId, type])
  @@index([contractId])
  @@index([tenantId])
  @@index([type])
  @@index([contractId, type])
  @@index([tenantId, type])
  
  // ===== NEW INDEXES TO ADD =====
  @@index([isEdited])
  @@index([validationStatus])
  @@index([lastPropagatedAt])
  @@index([tenantId, isEdited])
}
```

## 2. New ArtifactEdit Model

**File**: `packages/clients/db/schema.prisma`

**Add this new model**:

```prisma
model ArtifactEdit {
  id              String   @id @default(cuid())
  artifactId      String
  version         Int
  editedBy        String
  editedAt        DateTime @default(now())
  changeType      String   // field_update, bulk_update, structure_change
  changes         Json     // Array of FieldChange objects
  reason          String?  @db.Text
  affectedEngines String[] @default([])
  propagationResults Json? @default("[]")
  
  artifact        Artifact @relation(fields: [artifactId], references: [id], onDelete: Cascade)
  
  @@map("artifact_edits")
  @@index([artifactId])
  @@index([editedAt])
  @@index([editedBy])
  @@index([artifactId, version])
}
```

## 3. ContractMetadata Model Extensions

**File**: `packages/clients/db/schema.prisma`

**Changes to existing `ContractMetadata` model**:

```prisma
model ContractMetadata {
  // ===== EXISTING FIELDS (DO NOT MODIFY) =====
  id           String   @id @default(cuid())
  contractId   String   @unique
  tenantId     String
  categoryId   String?
  tags         String[]
  systemFields Json     @default("{}")
  customFields Json     @default("{}")
  lastUpdated  DateTime @default(now())
  updatedBy    String
  createdAt    DateTime @default(now())
  
  // ===== NEW FIELDS TO ADD =====
  artifactSummary Json?    @default("{}")
  searchKeywords  String[] @default([])
  relatedContracts String[] @default([])
  dataQualityScore Int?     @default(0)
  indexedAt        DateTime?
  ragSyncedAt      DateTime?
  analyticsUpdatedAt DateTime?
  
  // ===== EXISTING RELATIONS (DO NOT MODIFY) =====
  contract     Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  
  // ===== EXISTING INDEXES (DO NOT MODIFY) =====
  @@map("contract_metadata")
  @@index([tenantId])
  @@index([categoryId])
  @@index([tags])
  
  // ===== NEW INDEXES TO ADD =====
  @@index([dataQualityScore])
  @@index([indexedAt])
  @@index([tenantId, dataQualityScore])
}
```

## 4. Migration Script

**File**: `packages/clients/db/migrations/XXX_editable_artifacts.sql`

```sql
-- Migration: Editable Artifacts System
-- Adds fields for artifact editing, versioning, and propagation tracking

-- ============================================================================
-- 1. Add new columns to artifacts table
-- ============================================================================

ALTER TABLE "Artifact" ADD COLUMN IF NOT EXISTS "isEdited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Artifact" ADD COLUMN IF NOT EXISTS "editCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Artifact" ADD COLUMN IF NOT EXISTS "lastEditedBy" TEXT;
ALTER TABLE "Artifact" ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP(3);
ALTER TABLE "Artifact" ADD COLUMN IF NOT EXISTS "validationStatus" TEXT DEFAULT 'valid';
ALTER TABLE "Artifact" ADD COLUMN IF NOT EXISTS "validationIssues" JSONB DEFAULT '[]';
ALTER TABLE "Artifact" ADD COLUMN IF NOT EXISTS "consumedBy" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Artifact" ADD COLUMN IF NOT EXISTS "lastPropagatedAt" TIMESTAMP(3);
ALTER TABLE "Artifact" ADD COLUMN IF NOT EXISTS "propagationStatus" TEXT DEFAULT 'synced';

-- Add indexes for new artifact fields
CREATE INDEX IF NOT EXISTS "Artifact_isEdited_idx" ON "Artifact"("isEdited");
CREATE INDEX IF NOT EXISTS "Artifact_validationStatus_idx" ON "Artifact"("validationStatus");
CREATE INDEX IF NOT EXISTS "Artifact_lastPropagatedAt_idx" ON "Artifact"("lastPropagatedAt");
CREATE INDEX IF NOT EXISTS "Artifact_tenantId_isEdited_idx" ON "Artifact"("tenantId", "isEdited");

-- ============================================================================
-- 2. Create artifact_edits table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "artifact_edits" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "artifactId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "editedBy" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeType" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "reason" TEXT,
    "affectedEngines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "propagationResults" JSONB DEFAULT '[]',
    
    CONSTRAINT "artifact_edits_artifactId_fkey" 
        FOREIGN KEY ("artifactId") 
        REFERENCES "Artifact"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- Add indexes for artifact_edits
CREATE INDEX IF NOT EXISTS "artifact_edits_artifactId_idx" ON "artifact_edits"("artifactId");
CREATE INDEX IF NOT EXISTS "artifact_edits_editedAt_idx" ON "artifact_edits"("editedAt");
CREATE INDEX IF NOT EXISTS "artifact_edits_editedBy_idx" ON "artifact_edits"("editedBy");
CREATE INDEX IF NOT EXISTS "artifact_edits_artifactId_version_idx" ON "artifact_edits"("artifactId", "version");

-- ============================================================================
-- 3. Add new columns to contract_metadata table
-- ============================================================================

ALTER TABLE "contract_metadata" ADD COLUMN IF NOT EXISTS "artifactSummary" JSONB DEFAULT '{}';
ALTER TABLE "contract_metadata" ADD COLUMN IF NOT EXISTS "searchKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "contract_metadata" ADD COLUMN IF NOT EXISTS "relatedContracts" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "contract_metadata" ADD COLUMN IF NOT EXISTS "dataQualityScore" INTEGER DEFAULT 0;
ALTER TABLE "contract_metadata" ADD COLUMN IF NOT EXISTS "indexedAt" TIMESTAMP(3);
ALTER TABLE "contract_metadata" ADD COLUMN IF NOT EXISTS "ragSyncedAt" TIMESTAMP(3);
ALTER TABLE "contract_metadata" ADD COLUMN IF NOT EXISTS "analyticsUpdatedAt" TIMESTAMP(3);

-- Add indexes for new metadata fields
CREATE INDEX IF NOT EXISTS "contract_metadata_dataQualityScore_idx" ON "contract_metadata"("dataQualityScore");
CREATE INDEX IF NOT EXISTS "contract_metadata_indexedAt_idx" ON "contract_metadata"("indexedAt");
CREATE INDEX IF NOT EXISTS "contract_metadata_tenantId_dataQualityScore_idx" ON "contract_metadata"("tenantId", "dataQualityScore");

-- ============================================================================
-- 4. Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN "Artifact"."isEdited" IS 'Indicates if artifact has been manually edited';
COMMENT ON COLUMN "Artifact"."editCount" IS 'Number of times artifact has been edited';
COMMENT ON COLUMN "Artifact"."validationStatus" IS 'Current validation status: valid, warning, error';
COMMENT ON COLUMN "Artifact"."consumedBy" IS 'List of analytical engines consuming this artifact';
COMMENT ON COLUMN "Artifact"."propagationStatus" IS 'Propagation status: synced, pending, failed';

COMMENT ON TABLE "artifact_edits" IS 'Version history for artifact edits with change tracking';

COMMENT ON COLUMN "contract_metadata"."artifactSummary" IS 'Summary of artifact status and validation';
COMMENT ON COLUMN "contract_metadata"."dataQualityScore" IS 'Overall data quality score (0-100)';
COMMENT ON COLUMN "contract_metadata"."indexedAt" IS 'Last time contract was indexed for search';
COMMENT ON COLUMN "contract_metadata"."ragSyncedAt" IS 'Last time contract was synced to RAG knowledge base';
COMMENT ON COLUMN "contract_metadata"."analyticsUpdatedAt" IS 'Last time analytical engines were updated';

-- ============================================================================
-- 5. Create trigger for automatic edit tracking
-- ============================================================================

CREATE OR REPLACE FUNCTION update_artifact_edit_tracking()
RETURNS TRIGGER AS $$
BEGIN
    -- Only track if data field changed
    IF OLD.data IS DISTINCT FROM NEW.data THEN
        NEW."isEdited" = true;
        NEW."editCount" = OLD."editCount" + 1;
        NEW."lastEditedAt" = CURRENT_TIMESTAMP;
        NEW."propagationStatus" = 'pending';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER artifact_edit_tracking_trigger
    BEFORE UPDATE ON "Artifact"
    FOR EACH ROW
    EXECUTE FUNCTION update_artifact_edit_tracking();

-- ============================================================================
-- 6. Backfill existing data (optional)
-- ============================================================================

-- Set initial propagation status for existing artifacts
UPDATE "Artifact" 
SET "propagationStatus" = 'synced' 
WHERE "propagationStatus" IS NULL;

-- Set initial validation status for existing artifacts
UPDATE "Artifact" 
SET "validationStatus" = 'valid' 
WHERE "validationStatus" IS NULL;

-- Initialize data quality scores for existing metadata
UPDATE "contract_metadata" 
SET "dataQualityScore" = 50 
WHERE "dataQualityScore" IS NULL OR "dataQualityScore" = 0;
```

## 5. Prisma Client Regeneration

After making schema changes, regenerate the Prisma client:

```bash
cd packages/clients/db
npx prisma generate
npx prisma migrate dev --name editable_artifacts
```

## 6. Verification Queries

Run these queries to verify the migration:

```sql
-- Check new artifact columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'Artifact' 
AND column_name IN ('isEdited', 'editCount', 'validationStatus', 'propagationStatus');

-- Check artifact_edits table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'artifact_edits';

-- Check new metadata columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'contract_metadata' 
AND column_name IN ('artifactSummary', 'dataQualityScore', 'indexedAt');

-- Verify indexes were created
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('Artifact', 'artifact_edits', 'contract_metadata')
AND indexname LIKE '%isEdited%' OR indexname LIKE '%validationStatus%';
```

## 7. Rollback Script (if needed)

```sql
-- Rollback: Remove editable artifacts changes

-- Drop trigger
DROP TRIGGER IF EXISTS artifact_edit_tracking_trigger ON "Artifact";
DROP FUNCTION IF EXISTS update_artifact_edit_tracking();

-- Drop artifact_edits table
DROP TABLE IF EXISTS "artifact_edits";

-- Remove columns from Artifact
ALTER TABLE "Artifact" DROP COLUMN IF EXISTS "isEdited";
ALTER TABLE "Artifact" DROP COLUMN IF EXISTS "editCount";
ALTER TABLE "Artifact" DROP COLUMN IF EXISTS "lastEditedBy";
ALTER TABLE "Artifact" DROP COLUMN IF EXISTS "lastEditedAt";
ALTER TABLE "Artifact" DROP COLUMN IF EXISTS "validationStatus";
ALTER TABLE "Artifact" DROP COLUMN IF EXISTS "validationIssues";
ALTER TABLE "Artifact" DROP COLUMN IF EXISTS "consumedBy";
ALTER TABLE "Artifact" DROP COLUMN IF EXISTS "lastPropagatedAt";
ALTER TABLE "Artifact" DROP COLUMN IF EXISTS "propagationStatus";

-- Remove columns from contract_metadata
ALTER TABLE "contract_metadata" DROP COLUMN IF EXISTS "artifactSummary";
ALTER TABLE "contract_metadata" DROP COLUMN IF EXISTS "searchKeywords";
ALTER TABLE "contract_metadata" DROP COLUMN IF EXISTS "relatedContracts";
ALTER TABLE "contract_metadata" DROP COLUMN IF EXISTS "dataQualityScore";
ALTER TABLE "contract_metadata" DROP COLUMN IF EXISTS "indexedAt";
ALTER TABLE "contract_metadata" DROP COLUMN IF EXISTS "ragSyncedAt";
ALTER TABLE "contract_metadata" DROP COLUMN IF EXISTS "analyticsUpdatedAt";
```

## Summary of Changes

### Tables Modified:
1. **Artifact** - Added 9 new columns for edit tracking and propagation
2. **contract_metadata** - Added 7 new columns for quality and sync tracking

### Tables Created:
1. **artifact_edits** - New table for version history

### Indexes Added:
- 4 new indexes on Artifact table
- 4 new indexes on artifact_edits table
- 3 new indexes on contract_metadata table

### Triggers Created:
- 1 trigger for automatic edit tracking on Artifact updates

### Relations:
- artifact_edits → Artifact (foreign key)
- All existing relations preserved

**Total Impact**: Low risk - all changes are additive, no existing data modified
