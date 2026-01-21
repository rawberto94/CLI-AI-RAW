-- CreateEnum
CREATE TYPE "ContractSourceProvider" AS ENUM ('SHAREPOINT', 'ONEDRIVE', 'GOOGLE_DRIVE', 'AZURE_BLOB', 'AWS_S3', 'SFTP', 'FTP', 'DROPBOX', 'BOX', 'CUSTOM_API');

-- CreateEnum
CREATE TYPE "ContractSourceStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'SYNCING', 'ERROR', 'AUTH_EXPIRED');

-- CreateEnum
CREATE TYPE "SyncMode" AS ENUM ('FULL', 'INCREMENTAL', 'DELTA');

-- CreateEnum
CREATE TYPE "SyncFileStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SourceSyncStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "ProcessingJob" ADD COLUMN     "job_type" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "body" TEXT,
ADD COLUMN     "read_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "contract_sources" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "provider" "ContractSourceProvider" NOT NULL,
    "status" "ContractSourceStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "credentials" JSONB,
    "connection_url" TEXT,
    "sync_folder" TEXT,
    "file_patterns" TEXT[] DEFAULT ARRAY['*.pdf', '*.docx', '*.doc']::TEXT[],
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "account_email" TEXT,
    "account_name" TEXT,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sync_interval" INTEGER NOT NULL DEFAULT 60,
    "sync_mode" "SyncMode" NOT NULL DEFAULT 'INCREMENTAL',
    "auto_process" BOOLEAN NOT NULL DEFAULT true,
    "max_file_size_mb" INTEGER NOT NULL DEFAULT 50,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" TEXT,
    "last_error_message" TEXT,
    "last_error_at" TIMESTAMP(3),
    "sync_cursor" TEXT,
    "total_files_synced" INTEGER NOT NULL DEFAULT 0,
    "total_bytes_synced" BIGINT NOT NULL DEFAULT 0,
    "connected_at" TIMESTAMP(3),
    "connected_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "contract_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synced_files" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "remote_id" TEXT NOT NULL,
    "remote_path" TEXT NOT NULL,
    "remote_hash" TEXT,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" BIGINT NOT NULL,
    "remote_created_at" TIMESTAMP(3),
    "remote_modified_at" TIMESTAMP(3),
    "contract_id" TEXT,
    "processing_status" "SyncFileStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "first_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sync_count" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "synced_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_syncs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "status" "SourceSyncStatus" NOT NULL DEFAULT 'PENDING',
    "syncMode" "SyncMode" NOT NULL,
    "triggered_by" TEXT,
    "files_found" INTEGER NOT NULL DEFAULT 0,
    "files_processed" INTEGER NOT NULL DEFAULT 0,
    "files_skipped" INTEGER NOT NULL DEFAULT 0,
    "files_failed" INTEGER NOT NULL DEFAULT 0,
    "bytes_transferred" BIGINT NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration" INTEGER,
    "error_message" TEXT,
    "error_details" JSONB,
    "sync_cursor" TEXT,
    "next_sync_cursor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "emailDigest" TEXT NOT NULL DEFAULT 'INSTANT',
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "contract_deadlines" BOOLEAN NOT NULL DEFAULT true,
    "approval_requests" BOOLEAN NOT NULL DEFAULT true,
    "comment_mentions" BOOLEAN NOT NULL DEFAULT true,
    "workflow_updates" BOOLEAN NOT NULL DEFAULT true,
    "system_alerts" BOOLEAN NOT NULL DEFAULT true,
    "system_updates" BOOLEAN NOT NULL DEFAULT true,
    "share_invites" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "quiet_hours_timezone" TEXT DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh_key" TEXT NOT NULL,
    "auth_key" TEXT NOT NULL,
    "expiration_time" BIGINT,
    "user_agent" TEXT,
    "device_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_memories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "context" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "source_conversation_id" TEXT,
    "embedding" vector(1024),
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_analyses" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "page_number" INTEGER NOT NULL,
    "extracted_text" TEXT,
    "tables" TEXT,
    "signatures" TEXT,
    "layout" TEXT,
    "entities" TEXT,
    "analysis_type" TEXT NOT NULL DEFAULT 'multimodal_vision',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "processing_time_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_sources_tenant_id_idx" ON "contract_sources"("tenant_id");

-- CreateIndex
CREATE INDEX "contract_sources_provider_idx" ON "contract_sources"("provider");

-- CreateIndex
CREATE INDEX "contract_sources_status_idx" ON "contract_sources"("status");

-- CreateIndex
CREATE INDEX "contract_sources_is_active_idx" ON "contract_sources"("is_active");

-- CreateIndex
CREATE INDEX "contract_sources_sync_enabled_idx" ON "contract_sources"("sync_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "contract_sources_tenant_id_provider_sync_folder_key" ON "contract_sources"("tenant_id", "provider", "sync_folder");

-- CreateIndex
CREATE INDEX "synced_files_tenant_id_idx" ON "synced_files"("tenant_id");

-- CreateIndex
CREATE INDEX "synced_files_source_id_idx" ON "synced_files"("source_id");

-- CreateIndex
CREATE INDEX "synced_files_contract_id_idx" ON "synced_files"("contract_id");

-- CreateIndex
CREATE INDEX "synced_files_processing_status_idx" ON "synced_files"("processing_status");

-- CreateIndex
CREATE INDEX "synced_files_remote_modified_at_idx" ON "synced_files"("remote_modified_at");

-- CreateIndex
CREATE UNIQUE INDEX "synced_files_source_id_remote_id_key" ON "synced_files"("source_id", "remote_id");

-- CreateIndex
CREATE INDEX "source_syncs_tenant_id_idx" ON "source_syncs"("tenant_id");

-- CreateIndex
CREATE INDEX "source_syncs_source_id_idx" ON "source_syncs"("source_id");

-- CreateIndex
CREATE INDEX "source_syncs_status_idx" ON "source_syncs"("status");

-- CreateIndex
CREATE INDEX "source_syncs_started_at_idx" ON "source_syncs"("started_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "notification_preferences_tenant_id_idx" ON "notification_preferences"("tenant_id");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_tenant_id_idx" ON "push_subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "push_subscriptions_is_active_idx" ON "push_subscriptions"("is_active");

-- CreateIndex
CREATE INDEX "ai_memories_tenant_id_idx" ON "ai_memories"("tenant_id");

-- CreateIndex
CREATE INDEX "ai_memories_user_id_idx" ON "ai_memories"("user_id");

-- CreateIndex
CREATE INDEX "ai_memories_type_idx" ON "ai_memories"("type");

-- CreateIndex
CREATE INDEX "ai_memories_importance_idx" ON "ai_memories"("importance");

-- CreateIndex
CREATE INDEX "ai_memories_last_accessed_at_idx" ON "ai_memories"("last_accessed_at");

-- CreateIndex
CREATE INDEX "contract_analyses_contract_id_idx" ON "contract_analyses"("contract_id");

-- CreateIndex
CREATE INDEX "contract_analyses_tenant_id_idx" ON "contract_analyses"("tenant_id");

-- CreateIndex
CREATE INDEX "contract_analyses_analysis_type_idx" ON "contract_analyses"("analysis_type");

-- CreateIndex
CREATE UNIQUE INDEX "contract_analyses_contract_id_page_number_key" ON "contract_analyses"("contract_id", "page_number");

-- AddForeignKey
ALTER TABLE "synced_files" ADD CONSTRAINT "synced_files_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "contract_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "synced_files" ADD CONSTRAINT "synced_files_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_syncs" ADD CONSTRAINT "source_syncs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "contract_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
