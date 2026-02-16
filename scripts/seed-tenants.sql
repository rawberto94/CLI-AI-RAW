-- Create test tenants for multi-tenant testing
-- Tenant Roberto and Tenant Florian

-- Insert Tenant Roberto (or update if exists)
INSERT INTO "Tenant" ("id", "name", "slug", "status", "createdAt", "updatedAt")
VALUES (
  'tenant-roberto',
  'Roberto Corporation',
  'roberto',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug",
  "updatedAt" = NOW();

-- Insert Tenant Florian (or update if exists)
INSERT INTO "Tenant" ("id", "name", "slug", "status", "createdAt", "updatedAt")
VALUES (
  'tenant-florian',
  'Florian Enterprises',
  'florian',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug",
  "updatedAt" = NOW();

-- Create admin user for Roberto
INSERT INTO "User" ("id", "tenantId", "email", "firstName", "lastName", "passwordHash", "role", "createdAt", "updatedAt")
VALUES (
  'user-roberto-admin',
  'tenant-roberto',
  'roberto@roberto.com',
  'Roberto',
  'Admin',
  '$2b$10$dummyhashdummyhashdummyhashdummyhashdummy00',
  'admin',
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  "tenantId" = EXCLUDED."tenantId",
  "updatedAt" = NOW();

-- Create admin user for Florian
INSERT INTO "User" ("id", "tenantId", "email", "firstName", "lastName", "passwordHash", "role", "createdAt", "updatedAt")
VALUES (
  'user-florian-admin',
  'tenant-florian',
  'florian@florian.com',
  'Florian',
  'Admin',
  '$2b$10$dummyhashdummyhashdummyhashdummyhashdummy00',
  'admin',
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  "tenantId" = EXCLUDED."tenantId",
  "updatedAt" = NOW();

-- Show created tenants
SELECT id, name, slug, status FROM "Tenant" WHERE id IN ('tenant-roberto', 'tenant-florian', 'demo');
