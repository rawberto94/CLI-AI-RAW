-- Standalone tenant-only indexes for queries that filter by tenant alone (previously only composite indexes existed)
CREATE INDEX IF NOT EXISTS "webhook_deliveries_tenantId_idx" ON "webhook_deliveries" ("tenantId");
CREATE INDEX IF NOT EXISTS "notifications_tenant_id_idx" ON "notifications" (tenant_id);
