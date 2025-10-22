-- AlterTable
ALTER TABLE "Artifact" ADD COLUMN     "consumedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "editCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastEditedAt" TIMESTAMP(3),
ADD COLUMN     "lastEditedBy" TEXT,
ADD COLUMN     "lastPropagatedAt" TIMESTAMP(3),
ADD COLUMN     "propagationStatus" TEXT DEFAULT 'synced',
ADD COLUMN     "validationIssues" JSONB DEFAULT '[]',
ADD COLUMN     "validationStatus" TEXT DEFAULT 'valid';

-- AlterTable
ALTER TABLE "contract_metadata" ADD COLUMN     "analyticsUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "artifactSummary" JSONB DEFAULT '{}',
ADD COLUMN     "dataQualityScore" INTEGER DEFAULT 0,
ADD COLUMN     "indexedAt" TIMESTAMP(3),
ADD COLUMN     "ragSyncedAt" TIMESTAMP(3),
ADD COLUMN     "relatedContracts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "searchKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "ArtifactEdit" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "editedBy" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeType" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "reason" TEXT,
    "affectedEngines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "propagationResults" JSONB DEFAULT '[]',

    CONSTRAINT "ArtifactEdit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArtifactEdit_artifactId_idx" ON "ArtifactEdit"("artifactId");

-- CreateIndex
CREATE INDEX "ArtifactEdit_editedAt_idx" ON "ArtifactEdit"("editedAt");

-- CreateIndex
CREATE INDEX "ArtifactEdit_editedBy_idx" ON "ArtifactEdit"("editedBy");

-- CreateIndex
CREATE INDEX "ArtifactEdit_artifactId_version_idx" ON "ArtifactEdit"("artifactId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ArtifactEdit_artifactId_version_key" ON "ArtifactEdit"("artifactId", "version");

-- CreateIndex
CREATE INDEX "Artifact_isEdited_idx" ON "Artifact"("isEdited");

-- CreateIndex
CREATE INDEX "Artifact_validationStatus_idx" ON "Artifact"("validationStatus");

-- CreateIndex
CREATE INDEX "Artifact_lastPropagatedAt_idx" ON "Artifact"("lastPropagatedAt");

-- CreateIndex
CREATE INDEX "Artifact_propagationStatus_idx" ON "Artifact"("propagationStatus");

-- CreateIndex
CREATE INDEX "Artifact_lastEditedAt_idx" ON "Artifact"("lastEditedAt");

-- CreateIndex
CREATE INDEX "contract_metadata_dataQualityScore_idx" ON "contract_metadata"("dataQualityScore");

-- CreateIndex
CREATE INDEX "contract_metadata_indexedAt_idx" ON "contract_metadata"("indexedAt");

-- CreateIndex
CREATE INDEX "cost_savings_opportunities_artifactId_idx" ON "cost_savings_opportunities"("artifactId");

-- AddForeignKey
ALTER TABLE "ArtifactEdit" ADD CONSTRAINT "ArtifactEdit_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_savings_opportunities" ADD CONSTRAINT "cost_savings_opportunities_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
