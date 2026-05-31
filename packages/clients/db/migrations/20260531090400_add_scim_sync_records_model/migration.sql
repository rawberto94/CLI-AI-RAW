-- Create scim_sync_records table if it doesn't already exist.
-- This is idempotent: safe for environments where the previous raw-SQL migration
-- already created the table, as well as fresh databases.
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
