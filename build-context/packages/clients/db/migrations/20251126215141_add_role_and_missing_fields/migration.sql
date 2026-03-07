/*
  Warnings:

  - A unique constraint covering the columns `[key,tenantId]` on the table `idempotency_keys` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContractStatus" ADD VALUE 'ACTIVE';
ALTER TYPE "ContractStatus" ADD VALUE 'PENDING';
ALTER TYPE "ContractStatus" ADD VALUE 'DRAFT';
ALTER TYPE "ContractStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "ContractStatus" ADD VALUE 'CANCELLED';

-- DropIndex
DROP INDEX "idempotency_keys_key_key";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "changes" JSONB,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "ContractVersion" ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user';

-- AlterTable
ALTER TABLE "idempotency_keys" ADD COLUMN     "operation" TEXT;

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'APPROVAL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'APPROVAL',
    "assigned_role" TEXT,
    "assigned_user" TEXT,
    "config" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "timeout" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "current_step" TEXT,
    "initiated_by" TEXT NOT NULL,
    "metadata" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_executions" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assigned_to" TEXT,
    "completed_by" TEXT,
    "comments" TEXT,
    "metadata" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_step_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflows_tenant_id_idx" ON "workflows"("tenant_id");

-- CreateIndex
CREATE INDEX "workflows_is_active_idx" ON "workflows"("is_active");

-- CreateIndex
CREATE INDEX "workflows_type_idx" ON "workflows"("type");

-- CreateIndex
CREATE INDEX "workflow_steps_workflow_id_idx" ON "workflow_steps"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_steps_order_idx" ON "workflow_steps"("order");

-- CreateIndex
CREATE INDEX "workflow_executions_workflow_id_idx" ON "workflow_executions"("workflow_id");

-- CreateIndex
CREATE INDEX "workflow_executions_contract_id_idx" ON "workflow_executions"("contract_id");

-- CreateIndex
CREATE INDEX "workflow_executions_tenant_id_idx" ON "workflow_executions"("tenant_id");

-- CreateIndex
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions"("status");

-- CreateIndex
CREATE INDEX "workflow_step_executions_execution_id_idx" ON "workflow_step_executions"("execution_id");

-- CreateIndex
CREATE INDEX "workflow_step_executions_step_id_idx" ON "workflow_step_executions"("step_id");

-- CreateIndex
CREATE INDEX "workflow_step_executions_status_idx" ON "workflow_step_executions"("status");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "ContractVersion_tenantId_idx" ON "ContractVersion"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_tenantId_key" ON "idempotency_keys"("key", "tenantId");

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_executions" ADD CONSTRAINT "workflow_step_executions_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_executions" ADD CONSTRAINT "workflow_step_executions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
