-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" TEXT,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Contract_tenantId_isDeleted_idx" ON "Contract"("tenantId", "isDeleted");

-- CreateIndex
CREATE INDEX "Contract_tenantId_isDeleted_status_idx" ON "Contract"("tenantId", "isDeleted", "status");

-- CreateIndex
CREATE INDEX "Contract_tenantId_isDeleted_createdAt_idx" ON "Contract"("tenantId", "isDeleted", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Contract_deletedAt_idx" ON "Contract"("deletedAt");
