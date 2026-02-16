-- Feature Integration Migration
-- Adds all models needed for the 67-feature integration backlog (Phases 0-5)
-- ============================================================================
-- A) INTAKE / TRIAGE
-- ============================================================================
-- Contract Request (intake form submissions from requester users)
CREATE TABLE IF NOT EXISTS "contract_requests" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "requester_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "request_type" TEXT NOT NULL DEFAULT 'NEW_CONTRACT',
  "urgency" TEXT NOT NULL DEFAULT 'MEDIUM',
  "department" TEXT,
  "cost_center" TEXT,
  "estimated_value" DECIMAL(15, 2),
  "currency" TEXT DEFAULT 'USD',
  "counterparty_name" TEXT,
  "counterparty_email" TEXT,
  "contract_type" TEXT,
  "desired_start_date" TIMESTAMP(3),
  "desired_end_date" TIMESTAMP(3),
  "business_justification" TEXT,
  "attachments" JSONB DEFAULT '[]',
  "custom_fields" JSONB DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "assigned_to" TEXT,
  "triage_notes" TEXT,
  "triage_priority" TEXT,
  "triaged_at" TIMESTAMP(3),
  "triaged_by" TEXT,
  "sla_deadline" TIMESTAMP(3),
  "escalated" BOOLEAN DEFAULT false,
  "escalated_at" TIMESTAMP(3),
  "contract_id" TEXT,
  "rejected_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "contract_requests_tenant_id_idx" ON "contract_requests"("tenant_id");
CREATE INDEX IF NOT EXISTS "contract_requests_requester_id_idx" ON "contract_requests"("requester_id");
CREATE INDEX IF NOT EXISTS "contract_requests_status_idx" ON "contract_requests"("status");
CREATE INDEX IF NOT EXISTS "contract_requests_assigned_to_idx" ON "contract_requests"("assigned_to");
CREATE INDEX IF NOT EXISTS "contract_requests_sla_idx" ON "contract_requests"("tenant_id", "status", "sla_deadline");
-- Triage / Routing Rules
CREATE TABLE IF NOT EXISTS "routing_rules" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN DEFAULT true,
  "priority" INTEGER DEFAULT 0,
  "conditions" JSONB NOT NULL DEFAULT '[]',
  "actions" JSONB NOT NULL DEFAULT '{}',
  "assigned_team" TEXT,
  "assigned_user" TEXT,
  "sla_hours" INTEGER,
  "auto_approve" BOOLEAN DEFAULT false,
  "created_by" TEXT NOT NULL,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "routing_rules_tenant_id_idx" ON "routing_rules"("tenant_id");
CREATE INDEX IF NOT EXISTS "routing_rules_active_idx" ON "routing_rules"("tenant_id", "is_active");
-- Pre-Approval Gates
CREATE TABLE IF NOT EXISTS "pre_approval_gates" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "gate_type" TEXT NOT NULL DEFAULT 'BUDGET',
  "is_active" BOOLEAN DEFAULT true,
  "conditions" JSONB NOT NULL DEFAULT '{}',
  "required_approver_role" TEXT,
  "auto_pass_below" DECIMAL(15, 2),
  "currency" TEXT DEFAULT 'USD',
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "pre_approval_gates_tenant_id_idx" ON "pre_approval_gates"("tenant_id");
-- ============================================================================
-- B) CLAUSE GOVERNANCE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "clause_approvals" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "clause_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "submitted_by" TEXT NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_notes" TEXT,
  "version" INTEGER DEFAULT 1,
  "changes_summary" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "clause_approvals_tenant_id_idx" ON "clause_approvals"("tenant_id");
