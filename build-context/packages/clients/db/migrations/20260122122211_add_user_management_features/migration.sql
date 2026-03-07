-- CreateEnum
CREATE TYPE "GdprRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "taxonomy_presets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categories" JSONB NOT NULL,
    "categoryCount" INTEGER NOT NULL DEFAULT 0,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taxonomy_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "GdprRequestStatus" NOT NULL DEFAULT 'PENDING',
    "format" TEXT NOT NULL DEFAULT 'json',
    "include_contracts" BOOLEAN NOT NULL DEFAULT true,
    "include_activity" BOOLEAN NOT NULL DEFAULT true,
    "include_chats" BOOLEAN NOT NULL DEFAULT true,
    "download_url" TEXT,
    "expires_at" TIMESTAMP(3),
    "file_size" BIGINT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "confirmation_token" TEXT,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "grace_period_ends" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error" TEXT,
    "deleted_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT,
    "contract_id" TEXT,
    "model" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_type" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "events" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "status_code" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_thresholds" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notify_email" TEXT,
    "notify_webhook" BOOLEAN NOT NULL DEFAULT true,
    "last_alert_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_alerts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "current_cost" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION,
    "period" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_tests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "model_a" TEXT NOT NULL,
    "model_b" TEXT NOT NULL,
    "prompt_type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "runs_count" INTEGER NOT NULL DEFAULT 0,
    "wins_a" INTEGER NOT NULL DEFAULT 0,
    "wins_b" INTEGER NOT NULL DEFAULT 0,
    "ties" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_test_results" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "user_id" TEXT,
    "prompt" TEXT NOT NULL,
    "response_a" TEXT,
    "response_b" TEXT,
    "latency_a" INTEGER,
    "latency_b" INTEGER,
    "tokens_a" INTEGER,
    "tokens_b" INTEGER,
    "winner" TEXT,
    "rating" INTEGER,
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ab_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "added_by" TEXT,

    CONSTRAINT "user_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "contract_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "access_rules" JSONB NOT NULL DEFAULT '{}',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_departments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT,

    CONSTRAINT "user_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_user_access" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_level" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" TEXT,
    "expires_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "contract_user_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_group_access" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "access_level" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" TEXT,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "contract_group_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_collaborators" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "organization" TEXT,
    "type" TEXT NOT NULL DEFAULT 'client',
    "access_token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_access_at" TIMESTAMP(3),
    "invited_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaborator_contract_access" (
    "id" TEXT NOT NULL,
    "collaborator_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collaborator_contract_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "taxonomy_presets_tenantId_idx" ON "taxonomy_presets"("tenantId");

-- CreateIndex
CREATE INDEX "taxonomy_presets_isShared_idx" ON "taxonomy_presets"("isShared");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomy_presets_tenantId_name_key" ON "taxonomy_presets"("tenantId", "name");

-- CreateIndex
CREATE INDEX "data_export_requests_tenant_id_idx" ON "data_export_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "data_export_requests_user_id_idx" ON "data_export_requests"("user_id");

-- CreateIndex
CREATE INDEX "data_export_requests_status_idx" ON "data_export_requests"("status");

-- CreateIndex
CREATE INDEX "data_export_requests_created_at_idx" ON "data_export_requests"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "deletion_requests_confirmation_token_key" ON "deletion_requests"("confirmation_token");

-- CreateIndex
CREATE INDEX "deletion_requests_tenant_id_idx" ON "deletion_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "deletion_requests_user_id_idx" ON "deletion_requests"("user_id");

-- CreateIndex
CREATE INDEX "deletion_requests_status_idx" ON "deletion_requests"("status");

-- CreateIndex
CREATE INDEX "deletion_requests_scheduled_for_idx" ON "deletion_requests"("scheduled_for");

-- CreateIndex
CREATE INDEX "deletion_requests_confirmation_token_idx" ON "deletion_requests"("confirmation_token");

-- CreateIndex
CREATE INDEX "ai_usage_logs_tenant_id_idx" ON "ai_usage_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "ai_usage_logs_user_id_idx" ON "ai_usage_logs"("user_id");

-- CreateIndex
CREATE INDEX "ai_usage_logs_model_idx" ON "ai_usage_logs"("model");

-- CreateIndex
CREATE INDEX "ai_usage_logs_endpoint_idx" ON "ai_usage_logs"("endpoint");

-- CreateIndex
CREATE INDEX "ai_usage_logs_feature_idx" ON "ai_usage_logs"("feature");

-- CreateIndex
CREATE INDEX "ai_usage_logs_created_at_idx" ON "ai_usage_logs"("created_at");

-- CreateIndex
CREATE INDEX "webhook_configs_tenant_id_idx" ON "webhook_configs"("tenant_id");

-- CreateIndex
CREATE INDEX "webhook_configs_active_idx" ON "webhook_configs"("active");

-- CreateIndex
CREATE INDEX "webhook_logs_webhook_id_idx" ON "webhook_logs"("webhook_id");

-- CreateIndex
CREATE INDEX "webhook_logs_event_idx" ON "webhook_logs"("event");

-- CreateIndex
CREATE INDEX "webhook_logs_created_at_idx" ON "webhook_logs"("created_at");

-- CreateIndex
CREATE INDEX "cost_thresholds_tenant_id_idx" ON "cost_thresholds"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_thresholds_tenant_id_period_key" ON "cost_thresholds"("tenant_id", "period");

-- CreateIndex
CREATE INDEX "cost_alerts_tenant_id_idx" ON "cost_alerts"("tenant_id");

-- CreateIndex
CREATE INDEX "cost_alerts_type_idx" ON "cost_alerts"("type");

-- CreateIndex
CREATE INDEX "cost_alerts_acknowledged_idx" ON "cost_alerts"("acknowledged");

-- CreateIndex
CREATE INDEX "cost_alerts_created_at_idx" ON "cost_alerts"("created_at");

-- CreateIndex
CREATE INDEX "ab_tests_tenant_id_idx" ON "ab_tests"("tenant_id");

-- CreateIndex
CREATE INDEX "ab_tests_active_idx" ON "ab_tests"("active");

-- CreateIndex
CREATE INDEX "ab_test_results_test_id_idx" ON "ab_test_results"("test_id");

-- CreateIndex
CREATE INDEX "ab_test_results_user_id_idx" ON "ab_test_results"("user_id");

-- CreateIndex
CREATE INDEX "ab_test_results_winner_idx" ON "ab_test_results"("winner");

-- CreateIndex
CREATE INDEX "ab_test_results_created_at_idx" ON "ab_test_results"("created_at");

-- CreateIndex
CREATE INDEX "user_groups_tenant_id_idx" ON "user_groups"("tenant_id");

-- CreateIndex
CREATE INDEX "user_groups_is_system_idx" ON "user_groups"("is_system");

-- CreateIndex
CREATE UNIQUE INDEX "user_groups_tenant_id_name_key" ON "user_groups"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "user_group_members_group_id_idx" ON "user_group_members"("group_id");

-- CreateIndex
CREATE INDEX "user_group_members_user_id_idx" ON "user_group_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_group_members_group_id_user_id_key" ON "user_group_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "departments_tenant_id_idx" ON "departments"("tenant_id");

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE INDEX "departments_is_system_idx" ON "departments"("is_system");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenant_id_name_key" ON "departments"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "user_departments_user_id_idx" ON "user_departments"("user_id");

-- CreateIndex
CREATE INDEX "user_departments_department_id_idx" ON "user_departments"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_departments_user_id_department_id_key" ON "user_departments"("user_id", "department_id");

-- CreateIndex
CREATE INDEX "contract_user_access_contract_id_idx" ON "contract_user_access"("contract_id");

-- CreateIndex
CREATE INDEX "contract_user_access_user_id_idx" ON "contract_user_access"("user_id");

-- CreateIndex
CREATE INDEX "contract_user_access_expires_at_idx" ON "contract_user_access"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "contract_user_access_contract_id_user_id_key" ON "contract_user_access"("contract_id", "user_id");

-- CreateIndex
CREATE INDEX "contract_group_access_contract_id_idx" ON "contract_group_access"("contract_id");

-- CreateIndex
CREATE INDEX "contract_group_access_group_id_idx" ON "contract_group_access"("group_id");

-- CreateIndex
CREATE INDEX "contract_group_access_expires_at_idx" ON "contract_group_access"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "contract_group_access_contract_id_group_id_key" ON "contract_group_access"("contract_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_collaborators_access_token_key" ON "external_collaborators"("access_token");

-- CreateIndex
CREATE INDEX "external_collaborators_tenant_id_idx" ON "external_collaborators"("tenant_id");

-- CreateIndex
CREATE INDEX "external_collaborators_access_token_idx" ON "external_collaborators"("access_token");

-- CreateIndex
CREATE INDEX "external_collaborators_status_idx" ON "external_collaborators"("status");

-- CreateIndex
CREATE INDEX "external_collaborators_expires_at_idx" ON "external_collaborators"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "external_collaborators_tenant_id_email_key" ON "external_collaborators"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "collaborator_contract_access_collaborator_id_idx" ON "collaborator_contract_access"("collaborator_id");

-- CreateIndex
CREATE INDEX "collaborator_contract_access_contract_id_idx" ON "collaborator_contract_access"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "collaborator_contract_access_collaborator_id_contract_id_key" ON "collaborator_contract_access"("collaborator_id", "contract_id");

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhook_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ab_test_results" ADD CONSTRAINT "ab_test_results_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "ab_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_group_access" ADD CONSTRAINT "contract_group_access_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborator_contract_access" ADD CONSTRAINT "collaborator_contract_access_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "external_collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
