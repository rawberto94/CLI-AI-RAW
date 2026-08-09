-- Policy Packs: packs, rules, evaluations, findings, waivers
-- Plus Contract.policy_pack_id and contract_health_scores policy columns

-- ---------------------------------------------------------------------------
-- Health score policy columns
-- ---------------------------------------------------------------------------
ALTER TABLE "contract_health_scores"
  ADD COLUMN IF NOT EXISTS "policy_score" INTEGER,
  ADD COLUMN IF NOT EXISTS "policy_violation_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "policy_status" TEXT;

-- ---------------------------------------------------------------------------
-- policy_packs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "policy_packs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "mode" TEXT NOT NULL DEFAULT 'advisory',
  "playbook_id" TEXT,
  "scope" JSONB NOT NULL DEFAULT '{}',
  "scoring" JSONB NOT NULL DEFAULT '{}',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "published_at" TIMESTAMP(3),
  "created_by" TEXT NOT NULL,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "policy_packs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "policy_packs_tenant_id_name_version_key"
  ON "policy_packs"("tenant_id", "name", "version");
CREATE INDEX IF NOT EXISTS "policy_packs_tenant_id_idx" ON "policy_packs"("tenant_id");
CREATE INDEX IF NOT EXISTS "policy_packs_tenant_id_status_idx" ON "policy_packs"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "policy_packs_tenant_id_is_default_idx" ON "policy_packs"("tenant_id", "is_default");

DO $$ BEGIN
  ALTER TABLE "policy_packs"
    ADD CONSTRAINT "policy_packs_playbook_id_fkey"
    FOREIGN KEY ("playbook_id") REFERENCES "playbooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- policy_rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "policy_rules" (
  "id" TEXT NOT NULL,
  "pack_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "category" TEXT NOT NULL,
  "applies_to" JSONB NOT NULL DEFAULT '{}',
  "assert" JSONB,
  "match" JSONB,
  "semantic" JSONB,
  "escalate_to_semantic" BOOLEAN NOT NULL DEFAULT false,
  "remediation" TEXT,
  "playbook_clause_id" TEXT,
  "reference" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "policy_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "policy_rules_pack_id_code_key" ON "policy_rules"("pack_id", "code");
CREATE INDEX IF NOT EXISTS "policy_rules_pack_id_idx" ON "policy_rules"("pack_id");
CREATE INDEX IF NOT EXISTS "policy_rules_pack_id_is_active_idx" ON "policy_rules"("pack_id", "is_active");
CREATE INDEX IF NOT EXISTS "policy_rules_category_idx" ON "policy_rules"("category");

DO $$ BEGIN
  ALTER TABLE "policy_rules"
    ADD CONSTRAINT "policy_rules_pack_id_fkey"
    FOREIGN KEY ("pack_id") REFERENCES "policy_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Contract.policy_pack_id (after policy_packs exists)
-- ---------------------------------------------------------------------------
ALTER TABLE "Contract"
  ADD COLUMN IF NOT EXISTS "policy_pack_id" TEXT;

CREATE INDEX IF NOT EXISTS "Contract_policy_pack_id_idx" ON "Contract"("policy_pack_id");

DO $$ BEGIN
  ALTER TABLE "Contract"
    ADD CONSTRAINT "Contract_policy_pack_id_fkey"
    FOREIGN KEY ("policy_pack_id") REFERENCES "policy_packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- policy_evaluations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "policy_evaluations" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "pack_id" TEXT NOT NULL,
  "pack_version" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "policy_score" INTEGER NOT NULL,
  "penalty" INTEGER NOT NULL DEFAULT 0,
  "applicable_rules" INTEGER NOT NULL DEFAULT 0,
  "evaluated_rules" INTEGER NOT NULL DEFAULT 0,
  "coverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "critical_count" INTEGER NOT NULL DEFAULT 0,
  "high_count" INTEGER NOT NULL DEFAULT 0,
  "medium_count" INTEGER NOT NULL DEFAULT 0,
  "low_count" INTEGER NOT NULL DEFAULT 0,
  "waived_count" INTEGER NOT NULL DEFAULT 0,
  "needs_review_count" INTEGER NOT NULL DEFAULT 0,
  "inputs_hash" TEXT NOT NULL,
  "facts_snapshot" JSONB NOT NULL DEFAULT '{}',
  "scoring_version" TEXT NOT NULL DEFAULT 'v1',
  "llm_calls" INTEGER NOT NULL DEFAULT 0,
  "tokens_used" INTEGER,
  "estimated_cost" DOUBLE PRECISION,
  "duration_ms" INTEGER,
  "triggered_by" TEXT NOT NULL DEFAULT 'pipeline',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "policy_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "policy_evaluations_contract_id_pack_id_inputs_hash_key"
  ON "policy_evaluations"("contract_id", "pack_id", "inputs_hash");