CREATE INDEX IF NOT EXISTS "clause_approvals_clause_idx" ON "clause_approvals"("clause_id");
CREATE INDEX IF NOT EXISTS "clause_approvals_status_idx" ON "clause_approvals"("tenant_id", "status");
-- ============================================================================
-- D) APPROVAL GOVERNANCE
-- ============================================================================
-- Delegation of Authority Matrix
CREATE TABLE IF NOT EXISTS "delegation_of_authority" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "department" TEXT,
  "contract_types" JSONB DEFAULT '[]',
  "max_value" DECIMAL(15, 2),
  "currency" TEXT DEFAULT 'USD',
  "requires_counter_sign" BOOLEAN DEFAULT false,
  "counter_sign_role" TEXT,
  "can_delegate" BOOLEAN DEFAULT true,
  "delegation_depth" INTEGER DEFAULT 1,
  "conditions" JSONB DEFAULT '{}',
  "is_active" BOOLEAN DEFAULT true,
  "effective_from" TIMESTAMP(3),
  "effective_until" TIMESTAMP(3),
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "doa_tenant_id_idx" ON "delegation_of_authority"("tenant_id");
CREATE INDEX IF NOT EXISTS "doa_role_idx" ON "delegation_of_authority"("tenant_id", "role");
-- Signature Policy Rules
CREATE TABLE IF NOT EXISTS "signature_policies" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "contract_types" JSONB DEFAULT '[]',
  "min_value" DECIMAL(15, 2),
  "max_value" DECIMAL(15, 2),
  "currency" TEXT DEFAULT 'USD',
  "required_signatories" JSONB NOT NULL DEFAULT '[]',
  "signing_order" TEXT DEFAULT 'SEQUENTIAL',
  "requires_wet_signature" BOOLEAN DEFAULT false,
  "requires_notarization" BOOLEAN DEFAULT false,
  "provider" TEXT DEFAULT 'DOCUSIGN',
  "is_active" BOOLEAN DEFAULT true,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "sig_policies_tenant_id_idx" ON "signature_policies"("tenant_id");
-- ============================================================================
-- E) POST-SIGNATURE EXECUTION
-- ============================================================================
-- Evidence Repository
CREATE TABLE IF NOT EXISTS "evidence_items" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "obligation_id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "evidence_type" TEXT NOT NULL DEFAULT 'DOCUMENT',
  "file_url" TEXT,
  "file_name" TEXT,
  "file_size" INTEGER,
  "mime_type" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "verified_by" TEXT,
  "verified_at" TIMESTAMP(3),
  "verification_notes" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "tags" JSONB DEFAULT '[]',
  "uploaded_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "evidence_tenant_id_idx" ON "evidence_items"("tenant_id");
CREATE INDEX IF NOT EXISTS "evidence_obligation_idx" ON "evidence_items"("obligation_id");
CREATE INDEX IF NOT EXISTS "evidence_contract_idx" ON "evidence_items"("contract_id");
-- Amendment Workflows
CREATE TABLE IF NOT EXISTS "amendments" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "original_contract_id" TEXT NOT NULL,
  "amended_contract_id" TEXT,
  "amendment_number" INTEGER DEFAULT 1,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "amendment_type" TEXT NOT NULL DEFAULT 'MODIFICATION',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "changes_summary" JSONB DEFAULT '[]',
  "effective_date" TIMESTAMP(3),
  "financial_impact" DECIMAL(15, 2),
  "currency" TEXT DEFAULT 'USD',
  "requires_re_signature" BOOLEAN DEFAULT true,
  "initiated_by" TEXT NOT NULL,
  "approved_by" TEXT,
  "approved_at" TIMESTAMP(3),
  "executed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "amendments_tenant_id_idx" ON "amendments"("tenant_id");
CREATE INDEX IF NOT EXISTS "amendments_contract_idx" ON "amendments"("original_contract_id");
CREATE INDEX IF NOT EXISTS "amendments_status_idx" ON "amendments"("tenant_id", "status");
-- ============================================================================
-- F) SUPPLIER LIFECYCLE
-- ============================================================================
-- Vendor Risk Profiles
CREATE TABLE IF NOT EXISTS "vendor_risk_profiles" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "vendor_name" TEXT NOT NULL,
  "vendor_id" TEXT,
  "risk_tier" TEXT NOT NULL DEFAULT 'MEDIUM',
  "overall_score" INTEGER DEFAULT 50,
  "financial_risk" INTEGER DEFAULT 50,
  "operational_risk" INTEGER DEFAULT 50,
  "compliance_risk" INTEGER DEFAULT 50,
  "cyber_risk" INTEGER DEFAULT 50,
  "geopolitical_risk" INTEGER DEFAULT 50,
  "questionnaire_responses" JSONB DEFAULT '{}',
  "last_assessment_date" TIMESTAMP(3),
  "next_assessment_due" TIMESTAMP(3),
  "certifications" JSONB DEFAULT '[]',
  "insurance_details" JSONB DEFAULT '{}',
  "notes" TEXT,
  "assessed_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "vrp_tenant_id_idx" ON "vendor_risk_profiles"("tenant_id");
