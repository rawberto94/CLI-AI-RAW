-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ArtifactType" ADD VALUE 'TERMINATION_CLAUSE';
ALTER TYPE "ArtifactType" ADD VALUE 'LIABILITY_CLAUSE';
ALTER TYPE "ArtifactType" ADD VALUE 'SLA_TERMS';
ALTER TYPE "ArtifactType" ADD VALUE 'OBLIGATIONS';
ALTER TYPE "ArtifactType" ADD VALUE 'RENEWAL';
ALTER TYPE "ArtifactType" ADD VALUE 'NEGOTIATION_POINTS';
ALTER TYPE "ArtifactType" ADD VALUE 'AMENDMENTS';
ALTER TYPE "ArtifactType" ADD VALUE 'CONTACTS';

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'PENDING';

-- DropForeignKey
ALTER TABLE "rate_card_entries" DROP CONSTRAINT "rate_card_entries_contractId_fkey";

-- AlterTable
ALTER TABLE "Artifact" ADD COLUMN     "status" TEXT DEFAULT 'active',
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "aiMetadata" JSONB DEFAULT '{}',
ADD COLUMN     "classificationConf" DOUBLE PRECISION,
ADD COLUMN     "classificationMeta" JSONB DEFAULT '{}',
ADD COLUMN     "classifiedAt" TIMESTAMP(3),
ADD COLUMN     "contractCategoryId" TEXT,
ADD COLUMN     "contractSubtype" TEXT,
ADD COLUMN     "dataProfiles" JSONB DEFAULT '[]',
ADD COLUMN     "deliveryModels" JSONB DEFAULT '[]',
ADD COLUMN     "documentRole" TEXT,
ADD COLUMN     "linkedAt" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB DEFAULT '{}',
ADD COLUMN     "parentContractId" TEXT,
ADD COLUMN     "pricingModels" JSONB DEFAULT '[]',
ADD COLUMN     "relationshipNote" TEXT,
ADD COLUMN     "relationshipType" TEXT,
ADD COLUMN     "riskFlags" JSONB DEFAULT '[]';

-- AlterTable
ALTER TABLE "rate_card_entries" ADD COLUMN     "unit" TEXT DEFAULT 'daily';

-- AlterTable
ALTER TABLE "taxonomy_categories" ADD COLUMN     "aiClassificationPrompt" TEXT,
ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TeamInvitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customFields" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvitation_token_key" ON "TeamInvitation"("token");

-- CreateIndex
CREATE INDEX "TeamInvitation_token_idx" ON "TeamInvitation"("token");

-- CreateIndex
CREATE INDEX "TeamInvitation_email_idx" ON "TeamInvitation"("email");

-- CreateIndex
CREATE INDEX "TeamInvitation_tenantId_idx" ON "TeamInvitation"("tenantId");

-- CreateIndex
CREATE INDEX "TeamInvitation_status_idx" ON "TeamInvitation"("status");

-- CreateIndex
CREATE INDEX "TeamInvitation_expiresAt_idx" ON "TeamInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "TenantSettings_tenantId_idx" ON "TenantSettings"("tenantId");

-- CreateIndex
CREATE INDEX "Contract_contractCategoryId_idx" ON "Contract"("contractCategoryId");

-- CreateIndex
CREATE INDEX "Contract_documentRole_idx" ON "Contract"("documentRole");

-- CreateIndex
CREATE INDEX "Contract_tenantId_contractCategoryId_idx" ON "Contract"("tenantId", "contractCategoryId");

-- CreateIndex
CREATE INDEX "Contract_tenantId_documentRole_idx" ON "Contract"("tenantId", "documentRole");

-- CreateIndex
CREATE INDEX "Contract_tenantId_contractCategoryId_createdAt_idx" ON "Contract"("tenantId", "contractCategoryId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Contract_parentContractId_idx" ON "Contract"("parentContractId");

-- CreateIndex
CREATE INDEX "Contract_tenantId_parentContractId_idx" ON "Contract"("tenantId", "parentContractId");

-- CreateIndex
CREATE INDEX "Contract_relationshipType_idx" ON "Contract"("relationshipType");

-- CreateIndex
CREATE INDEX "Contract_tenantId_relationshipType_idx" ON "Contract"("tenantId", "relationshipType");

-- CreateIndex
CREATE INDEX "Contract_tenantId_status_totalValue_idx" ON "Contract"("tenantId", "status", "totalValue" DESC);

-- CreateIndex
CREATE INDEX "Contract_tenantId_status_expirationDate_idx" ON "Contract"("tenantId", "status", "expirationDate");

-- CreateIndex
CREATE INDEX "Contract_tenantId_category_status_createdAt_idx" ON "Contract"("tenantId", "category", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Contract_tenantId_clientName_status_idx" ON "Contract"("tenantId", "clientName", "status");

-- CreateIndex
CREATE INDEX "Contract_tenantId_supplierName_status_idx" ON "Contract"("tenantId", "supplierName", "status");

-- CreateIndex
CREATE INDEX "Contract_tenantId_uploadedAt_status_idx" ON "Contract"("tenantId", "uploadedAt", "status");

-- CreateIndex
CREATE INDEX "Contract_tenantId_effectiveDate_expirationDate_idx" ON "Contract"("tenantId", "effectiveDate", "expirationDate");

-- CreateIndex
CREATE INDEX "Contract_tenantId_createdAt_totalValue_idx" ON "Contract"("tenantId", "createdAt", "totalValue");

-- CreateIndex
CREATE INDEX "Contract_tenantId_clientName_category_createdAt_idx" ON "Contract"("tenantId", "clientName", "category", "createdAt");

-- CreateIndex
CREATE INDEX "Contract_tenantId_supplierName_category_createdAt_idx" ON "Contract"("tenantId", "supplierName", "category", "createdAt");

-- CreateIndex
CREATE INDEX "Contract_tenantId_category_effectiveDate_totalValue_idx" ON "Contract"("tenantId", "category", "effectiveDate", "totalValue");

-- CreateIndex
CREATE INDEX "Contract_tenantId_contractTitle_idx" ON "Contract"("tenantId", "contractTitle");

-- CreateIndex
CREATE INDEX "Contract_tenantId_description_idx" ON "Contract"("tenantId", "description");

-- CreateIndex
CREATE INDEX "Contract_tenantId_filename_idx" ON "Contract"("tenantId", "filename");

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_parentContractId_fkey" FOREIGN KEY ("parentContractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_card_entries" ADD CONSTRAINT "rate_card_entries_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
