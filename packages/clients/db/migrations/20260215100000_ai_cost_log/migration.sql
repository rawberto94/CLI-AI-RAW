-- CreateTable: Persistent AI cost tracking
CREATE TABLE "ai_cost_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "routed_from" TEXT,
    "savings_vs_4o" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "complexity" TEXT,
    "request_id" TEXT,
    "user_id" TEXT,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_cost_logs_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "ai_cost_logs_tenant_id_idx" ON "ai_cost_logs"("tenant_id");
CREATE INDEX "ai_cost_logs_tenant_id_created_at_idx" ON "ai_cost_logs"("tenant_id", "created_at");
CREATE INDEX "ai_cost_logs_model_idx" ON "ai_cost_logs"("model");
CREATE INDEX "ai_cost_logs_task_type_idx" ON "ai_cost_logs"("task_type");
CREATE INDEX "ai_cost_logs_created_at_idx" ON "ai_cost_logs"("created_at");