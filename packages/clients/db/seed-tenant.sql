-- Insert default tenant
INSERT INTO "Tenant" (id, name, slug, "createdAt", "updatedAt")
VALUES ('demo', 'Demo Tenant', 'demo', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert tenant config
INSERT INTO "TenantConfig" (id, "tenantId", settings, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'demo', '{}', NOW(), NOW())
ON CONFLICT ("tenantId") DO NOTHING;

-- Show result
SELECT id, name, slug FROM "Tenant";