CREATE INDEX IF NOT EXISTS "vrp_risk_tier_idx" ON "vendor_risk_profiles"("tenant_id", "risk_tier");
CREATE INDEX IF NOT EXISTS "vrp_vendor_name_idx" ON "vendor_risk_profiles"("tenant_id", "vendor_name");
-- Document Expiry Monitoring
CREATE TABLE IF NOT EXISTS "document_expiry_items" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "vendor_name" TEXT NOT NULL,
  "vendor_id" TEXT,
  "document_type" TEXT NOT NULL,
  "document_name" TEXT NOT NULL,
  "file_url" TEXT,
  "issue_date" TIMESTAMP(3),
  "expiry_date" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "alert_days_before" JSONB DEFAULT '[90, 60, 30, 14]',
  "last_alert_sent" TIMESTAMP(3),
  "renewal_notes" TEXT,
  "auto_notify" BOOLEAN DEFAULT true,
  "notify_emails" JSONB DEFAULT '[]',
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "doc_expiry_tenant_idx" ON "document_expiry_items"("tenant_id");
CREATE INDEX IF NOT EXISTS "doc_expiry_date_idx" ON "document_expiry_items"("expiry_date");
CREATE INDEX IF NOT EXISTS "doc_expiry_status_idx" ON "document_expiry_items"("tenant_id", "status");
-- ============================================================================
-- G) SPEND / PO LINKAGE
-- ============================================================================
-- Purchase Orders
CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "po_number" TEXT NOT NULL,
  "contract_id" TEXT,
  "vendor_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "total_amount" DECIMAL(15, 2) NOT NULL,
  "currency" TEXT DEFAULT 'USD',
  "line_items" JSONB DEFAULT '[]',
  "department" TEXT,
  "cost_center" TEXT,
  "budget_code" TEXT,
  "requested_by" TEXT NOT NULL,
  "approved_by" TEXT,
  "approved_at" TIMESTAMP(3),
  "issued_at" TIMESTAMP(3),
  "delivery_date" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "po_tenant_idx" ON "purchase_orders"("tenant_id");
CREATE INDEX IF NOT EXISTS "po_number_idx" ON "purchase_orders"("tenant_id", "po_number");
CREATE INDEX IF NOT EXISTS "po_contract_idx" ON "purchase_orders"("contract_id");
CREATE UNIQUE INDEX IF NOT EXISTS "po_number_unique" ON "purchase_orders"("tenant_id", "po_number");
-- Invoices
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "po_id" TEXT,
  "contract_id" TEXT,
  "vendor_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "total_amount" DECIMAL(15, 2) NOT NULL,
  "currency" TEXT DEFAULT 'USD',
  "line_items" JSONB DEFAULT '[]',
  "invoice_date" TIMESTAMP(3),
  "due_date" TIMESTAMP(3),
  "paid_date" TIMESTAMP(3),
  "match_status" TEXT DEFAULT 'UNMATCHED',
  "match_discrepancies" JSONB DEFAULT '[]',
  "payment_terms" TEXT,
  "notes" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "inv_tenant_idx" ON "invoices"("tenant_id");