CREATE INDEX IF NOT EXISTS "policy_evaluations_tenant_id_idx" ON "policy_evaluations"("tenant_id");
CREATE INDEX IF NOT EXISTS "policy_evaluations_tenant_id_status_idx" ON "policy_evaluations"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "policy_evaluations_contract_id_created_at_idx"
  ON "policy_evaluations"("contract_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "policy_evaluations_tenant_id_policy_score_idx"
  ON "policy_evaluations"("tenant_id", "policy_score");

DO $$ BEGIN
  ALTER TABLE "policy_evaluations"
    ADD CONSTRAINT "policy_evaluations_pack_id_fkey"
    FOREIGN KEY ("pack_id") REFERENCES "policy_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "policy_evaluations"
    ADD CONSTRAINT "policy_evaluations_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- policy_waivers (before findings, which FK to waivers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "policy_waivers" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "rule_code" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'contract',
  "reason" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "approved_by" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "policy_waivers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "policy_waivers_tenant_id_contract_id_rule_code_key"
  ON "policy_waivers"("tenant_id", "contract_id", "rule_code");
CREATE INDEX IF NOT EXISTS "policy_waivers_tenant_id_status_idx" ON "policy_waivers"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "policy_waivers_contract_id_idx" ON "policy_waivers"("contract_id");

-- ---------------------------------------------------------------------------
-- policy_findings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "policy_findings" (
  "id" TEXT NOT NULL,
  "evaluation_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "rule_id" TEXT NOT NULL,
  "rule_code" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "evidence" JSONB NOT NULL DEFAULT '[]',
  "penalty_contribution" INTEGER NOT NULL DEFAULT 0,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "method" TEXT NOT NULL,
  "observed_value" JSONB,
  "expected_value" JSONB,
  "remediation" TEXT,
  "ai_decision_id" TEXT,
  "waiver_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "policy_findings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "policy_findings_evaluation_id_idx" ON "policy_findings"("evaluation_id");
CREATE INDEX IF NOT EXISTS "policy_findings_tenant_id_severity_idx" ON "policy_findings"("tenant_id", "severity");
CREATE INDEX IF NOT EXISTS "policy_findings_contract_id_status_idx" ON "policy_findings"("contract_id", "status");
CREATE INDEX IF NOT EXISTS "policy_findings_rule_code_idx" ON "policy_findings"("rule_code");

DO $$ BEGIN
  ALTER TABLE "policy_findings"
    ADD CONSTRAINT "policy_findings_evaluation_id_fkey"
    FOREIGN KEY ("evaluation_id") REFERENCES "policy_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "policy_findings"
    ADD CONSTRAINT "policy_findings_rule_id_fkey"
    FOREIGN KEY ("rule_id") REFERENCES "policy_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "policy_findings"
    ADD CONSTRAINT "policy_findings_waiver_id_fkey"
    FOREIGN KEY ("waiver_id") REFERENCES "policy_waivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- RLS (ENABLE, not FORCE — matches 20260805120000 pattern)
-- ---------------------------------------------------------------------------
ALTER TABLE "policy_packs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policy_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policy_evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policy_findings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policy_waivers" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY policy_packs_tenant_isolation ON "policy_packs"
    USING ("tenant_id" = COALESCE(current_setting('app.tenant_id', true), current_setting('app.current_tenant', true)));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY policy_evaluations_tenant_isolation ON "policy_evaluations"
    USING ("tenant_id" = COALESCE(current_setting('app.tenant_id', true), current_setting('app.current_tenant', true)));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY policy_findings_tenant_isolation ON "policy_findings"
    USING ("tenant_id" = COALESCE(current_setting('app.tenant_id', true), current_setting('app.current_tenant', true)));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY policy_waivers_tenant_isolation ON "policy_waivers"
    USING ("tenant_id" = COALESCE(current_setting('app.tenant_id', true), current_setting('app.current_tenant', true)));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- policy_rules is pack-scoped; isolate via pack join isn't needed when FORCE is off
-- and app always filters by pack.tenantId. Optional policy via pack ownership:
DO $$ BEGIN
  CREATE POLICY policy_rules_via_pack ON "policy_rules"
    USING (
      EXISTS (
        SELECT 1 FROM "policy_packs" p
        WHERE p.id = "policy_rules"."pack_id"
          AND p."tenant_id" = COALESCE(current_setting('app.tenant_id', true), current_setting('app.current_tenant', true))
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
