-- PostgreSQL Row-Level Security (RLS) Policies
-- 
-- This migration enables RLS for defense-in-depth tenant isolation.
-- Even if application code misses a tenant filter, RLS prevents data leakage.
--
-- IMPORTANT: Run this after the Prisma schema migration
-- Usage: psql $DATABASE_URL -f enable_rls.sql

-- ============================================================================
-- Enable RLS on Tenant-Scoped Tables
-- ============================================================================

-- Core tables
ALTER TABLE "Contract" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContractVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContractClause" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Obligation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoleRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContractTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Workflow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApprovalRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContractDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ObligationNotification" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Create Application Role for RLS
-- ============================================================================

-- Create a role that the application uses
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'contigo_app') THEN
    CREATE ROLE contigo_app NOLOGIN;
  END IF;
END
$$;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO contigo_app;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO contigo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO contigo_app;

-- ============================================================================
-- Create Session Variables Function
-- ============================================================================

-- Function to set the current tenant ID for RLS
CREATE OR REPLACE FUNCTION set_current_tenant(tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get the current tenant ID
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', true);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to set the current user ID for RLS
CREATE OR REPLACE FUNCTION set_current_user_id(user_id TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get the current user ID
CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- RLS Policies for Core Tables
-- ============================================================================

-- Contract: Users can only see contracts in their tenant
CREATE POLICY tenant_isolation_contract ON "Contract"
  FOR ALL
  TO contigo_app
  USING ("tenantId" = current_tenant_id());

-- User: Users can only see users in their tenant
CREATE POLICY tenant_isolation_user ON "User"
  FOR ALL
  TO contigo_app
  USING ("tenantId" = current_tenant_id());

-- ContractVersion: Inherit from Contract's tenant
CREATE POLICY tenant_isolation_contract_version ON "ContractVersion"
  FOR ALL
  TO contigo_app
  USING (
    EXISTS (
      SELECT 1 FROM "Contract" c 
      WHERE c.id = "contractId" 
      AND c."tenantId" = current_tenant_id()
    )
  );

-- ContractClause: Inherit from Contract's tenant
CREATE POLICY tenant_isolation_contract_clause ON "ContractClause"
  FOR ALL
  TO contigo_app
  USING (
    EXISTS (
      SELECT 1 FROM "Contract" c 
      WHERE c.id = "contractId" 
      AND c."tenantId" = current_tenant_id()
    )
  );

-- Obligation: Direct tenant ID check
CREATE POLICY tenant_isolation_obligation ON "Obligation"
  FOR ALL
  TO contigo_app
  USING ("tenantId" = current_tenant_id());

-- RateCard: Direct tenant ID check
CREATE POLICY tenant_isolation_rate_card ON "RateCard"
  FOR ALL
  TO contigo_app
  USING ("tenantId" = current_tenant_id());

-- RoleRate: Inherit from RateCard's tenant
CREATE POLICY tenant_isolation_role_rate ON "RoleRate"
  FOR ALL
  TO contigo_app
  USING (
    EXISTS (
      SELECT 1 FROM "RateCard" rc 
      WHERE rc.id = "rateCardId" 
      AND rc."tenantId" = current_tenant_id()
    )
  );

-- Tag: Direct tenant ID check
CREATE POLICY tenant_isolation_tag ON "Tag"
  FOR ALL
  TO contigo_app
  USING ("tenantId" = current_tenant_id());

-- ContractTag: Inherit from Contract's tenant
CREATE POLICY tenant_isolation_contract_tag ON "ContractTag"
  FOR ALL
  TO contigo_app
  USING (
    EXISTS (
      SELECT 1 FROM "Contract" c 
      WHERE c.id = "contractId" 
      AND c."tenantId" = current_tenant_id()
    )
  );

-- Comment: Direct tenant ID check
CREATE POLICY tenant_isolation_comment ON "Comment"
  FOR ALL
  TO contigo_app
  USING ("tenantId" = current_tenant_id());

-- AuditLog: Direct tenant ID check
CREATE POLICY tenant_isolation_audit_log ON "AuditLog"
  FOR ALL
  TO contigo_app
  USING ("tenantId" = current_tenant_id());

-- Notification: Direct tenant ID check
CREATE POLICY tenant_isolation_notification ON "Notification"
  FOR ALL
  TO contigo_app
  USING ("tenantId" = current_tenant_id());

-- Workflow: Direct tenant ID check
CREATE POLICY tenant_isolation_workflow ON "Workflow"
  FOR ALL
  TO contigo_app
  USING ("tenantId" = current_tenant_id());

-- WorkflowStep: Inherit from Workflow's tenant
CREATE POLICY tenant_isolation_workflow_step ON "WorkflowStep"
  FOR ALL
  TO contigo_app
  USING (
    EXISTS (
      SELECT 1 FROM "Workflow" w 
      WHERE w.id = "workflowId" 
      AND w."tenantId" = current_tenant_id()
    )
  );

-- ApprovalRequest: Inherit from Contract's tenant
CREATE POLICY tenant_isolation_approval_request ON "ApprovalRequest"
  FOR ALL
  TO contigo_app
  USING (
    EXISTS (
      SELECT 1 FROM "Contract" c 
      WHERE c.id = "contractId" 
      AND c."tenantId" = current_tenant_id()
    )
  );

-- ContractDraft: Direct tenant ID check
CREATE POLICY tenant_isolation_contract_draft ON "ContractDraft"
  FOR ALL
  TO contigo_app
  USING ("tenantId" = current_tenant_id());

-- ChatConversation: Direct tenant ID check
CREATE POLICY tenant_isolation_chat_conversation ON "ChatConversation"
  FOR ALL
  TO contigo_app
  USING ("tenantId" = current_tenant_id());

-- ChatMessage: Inherit from ChatConversation's tenant
CREATE POLICY tenant_isolation_chat_message ON "ChatMessage"
  FOR ALL
  TO contigo_app
  USING (
    EXISTS (
      SELECT 1 FROM "ChatConversation" cc 
      WHERE cc.id = "conversationId" 
      AND cc."tenantId" = current_tenant_id()
    )
  );

-- ObligationNotification: Inherit from Obligation's tenant
CREATE POLICY tenant_isolation_obligation_notification ON "ObligationNotification"
  FOR ALL
  TO contigo_app
  USING (
    EXISTS (
      SELECT 1 FROM "Obligation" o 
      WHERE o.id = "obligationId" 
      AND o."tenantId" = current_tenant_id()
    )
  );

-- ============================================================================
-- Bypass Policy for Admin Operations
-- ============================================================================

-- Super admin bypass (for migrations, admin tasks)
CREATE POLICY admin_bypass_contract ON "Contract"
  FOR ALL
  TO postgres
  USING (true)
  WITH CHECK (true);

-- Repeat for other tables...
-- (In production, create a separate admin role with bypass policies)

-- ============================================================================
-- Index for RLS Performance
-- ============================================================================

-- Ensure tenantId indexes exist for fast RLS filtering
-- These should already exist from Prisma, but verify:
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contract_tenantId_rls_idx" ON "Contract" ("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_tenantId_rls_idx" ON "User" ("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Obligation_tenantId_rls_idx" ON "Obligation" ("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "RateCard_tenantId_rls_idx" ON "RateCard" ("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Tag_tenantId_rls_idx" ON "Tag" ("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Comment_tenantId_rls_idx" ON "Comment" ("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_tenantId_rls_idx" ON "AuditLog" ("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Notification_tenantId_rls_idx" ON "Notification" ("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Workflow_tenantId_rls_idx" ON "Workflow" ("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ContractDraft_tenantId_rls_idx" ON "ContractDraft" ("tenantId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatConversation_tenantId_rls_idx" ON "ChatConversation" ("tenantId");

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;

-- Check policies exist
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
