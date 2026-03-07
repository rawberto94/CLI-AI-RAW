-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "documentClassification" TEXT DEFAULT 'contract',
ADD COLUMN     "documentClassificationConf" DOUBLE PRECISION,
ADD COLUMN     "documentClassificationWarning" TEXT,
ADD COLUMN     "signatureDate" TIMESTAMP(3),
ADD COLUMN     "signatureRequiredFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "signatureStatus" TEXT DEFAULT 'unknown';

-- CreateIndex
CREATE INDEX "Contract_signatureStatus_idx" ON "Contract"("signatureStatus");

-- CreateIndex
CREATE INDEX "Contract_documentClassification_idx" ON "Contract"("documentClassification");

-- CreateIndex
CREATE INDEX "Contract_tenantId_signatureStatus_idx" ON "Contract"("tenantId", "signatureStatus");

-- CreateIndex
CREATE INDEX "Contract_tenantId_documentClassification_idx" ON "Contract"("tenantId", "documentClassification");

-- CreateIndex
CREATE INDEX "Contract_tenantId_signatureStatus_documentClassification_idx" ON "Contract"("tenantId", "signatureStatus", "documentClassification");
