-- CreateTable
CREATE TABLE "agent_events" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "reasoning" TEXT,
    "confidence" DECIMAL(3,2),
    "duration" INTEGER,
    "triggered_by" TEXT,

    CONSTRAINT "agent_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_recommendations" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "automated" BOOLEAN NOT NULL DEFAULT false,
    "estimated_impact" JSONB DEFAULT '{}',
    "potential_value" DECIMAL(15,2),
    "confidence" DECIMAL(3,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "executed_at" TIMESTAMP(3),
    "executed_by" TEXT,
    "result" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "artifact_type" TEXT NOT NULL,
    "contract_type" TEXT,
    "field" TEXT NOT NULL,
    "ai_extracted" TEXT,
    "user_corrected" TEXT,
    "confidence" DECIMAL(3,2),
    "contract_length" INTEGER,
    "ocr_quality" DECIMAL(3,2),
    "model_used" TEXT,
    "prompt_version" TEXT,
    "correction_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_discoveries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "opportunity_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "potential_value" DECIMAL(15,2) NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "effort" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "related_contracts" JSONB DEFAULT '[]',
    "action_plan" JSONB DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'new',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "actual_value" DECIMAL(15,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_discoveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_events_contract_id_idx" ON "agent_events"("contract_id");

-- CreateIndex
CREATE INDEX "agent_events_tenant_id_idx" ON "agent_events"("tenant_id");

-- CreateIndex
CREATE INDEX "agent_events_agent_name_idx" ON "agent_events"("agent_name");

-- CreateIndex
CREATE INDEX "agent_events_event_type_idx" ON "agent_events"("event_type");

-- CreateIndex
CREATE INDEX "agent_events_timestamp_idx" ON "agent_events"("timestamp");

-- CreateIndex
CREATE INDEX "agent_events_outcome_idx" ON "agent_events"("outcome");

-- CreateIndex
CREATE INDEX "agent_events_tenant_id_agent_name_idx" ON "agent_events"("tenant_id", "agent_name");

-- CreateIndex
CREATE INDEX "agent_events_contract_id_agent_name_idx" ON "agent_events"("contract_id", "agent_name");

-- CreateIndex
CREATE INDEX "agent_recommendations_contract_id_idx" ON "agent_recommendations"("contract_id");

-- CreateIndex
CREATE INDEX "agent_recommendations_tenant_id_idx" ON "agent_recommendations"("tenant_id");

-- CreateIndex
CREATE INDEX "agent_recommendations_agent_name_idx" ON "agent_recommendations"("agent_name");

-- CreateIndex
CREATE INDEX "agent_recommendations_status_idx" ON "agent_recommendations"("status");

-- CreateIndex
CREATE INDEX "agent_recommendations_priority_idx" ON "agent_recommendations"("priority");

-- CreateIndex
CREATE INDEX "agent_recommendations_created_at_idx" ON "agent_recommendations"("created_at");

-- CreateIndex
CREATE INDEX "agent_recommendations_tenant_id_status_idx" ON "agent_recommendations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "agent_recommendations_contract_id_status_idx" ON "agent_recommendations"("contract_id", "status");

-- CreateIndex
CREATE INDEX "learning_records_tenant_id_idx" ON "learning_records"("tenant_id");

-- CreateIndex
CREATE INDEX "learning_records_artifact_type_idx" ON "learning_records"("artifact_type");

-- CreateIndex
CREATE INDEX "learning_records_contract_type_idx" ON "learning_records"("contract_type");

-- CreateIndex
CREATE INDEX "learning_records_field_idx" ON "learning_records"("field");

-- CreateIndex
CREATE INDEX "learning_records_created_at_idx" ON "learning_records"("created_at");

-- CreateIndex
CREATE INDEX "learning_records_tenant_id_artifact_type_field_idx" ON "learning_records"("tenant_id", "artifact_type", "field");

-- CreateIndex
CREATE INDEX "opportunity_discoveries_tenant_id_idx" ON "opportunity_discoveries"("tenant_id");

-- CreateIndex
CREATE INDEX "opportunity_discoveries_contract_id_idx" ON "opportunity_discoveries"("contract_id");

-- CreateIndex
CREATE INDEX "opportunity_discoveries_opportunity_type_idx" ON "opportunity_discoveries"("opportunity_type");

-- CreateIndex
CREATE INDEX "opportunity_discoveries_status_idx" ON "opportunity_discoveries"("status");

-- CreateIndex
CREATE INDEX "opportunity_discoveries_created_at_idx" ON "opportunity_discoveries"("created_at");

-- CreateIndex
CREATE INDEX "opportunity_discoveries_potential_value_idx" ON "opportunity_discoveries"("potential_value" DESC);

-- CreateIndex
CREATE INDEX "opportunity_discoveries_tenant_id_status_idx" ON "opportunity_discoveries"("tenant_id", "status");
