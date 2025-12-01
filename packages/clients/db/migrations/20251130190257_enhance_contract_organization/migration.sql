-- AlterTable
ALTER TABLE "contract_metadata" ADD COLUMN     "accessCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "archiveDate" TIMESTAMP(3),
ADD COLUMN     "auditNotes" TEXT,
ADD COLUMN     "businessUnit" TEXT,
ADD COLUMN     "complexityScore" INTEGER DEFAULT 0,
ADD COLUMN     "complianceStatus" TEXT DEFAULT 'pending',
ADD COLUMN     "costCenter" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "importance" TEXT,
ADD COLUMN     "lastAuditDate" TIMESTAMP(3),
ADD COLUMN     "nextAuditDate" TIMESTAMP(3),
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "projectCode" TEXT,
ADD COLUMN     "renewalReminder" TIMESTAMP(3),
ADD COLUMN     "retentionPeriod" INTEGER,
ADD COLUMN     "reviewDate" TIMESTAMP(3),
ADD COLUMN     "riskScore" INTEGER DEFAULT 0,
ADD COLUMN     "valueScore" INTEGER DEFAULT 0;

-- CreateIndex
CREATE INDEX "Contract_tenantId_createdAt_idx" ON "Contract"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Contract_tenantId_uploadedAt_idx" ON "Contract"("tenantId", "uploadedAt" DESC);

-- CreateIndex
CREATE INDEX "Contract_tenantId_totalValue_idx" ON "Contract"("tenantId", "totalValue" DESC);

-- CreateIndex
CREATE INDEX "Contract_tenantId_expirationDate_idx" ON "Contract"("tenantId", "expirationDate");

-- CreateIndex
CREATE INDEX "Contract_tenantId_effectiveDate_idx" ON "Contract"("tenantId", "effectiveDate");

-- CreateIndex
CREATE INDEX "Contract_tenantId_status_createdAt_idx" ON "Contract"("tenantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Contract_tenantId_contractType_createdAt_idx" ON "Contract"("tenantId", "contractType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Contract_tenantId_category_createdAt_idx" ON "Contract"("tenantId", "category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Contract_uploadedAt_idx" ON "Contract"("uploadedAt" DESC);

-- CreateIndex
CREATE INDEX "Contract_totalValue_idx" ON "Contract"("totalValue" DESC);

-- CreateIndex
CREATE INDEX "Contract_expirationDate_idx" ON "Contract"("expirationDate");

-- CreateIndex
CREATE INDEX "Contract_effectiveDate_idx" ON "Contract"("effectiveDate");

-- CreateIndex
CREATE INDEX "Contract_viewCount_idx" ON "Contract"("viewCount" DESC);

-- CreateIndex
CREATE INDEX "Contract_lastViewedAt_idx" ON "Contract"("lastViewedAt" DESC);

-- CreateIndex
CREATE INDEX "Contract_checksum_idx" ON "Contract"("checksum");

-- CreateIndex
CREATE INDEX "contract_metadata_tenantId_priority_idx" ON "contract_metadata"("tenantId", "priority" DESC);

-- CreateIndex
CREATE INDEX "contract_metadata_tenantId_department_idx" ON "contract_metadata"("tenantId", "department");

-- CreateIndex
CREATE INDEX "contract_metadata_tenantId_projectCode_idx" ON "contract_metadata"("tenantId", "projectCode");

-- CreateIndex
CREATE INDEX "contract_metadata_tenantId_complianceStatus_idx" ON "contract_metadata"("tenantId", "complianceStatus");

-- CreateIndex
CREATE INDEX "contract_metadata_renewalReminder_idx" ON "contract_metadata"("renewalReminder");

-- CreateIndex
CREATE INDEX "contract_metadata_reviewDate_idx" ON "contract_metadata"("reviewDate");

-- CreateIndex
CREATE INDEX "contract_metadata_riskScore_idx" ON "contract_metadata"("riskScore" DESC);

-- CreateIndex
CREATE INDEX "contract_metadata_valueScore_idx" ON "contract_metadata"("valueScore" DESC);
