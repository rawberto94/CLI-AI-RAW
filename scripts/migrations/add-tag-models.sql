-- Migration: Add first-class tagging/grouping models
-- Date: 2026-06-22
-- Purpose: Introduce tenant_tags, contract_groups, and tag_rules tables
--          while preserving backward compatibility with tenant_settings.customFields.

CREATE TABLE IF NOT EXISTS "tenant_tags" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#8B5CF6',
  "description" TEXT,
  "category" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "parentTagId" TEXT,
  "relatedTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_tags_tenant_slug_uq" ON "tenant_tags"("tenantId", "slug");
CREATE INDEX IF NOT EXISTS "tenant_tags_tenant_idx" ON "tenant_tags"("tenantId");
CREATE INDEX IF NOT EXISTS "tenant_tags_tenant_category_idx" ON "tenant_tags"("tenantId", "category");
CREATE INDEX IF NOT EXISTS "tenant_tags_tenant_usage_idx" ON "tenant_tags"("tenantId", "usageCount" DESC);
CREATE INDEX IF NOT EXISTS "tenant_tags_tenant_parent_idx" ON "tenant_tags"("tenantId", "parentTagId");

CREATE TABLE IF NOT EXISTS "contract_groups" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "groupType" TEXT NOT NULL DEFAULT 'static',
  "contractIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "query" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "requireAllTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requireAnyTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "contractCount" INTEGER NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "contract_groups_tenant_slug_uq" ON "contract_groups"("tenantId", "slug");
CREATE INDEX IF NOT EXISTS "contract_groups_tenant_idx" ON "contract_groups"("tenantId");
CREATE INDEX IF NOT EXISTS "contract_groups_tenant_type_idx" ON "contract_groups"("tenantId", "groupType");
CREATE INDEX IF NOT EXISTS "contract_groups_tenant_updated_idx" ON "contract_groups"("tenantId", "updatedAt");

CREATE TABLE IF NOT EXISTS "tag_rules" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "trigger" TEXT NOT NULL DEFAULT 'contract_updated',
  "condition" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "action" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "tag_rules_tenant_name_uq" ON "tag_rules"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "tag_rules_tenant_idx" ON "tag_rules"("tenantId");
CREATE INDEX IF NOT EXISTS "tag_rules_tenant_enabled_idx" ON "tag_rules"("tenantId", "enabled");
CREATE INDEX IF NOT EXISTS "tag_rules_tenant_trigger_idx" ON "tag_rules"("tenantId", "trigger");

-- Seed tenant_tags from legacy tenant_settings.customFields.predefinedTags.
INSERT INTO "tenant_tags" (
  "id", "tenantId", "name", "slug", "color", "description", "isSystem", "createdAt", "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text),
  ts."tenantId",
  lower(trim(COALESCE(tag_value->>'name', tag_text))),
  regexp_replace(lower(trim(COALESCE(tag_value->>'name', tag_text))), '[^a-z0-9]+', '-', 'g'),
  COALESCE(NULLIF(tag_value->>'color', ''), '#8B5CF6'),
  COALESCE(tag_value->>'description', ''),
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "TenantSettings" ts
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ts."customFields"->'predefinedTags', '[]'::jsonb)) AS tag_element(raw)
CROSS JOIN LATERAL (
  SELECT
    CASE WHEN jsonb_typeof(tag_element.raw) = 'object' THEN tag_element.raw ELSE '{}'::jsonb END AS tag_value,
    CASE WHEN jsonb_typeof(tag_element.raw) = 'string' THEN trim(BOTH '"' FROM tag_element.raw::text) ELSE '' END AS tag_text
) normalized
WHERE trim(COALESCE(tag_value->>'name', tag_text)) <> ''
ON CONFLICT ("tenantId", "slug") DO NOTHING;
