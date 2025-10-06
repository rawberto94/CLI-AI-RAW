/*
  Warnings:

  - You are about to drop the column `name` on the `Contract` table. All the data in the column will be lost.
  - The `status` column on the `Contract` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `roleId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `PermissionsOnRoles` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[contractId,type]` on the table `Artifact` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.
  - Made the column `schemaVersion` on table `Artifact` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `contentType` to the `Contract` table without a default value. This is not possible if the table is not empty.
  - Added the required column `filename` to the `Contract` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `Contract` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Embedding` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Role` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Tenant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE', 'DELETED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIAL', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'INGESTION', 'TEMPLATE_ANALYSIS', 'FINANCIAL_ANALYSIS', 'OVERVIEW_ANALYSIS', 'CLAUSES_ANALYSIS', 'COMPLIANCE_ANALYSIS', 'RISK_ANALYSIS', 'RATES_ANALYSIS', 'BENCHMARK_ANALYSIS', 'REPORT_GENERATION', 'COMPLETED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ArtifactType" ADD VALUE 'TEMPLATE';
ALTER TYPE "ArtifactType" ADD VALUE 'FINANCIAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RunStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "RunStatus" ADD VALUE 'TIMEOUT';

-- DropForeignKey
ALTER TABLE "PermissionsOnRoles" DROP CONSTRAINT "PermissionsOnRoles_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "PermissionsOnRoles" DROP CONSTRAINT "PermissionsOnRoles_roleId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_roleId_fkey";

-- AlterTable
ALTER TABLE "Artifact" ADD COLUMN     "confidence" DECIMAL(3,2),
ADD COLUMN     "processingTime" INTEGER,
ADD COLUMN     "size" INTEGER,
ADD COLUMN     "storageProvider" TEXT DEFAULT 'database',
ALTER COLUMN "schemaVersion" SET NOT NULL;

-- AlterTable
ALTER TABLE "Contract" DROP COLUMN "name",
ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "contentType" TEXT NOT NULL,
ADD COLUMN     "contractType" TEXT,
ADD COLUMN     "effectiveDate" TIMESTAMP(3),
ADD COLUMN     "expirationDate" TIMESTAMP(3),
ADD COLUMN     "filename" TEXT NOT NULL,
ADD COLUMN     "jurisdiction" TEXT,
ADD COLUMN     "lastAnalyzedAt" TIMESTAMP(3),
ADD COLUMN     "originalName" TEXT,
ADD COLUMN     "parties" JSONB,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "searchMetadata" JSONB DEFAULT '{}',
ADD COLUMN     "size" BIGINT NOT NULL,
ADD COLUMN     "storageProvider" TEXT DEFAULT 'local',
ADD COLUMN     "uploadedBy" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "ContractStatus" NOT NULL DEFAULT 'UPLOADED';

-- AlterTable
ALTER TABLE "Embedding" ADD COLUMN     "chunkType" TEXT,
ADD COLUMN     "confidence" DECIMAL(3,2),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "embedding" JSONB,
ADD COLUMN     "section" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "conditions" JSONB;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "completedSteps" INTEGER DEFAULT 0,
ADD COLUMN     "currentStep" TEXT,
ADD COLUMN     "errorDetails" JSONB,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "jobType" TEXT,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "processingTime" INTEGER,
ADD COLUMN     "totalSteps" INTEGER;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
DROP COLUMN "roleId",
ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "passwordHash" TEXT NOT NULL,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tenantId" TEXT NOT NULL;

-- DropTable
DROP TABLE "PermissionsOnRoles";

-- CreateTable
CREATE TABLE "TenantConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "aiModels" JSONB NOT NULL DEFAULT '{}',
    "aiCostBudget" DECIMAL(10,2),
    "aiCostAlerts" BOOLEAN NOT NULL DEFAULT true,
    "securitySettings" JSONB NOT NULL DEFAULT '{}',
    "integrations" JSONB NOT NULL DEFAULT '{}',
    "workflowSettings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "billingCycle" "BillingCycle" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractsProcessed" INTEGER NOT NULL DEFAULT 0,
    "aiTokensUsed" BIGINT NOT NULL DEFAULT 0,
    "storageUsed" BIGINT NOT NULL DEFAULT 0,
    "apiCallsCount" INTEGER NOT NULL DEFAULT 0,
    "monthlyContractLimit" INTEGER,
    "monthlyTokenLimit" BIGINT,
    "monthlyStorageLimit" BIGINT,
    "monthlyApiLimit" INTEGER,
    "resetDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateAnalysis" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "detectedTemplates" JSONB NOT NULL,
    "complianceScore" DECIMAL(3,2),
    "deviations" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "processingTime" INTEGER,
    "confidence" DECIMAL(3,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAnalysis" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "totalValue" JSONB,
    "paymentTerms" JSONB,
    "costBreakdown" JSONB,
    "pricingTables" JSONB,
    "discounts" JSONB,
    "escalationClauses" JSONB,
    "financialRisks" JSONB,
    "recommendations" JSONB,
    "processingTime" INTEGER,
    "confidence" DECIMAL(3,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverviewAnalysis" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "summary" TEXT,
    "parties" JSONB,
    "keyTerms" JSONB,
    "contractType" TEXT,
    "jurisdiction" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "renewalTerms" JSONB,
    "terminationClauses" JSONB,
    "processingTime" INTEGER,
    "confidence" DECIMAL(3,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OverviewAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "clauses" JSONB NOT NULL,
    "structure" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceType" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Metric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "value" DECIMAL(15,4) NOT NULL,
    "unit" TEXT,
    "tags" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantConfig_tenantId_key" ON "TenantConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSubscription_tenantId_key" ON "TenantSubscription"("tenantId");

-- CreateIndex
CREATE INDEX "TenantSubscription_status_idx" ON "TenantSubscription"("status");

-- CreateIndex
CREATE INDEX "TenantSubscription_endDate_idx" ON "TenantSubscription"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "TenantUsage_tenantId_key" ON "TenantUsage"("tenantId");

-- CreateIndex
CREATE INDEX "TenantUsage_resetDate_idx" ON "TenantUsage"("resetDate");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_key" ON "UserSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_refreshToken_key" ON "UserSession"("refreshToken");

-- CreateIndex
CREATE INDEX "UserSession_token_idx" ON "UserSession"("token");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "TemplateAnalysis_contractId_idx" ON "TemplateAnalysis"("contractId");

-- CreateIndex
CREATE INDEX "TemplateAnalysis_tenantId_idx" ON "TemplateAnalysis"("tenantId");

-- CreateIndex
CREATE INDEX "TemplateAnalysis_complianceScore_idx" ON "TemplateAnalysis"("complianceScore");

-- CreateIndex
CREATE INDEX "FinancialAnalysis_contractId_idx" ON "FinancialAnalysis"("contractId");

-- CreateIndex
CREATE INDEX "FinancialAnalysis_tenantId_idx" ON "FinancialAnalysis"("tenantId");

-- CreateIndex
CREATE INDEX "OverviewAnalysis_contractId_idx" ON "OverviewAnalysis"("contractId");

-- CreateIndex
CREATE INDEX "OverviewAnalysis_tenantId_idx" ON "OverviewAnalysis"("tenantId");

-- CreateIndex
CREATE INDEX "OverviewAnalysis_contractType_idx" ON "OverviewAnalysis"("contractType");

-- CreateIndex
CREATE INDEX "ContractTemplate_tenantId_idx" ON "ContractTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "ContractTemplate_category_idx" ON "ContractTemplate"("category");

-- CreateIndex
CREATE INDEX "ContractTemplate_isActive_idx" ON "ContractTemplate"("isActive");

-- CreateIndex
CREATE INDEX "ContractTemplate_tenantId_category_idx" ON "ContractTemplate"("tenantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ContractTemplate_tenantId_name_version_key" ON "ContractTemplate"("tenantId", "name", "version");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_idx" ON "AuditLog"("resourceType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_action_idx" ON "AuditLog"("tenantId", "action");

-- CreateIndex
CREATE INDEX "Metric_name_idx" ON "Metric"("name");

-- CreateIndex
CREATE INDEX "Metric_tenantId_idx" ON "Metric"("tenantId");

-- CreateIndex
CREATE INDEX "Metric_timestamp_idx" ON "Metric"("timestamp");

-- CreateIndex
CREATE INDEX "Metric_name_timestamp_idx" ON "Metric"("name", "timestamp");

-- CreateIndex
CREATE INDEX "Metric_tenantId_name_timestamp_idx" ON "Metric"("tenantId", "name", "timestamp");

-- CreateIndex
CREATE INDEX "Artifact_type_idx" ON "Artifact"("type");

-- CreateIndex
CREATE INDEX "Artifact_tenantId_type_idx" ON "Artifact"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_contractId_type_key" ON "Artifact"("contractId", "type");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "Contract_processingStatus_idx" ON "Contract"("processingStatus");

-- CreateIndex
CREATE INDEX "Contract_contractType_idx" ON "Contract"("contractType");

-- CreateIndex
CREATE INDEX "Contract_createdAt_idx" ON "Contract"("createdAt");

-- CreateIndex
CREATE INDEX "Contract_tenantId_status_idx" ON "Contract"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Contract_tenantId_contractType_idx" ON "Contract"("tenantId", "contractType");

-- CreateIndex
CREATE INDEX "Embedding_chunkType_idx" ON "Embedding"("chunkType");

-- CreateIndex
CREATE INDEX "Run_status_idx" ON "Run"("status");

-- CreateIndex
CREATE INDEX "Run_startedAt_idx" ON "Run"("startedAt");

-- CreateIndex
CREATE INDEX "Run_tenantId_status_idx" ON "Run"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE INDEX "Tenant_createdAt_idx" ON "Tenant"("createdAt");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- AddForeignKey
ALTER TABLE "TenantConfig" ADD CONSTRAINT "TenantConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantUsage" ADD CONSTRAINT "TenantUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateAnalysis" ADD CONSTRAINT "TemplateAnalysis_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAnalysis" ADD CONSTRAINT "FinancialAnalysis_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverviewAnalysis" ADD CONSTRAINT "OverviewAnalysis_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractTemplate" ADD CONSTRAINT "ContractTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Metric" ADD CONSTRAINT "Metric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
