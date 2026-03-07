-- CreateEnum
CREATE TYPE "AgentGoalStatus" AS ENUM ('PENDING', 'PLANNING', 'AWAITING_APPROVAL', 'EXECUTING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgentGoalStepStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AgentTriggerType" AS ENUM ('SCHEDULE', 'EVENT', 'THRESHOLD', 'MANUAL');

-- CreateTable
CREATE TABLE "agent_goals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "status" "AgentGoalStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "contract_id" TEXT,
    "artifact_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "plan" JSONB,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "total_steps" INTEGER NOT NULL DEFAULT 0,
    "context" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "error" TEXT,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "scheduled_for" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_goal_steps" (
    "id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "AgentGoalStepStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_goal_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_triggers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "goal_id" TEXT,
    "name" TEXT NOT NULL,
    "type" "AgentTriggerType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "cron_expression" TEXT,
    "event_type" TEXT,
    "event_filter" JSONB,
    "metric" TEXT,
    "operator" TEXT,
    "threshold" DOUBLE PRECISION,
    "last_triggered_at" TIMESTAMP(3),
    "trigger_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_goals_tenant_id_idx" ON "agent_goals"("tenant_id");

-- CreateIndex
CREATE INDEX "agent_goals_user_id_idx" ON "agent_goals"("user_id");

-- CreateIndex
CREATE INDEX "agent_goals_status_idx" ON "agent_goals"("status");

-- CreateIndex
CREATE INDEX "agent_goals_contract_id_idx" ON "agent_goals"("contract_id");

-- CreateIndex
CREATE INDEX "agent_goals_tenant_id_status_idx" ON "agent_goals"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "agent_goals_scheduled_for_idx" ON "agent_goals"("scheduled_for");

-- CreateIndex
CREATE INDEX "agent_goal_steps_goal_id_idx" ON "agent_goal_steps"("goal_id");

-- CreateIndex
CREATE INDEX "agent_goal_steps_status_idx" ON "agent_goal_steps"("status");

-- CreateIndex
CREATE INDEX "agent_triggers_tenant_id_idx" ON "agent_triggers"("tenant_id");

-- CreateIndex
CREATE INDEX "agent_triggers_type_idx" ON "agent_triggers"("type");

-- CreateIndex
CREATE INDEX "agent_triggers_is_active_idx" ON "agent_triggers"("is_active");

-- AddForeignKey
ALTER TABLE "agent_goal_steps" ADD CONSTRAINT "agent_goal_steps_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "agent_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_triggers" ADD CONSTRAINT "agent_triggers_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "agent_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
