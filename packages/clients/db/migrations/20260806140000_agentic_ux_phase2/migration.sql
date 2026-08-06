-- Agentic UX Phase 2: per-agent autonomy configuration
-- Defaults to mode=review so existing agents are never silently auto-upgraded.

CREATE TABLE IF NOT EXISTS "agent_autonomy_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL DEFAULT 'agent_write',
    "mode" TEXT NOT NULL DEFAULT 'review',
    "confidence_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "cost_threshold" DOUBLE PRECISION,
    "risk_threshold" TEXT NOT NULL DEFAULT 'medium',
    "notify_email" BOOLEAN NOT NULL DEFAULT true,
    "notify_in_app" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_autonomy_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_autonomy_configs_tenant_id_agent_id_action_type_key"
  ON "agent_autonomy_configs"("tenant_id", "agent_id", "action_type");

CREATE INDEX IF NOT EXISTS "agent_autonomy_configs_tenant_id_idx"
  ON "agent_autonomy_configs"("tenant_id");

CREATE INDEX IF NOT EXISTS "agent_autonomy_configs_tenant_id_agent_id_idx"
  ON "agent_autonomy_configs"("tenant_id", "agent_id");
