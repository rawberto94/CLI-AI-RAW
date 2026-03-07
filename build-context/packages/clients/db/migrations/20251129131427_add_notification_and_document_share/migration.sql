/*
  Warnings:

  - You are about to drop the column `comments` on the `workflow_step_executions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "workflow_executions" ADD COLUMN     "due_date" TIMESTAMP(3),
ADD COLUMN     "started_by" TEXT,
ALTER COLUMN "initiated_by" DROP NOT NULL;

-- AlterTable
ALTER TABLE "workflow_step_executions" DROP COLUMN "comments",
ADD COLUMN     "result" JSONB,
ADD COLUMN     "step_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "step_order" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "version" TEXT,
    "config" JSONB,
    "credentials" JSONB,
    "last_sync_at" TIMESTAMP(3),
    "last_health_check" TIMESTAMP(3),
    "healthStatus" TEXT DEFAULT 'UNKNOWN',
    "error_message" TEXT,
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "documents_processed" INTEGER NOT NULL DEFAULT 0,
    "uptime" DOUBLE PRECISION DEFAULT 100,
    "errors_24h" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'INBOUND',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "syncType" TEXT NOT NULL DEFAULT 'FULL',
    "records_total" INTEGER NOT NULL DEFAULT 0,
    "records_success" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "records_skipped" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "error_message" TEXT,
    "error_details" JSONB,
    "metadata" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_shares" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "shared_with" TEXT NOT NULL,
    "shared_by" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'VIEW',
    "access_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "accessed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integrations_tenant_id_idx" ON "integrations"("tenant_id");

-- CreateIndex
CREATE INDEX "integrations_status_idx" ON "integrations"("status");

-- CreateIndex
CREATE INDEX "integrations_type_idx" ON "integrations"("type");

-- CreateIndex
CREATE INDEX "integrations_provider_idx" ON "integrations"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_tenant_id_provider_key" ON "integrations"("tenant_id", "provider");

-- CreateIndex
CREATE INDEX "sync_logs_integration_id_idx" ON "sync_logs"("integration_id");

-- CreateIndex
CREATE INDEX "sync_logs_tenant_id_idx" ON "sync_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "sync_logs_status_idx" ON "sync_logs"("status");

-- CreateIndex
CREATE INDEX "sync_logs_started_at_idx" ON "sync_logs"("started_at");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_user_id_idx" ON "notifications"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_shares_access_token_key" ON "document_shares"("access_token");

-- CreateIndex
CREATE INDEX "document_shares_tenant_id_idx" ON "document_shares"("tenant_id");

-- CreateIndex
CREATE INDEX "document_shares_document_id_document_type_idx" ON "document_shares"("document_id", "document_type");

-- CreateIndex
CREATE INDEX "document_shares_shared_with_idx" ON "document_shares"("shared_with");

-- CreateIndex
CREATE INDEX "document_shares_access_token_idx" ON "document_shares"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "document_shares_document_id_document_type_shared_with_key" ON "document_shares"("document_id", "document_type", "shared_with");

-- CreateIndex
CREATE INDEX "workflow_executions_due_date_idx" ON "workflow_executions"("due_date");

-- CreateIndex
CREATE INDEX "workflow_step_executions_step_order_idx" ON "workflow_step_executions"("step_order");

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