CREATE INDEX IF NOT EXISTS "inv_po_idx" ON "invoices"("po_id");
CREATE INDEX IF NOT EXISTS "inv_contract_idx" ON "invoices"("contract_id");
CREATE INDEX IF NOT EXISTS "inv_match_idx" ON "invoices"("tenant_id", "match_status");
-- Spend Exceptions
CREATE TABLE IF NOT EXISTS "spend_exceptions" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "exception_type" TEXT NOT NULL DEFAULT 'RATE_DEVIATION',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "contract_id" TEXT,
  "po_id" TEXT,
  "invoice_id" TEXT,
  "expected_amount" DECIMAL(15, 2),
  "actual_amount" DECIMAL(15, 2),
  "deviation_percent" DECIMAL(5, 2),
  "currency" TEXT DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "assigned_to" TEXT,
  "resolved_by" TEXT,
  "resolved_at" TIMESTAMP(3),
  "resolution_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "se_tenant_idx" ON "spend_exceptions"("tenant_id");
CREATE INDEX IF NOT EXISTS "se_status_idx" ON "spend_exceptions"("tenant_id", "status");
-- ============================================================================
-- H) ENTERPRISE IDENTITY & SECURITY
-- ============================================================================
-- API Keys (public API key management)
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "key_prefix" TEXT NOT NULL,
  "scopes" JSONB DEFAULT '["read"]',
  "rate_limit" INTEGER DEFAULT 1000,
  "is_active" BOOLEAN DEFAULT true,
  "last_used_at" TIMESTAMP(3),
  "usage_count" INTEGER DEFAULT 0,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "api_keys_tenant_idx" ON "api_keys"("tenant_id");
CREATE INDEX IF NOT EXISTS "api_keys_hash_idx" ON "api_keys"("key_hash");
CREATE INDEX IF NOT EXISTS "api_keys_prefix_idx" ON "api_keys"("key_prefix");
-- SCIM Sync Records
CREATE TABLE IF NOT EXISTS "scim_sync_records" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "scim_id" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL DEFAULT 'User',
  "internal_id" TEXT NOT NULL,
  "display_name" TEXT,
  "email" TEXT,
  "active" BOOLEAN DEFAULT true,
  "last_synced_at" TIMESTAMP(3),
  "sync_source" TEXT DEFAULT 'ENTRA_ID',
  "raw_attributes" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "scim_unique" ON "scim_sync_records"("tenant_id", "scim_id");
CREATE INDEX IF NOT EXISTS "scim_tenant_idx" ON "scim_sync_records"("tenant_id");
-- Tenant AI Policies
CREATE TABLE IF NOT EXISTS "tenant_ai_policies" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL UNIQUE,
  "allowed_models" JSONB DEFAULT '["gpt-4o","gpt-4o-mini"]',
  "max_tokens_per_request" INTEGER DEFAULT 4096,
  "enable_extraction" BOOLEAN DEFAULT true,
  "enable_generation" BOOLEAN DEFAULT true,
  "enable_chat" BOOLEAN DEFAULT true,
  "confidence_threshold" DECIMAL(3, 2) DEFAULT 0.7,
  "require_human_review" BOOLEAN DEFAULT false,
  "review_threshold" DECIMAL(3, 2) DEFAULT 0.5,
  "data_retention_days" INTEGER DEFAULT 90,
  "pii_masking" BOOLEAN DEFAULT false,
  "audit_all_requests" BOOLEAN DEFAULT true,
  "custom_rules" JSONB DEFAULT '{}',
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- DLP Policies
CREATE TABLE IF NOT EXISTS "dlp_policies" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN DEFAULT true,
  "policy_type" TEXT NOT NULL DEFAULT 'DOWNLOAD_RESTRICTION',
  "rules" JSONB NOT NULL DEFAULT '[]',
  "actions" JSONB NOT NULL DEFAULT '{"block": false, "alert": true, "log": true}',
  "applies_to_roles" JSONB DEFAULT '[]',
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "dlp_tenant_idx" ON "dlp_policies"("tenant_id");
-- ============================================================================
-- I) RECORDS MANAGEMENT
-- ============================================================================
-- Legal Holds
CREATE TABLE IF NOT EXISTS "legal_holds" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "matter_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "hold_type" TEXT DEFAULT 'LITIGATION',
  "contract_ids" JSONB DEFAULT '[]',
  "obligation_ids" JSONB DEFAULT '[]',
  "custodians" JSONB DEFAULT '[]',
  "issued_by" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "released_by" TEXT,
  "released_at" TIMESTAMP(3),
  "release_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "lh_tenant_idx" ON "legal_holds"("tenant_id");
