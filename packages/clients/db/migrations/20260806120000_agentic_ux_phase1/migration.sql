-- Agentic UX Phase 1: previousValue/revertedAt on ai_decisions + analytics_events

-- Snapshot of field value before agent proposal (nullable for legacy rows)
ALTER TABLE "ai_decisions" ADD COLUMN IF NOT EXISTS "previous_value" JSONB;
ALTER TABLE "ai_decisions" ADD COLUMN IF NOT EXISTS "reverted_at" TIMESTAMP(3);

-- Product / UX analytics sink for agentic success metrics
CREATE TABLE IF NOT EXISTS "analytics_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "event" TEXT NOT NULL,
    "props" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_events_tenant_id_idx" ON "analytics_events"("tenant_id");
CREATE INDEX IF NOT EXISTS "analytics_events_tenant_id_event_idx" ON "analytics_events"("tenant_id", "event");
CREATE INDEX IF NOT EXISTS "analytics_events_tenant_id_created_at_idx" ON "analytics_events"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "analytics_events_event_created_at_idx" ON "analytics_events"("event", "created_at");
