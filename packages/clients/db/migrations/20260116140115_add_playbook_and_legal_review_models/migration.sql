-- CreateTable
CREATE TABLE "playbooks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contract_types" JSONB NOT NULL DEFAULT '[]',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "critical_count_threshold" INTEGER NOT NULL DEFAULT 2,
    "high_risk_score_threshold" INTEGER NOT NULL DEFAULT 70,
    "acceptable_score_threshold" INTEGER NOT NULL DEFAULT 40,
    "preferred_language" JSONB NOT NULL DEFAULT '{}',
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_clauses" (
    "id" TEXT NOT NULL,
    "playbook_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "preferred_text" TEXT NOT NULL,
    "minimum_acceptable" TEXT,
    "walkaway_triggers" JSONB NOT NULL DEFAULT '[]',
    "risk_level" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "negotiation_guidance" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playbook_clauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_red_flags" (
    "id" TEXT NOT NULL,
    "playbook_id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "explanation" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "is_regex" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playbook_red_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbook_fallbacks" (
    "id" TEXT NOT NULL,
    "playbook_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "initial" TEXT NOT NULL,
    "fallback1" TEXT NOT NULL,
    "fallback2" TEXT,
    "walkaway" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playbook_fallbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_reviews" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "playbook_id" TEXT NOT NULL,
    "overall_risk_score" DOUBLE PRECISION NOT NULL,
    "overall_risk_level" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "recommendation_reason" TEXT,
    "total_clauses" INTEGER NOT NULL DEFAULT 0,
    "critical_issues" INTEGER NOT NULL DEFAULT 0,
    "high_risk_clauses" INTEGER NOT NULL DEFAULT 0,
    "redlines_generated" INTEGER NOT NULL DEFAULT 0,
    "clause_assessments" JSONB NOT NULL DEFAULT '[]',
    "redlines" JSONB NOT NULL DEFAULT '[]',
    "red_flags_found" JSONB NOT NULL DEFAULT '[]',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "playbooks_tenant_id_idx" ON "playbooks"("tenant_id");

-- CreateIndex
CREATE INDEX "playbooks_is_default_idx" ON "playbooks"("is_default");

-- CreateIndex
CREATE INDEX "playbooks_is_active_idx" ON "playbooks"("is_active");

-- CreateIndex
CREATE INDEX "playbooks_tenant_id_is_default_idx" ON "playbooks"("tenant_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "playbooks_tenant_id_name_version_key" ON "playbooks"("tenant_id", "name", "version");

-- CreateIndex
CREATE INDEX "playbook_clauses_playbook_id_idx" ON "playbook_clauses"("playbook_id");

-- CreateIndex
CREATE INDEX "playbook_clauses_category_idx" ON "playbook_clauses"("category");

-- CreateIndex
CREATE INDEX "playbook_clauses_playbook_id_category_idx" ON "playbook_clauses"("playbook_id", "category");

-- CreateIndex
CREATE INDEX "playbook_red_flags_playbook_id_idx" ON "playbook_red_flags"("playbook_id");

-- CreateIndex
CREATE INDEX "playbook_red_flags_category_idx" ON "playbook_red_flags"("category");

-- CreateIndex
CREATE INDEX "playbook_fallbacks_playbook_id_idx" ON "playbook_fallbacks"("playbook_id");

-- CreateIndex
CREATE UNIQUE INDEX "playbook_fallbacks_playbook_id_category_key" ON "playbook_fallbacks"("playbook_id", "category");

-- CreateIndex
CREATE INDEX "legal_reviews_tenant_id_idx" ON "legal_reviews"("tenant_id");

-- CreateIndex
CREATE INDEX "legal_reviews_contract_id_idx" ON "legal_reviews"("contract_id");

-- CreateIndex
CREATE INDEX "legal_reviews_playbook_id_idx" ON "legal_reviews"("playbook_id");

-- CreateIndex
CREATE INDEX "legal_reviews_status_idx" ON "legal_reviews"("status");

-- CreateIndex
CREATE INDEX "legal_reviews_tenant_id_status_idx" ON "legal_reviews"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "playbook_clauses" ADD CONSTRAINT "playbook_clauses_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_red_flags" ADD CONSTRAINT "playbook_red_flags_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_fallbacks" ADD CONSTRAINT "playbook_fallbacks_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_reviews" ADD CONSTRAINT "legal_reviews_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_reviews" ADD CONSTRAINT "legal_reviews_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