CREATE INDEX IF NOT EXISTS "lh_status_idx" ON "legal_holds"("tenant_id", "status");
-- Archived Contracts
CREATE TABLE IF NOT EXISTS "archived_contracts" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "original_contract_id" TEXT NOT NULL,
  "archive_reason" TEXT NOT NULL,
  "archived_data" JSONB NOT NULL,
  "retention_until" TIMESTAMP(3),
  "storage_tier" TEXT DEFAULT 'COOL',
  "storage_url" TEXT,
  "archived_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ac_tenant_idx" ON "archived_contracts"("tenant_id");
CREATE INDEX IF NOT EXISTS "ac_retention_idx" ON "archived_contracts"("retention_until");
-- Deletion Certificates
CREATE TABLE IF NOT EXISTS "deletion_certificates" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "entity_title" TEXT,
  "deletion_reason" TEXT NOT NULL,
  "approved_by" TEXT NOT NULL,
  "approved_at" TIMESTAMP(3) NOT NULL,
  "executed_by" TEXT NOT NULL,
  "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "certificate_hash" TEXT NOT NULL,
  "metadata" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "dc_tenant_idx" ON "deletion_certificates"("tenant_id");
-- ============================================================================
-- K) AI GOVERNANCE
-- ============================================================================
-- Evaluation Datasets
CREATE TABLE IF NOT EXISTS "evaluation_datasets" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "dataset_type" TEXT NOT NULL DEFAULT 'EXTRACTION',
  "items" JSONB NOT NULL DEFAULT '[]',
  "total_items" INTEGER DEFAULT 0,
  "last_run_at" TIMESTAMP(3),
  "last_run_results" JSONB DEFAULT '{}',
  "precision_score" DECIMAL(5, 4),
  "recall_score" DECIMAL(5, 4),
  "f1_score" DECIMAL(5, 4),
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ed_tenant_idx" ON "evaluation_datasets"("tenant_id");
-- Drift Metrics
CREATE TABLE IF NOT EXISTS "drift_metrics" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "metric_type" TEXT NOT NULL DEFAULT 'ACCURACY',
  "model_name" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "score" DECIMAL(5, 4) NOT NULL,
  "baseline_score" DECIMAL(5, 4),
  "sample_size" INTEGER DEFAULT 0,
  "drift_detected" BOOLEAN DEFAULT false,
  "drift_severity" TEXT,
  "details" JSONB DEFAULT '{}',
  "measured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "dm_tenant_idx" ON "drift_metrics"("tenant_id");
CREATE INDEX IF NOT EXISTS "dm_measured_idx" ON "drift_metrics"("tenant_id", "measured_at");
-- Training Data Exports
CREATE TABLE IF NOT EXISTS "training_exports" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "export_type" TEXT NOT NULL DEFAULT 'CORRECTIONS',
  "model_target" TEXT,
  "total_records" INTEGER DEFAULT 0,
  "file_url" TEXT,
  "file_format" TEXT DEFAULT 'JSONL',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "te_tenant_idx" ON "training_exports"("tenant_id");
-- ============================================================================
-- L) PLATFORM SCALE
-- ============================================================================
-- Event Store (for event sourcing)
CREATE TABLE IF NOT EXISTS "event_store" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "aggregate_type" TEXT NOT NULL,
  "aggregate_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "event_version" INTEGER DEFAULT 1,
  "payload" JSONB NOT NULL,
  "metadata" JSONB DEFAULT '{}',
  "sequence_number" BIGSERIAL,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "es_aggregate_idx" ON "event_store"("aggregate_type", "aggregate_id");
CREATE INDEX IF NOT EXISTS "es_tenant_idx" ON "event_store"("tenant_id");
CREATE INDEX IF NOT EXISTS "es_type_idx" ON "event_store"("event_type");
CREATE INDEX IF NOT EXISTS "es_created_idx" ON "event_store"("created_at");