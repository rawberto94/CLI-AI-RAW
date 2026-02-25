-- ============================================================================
-- Seed Renewals Demo Data
-- Updates existing contracts with future expiration dates and renewal metadata
-- so the Renewals Manager has real data to display.
-- Run: psql "$DATABASE_URL" -f scripts/seed-renewals-demo.sql
-- ============================================================================
-- Get the tenant id (assume first tenant)
-- Update contract dates to be in the future relative to current date
-- Contract 1: IT Services Agreement - Accenture → expires in 45 days (urgent)
UPDATE "Contract"
SET "endDate" = NOW() + INTERVAL '45 days',
  "expirationDate" = NOW() + INTERVAL '45 days',
  "effectiveDate" = NOW() - INTERVAL '1 year',
  "startDate" = NOW() - INTERVAL '1 year',
  status = 'ACTIVE',
  "totalValue" = 2500000,
  "autoRenewalEnabled" = false,
  "renewalStatus" = 'PENDING',
  "noticePeriodDays" = 60,
  "daysUntilExpiry" = 45,
  "expirationRisk" = 'HIGH',
  "updatedAt" = NOW()
WHERE id = 'contract-1';
-- Contract 2: Software Development MSA - Thoughtworks → expires in 15 days (critical)
UPDATE "Contract"
SET "endDate" = NOW() + INTERVAL '15 days',
  "expirationDate" = NOW() + INTERVAL '15 days',
  "effectiveDate" = NOW() - INTERVAL '2 years',
  "startDate" = NOW() - INTERVAL '2 years',
  status = 'ACTIVE',
  "totalValue" = 4200000,
  "autoRenewalEnabled" = false,
  "renewalStatus" = 'PENDING',
  "noticePeriodDays" = 30,
  "daysUntilExpiry" = 15,
  "expirationRisk" = 'CRITICAL',
  "updatedAt" = NOW()
WHERE id = 'contract-2';
-- Contract 3: Cloud Infrastructure - AWS → expires in 90 days, auto-renewal
UPDATE "Contract"
SET "endDate" = NOW() + INTERVAL '90 days',
  "expirationDate" = NOW() + INTERVAL '90 days',
  "effectiveDate" = NOW() - INTERVAL '2 years',
  "startDate" = NOW() - INTERVAL '2 years',
  status = 'ACTIVE',
  "totalValue" = 8500000,
  "autoRenewalEnabled" = true,
  "renewalStatus" = 'PENDING',
  "noticePeriodDays" = 90,
  "daysUntilExpiry" = 90,
  "expirationRisk" = 'LOW',
  "updatedAt" = NOW()
WHERE id = 'contract-3';
-- Contract 4: Data Analytics Platform - Infosys → expires in 7 days! (critical, in-negotiation)
UPDATE "Contract"
SET "endDate" = NOW() + INTERVAL '7 days',
  "expirationDate" = NOW() + INTERVAL '7 days',
  "effectiveDate" = NOW() - INTERVAL '18 months',
  "startDate" = NOW() - INTERVAL '18 months',
  status = 'ACTIVE',
  "totalValue" = 1800000,
  "autoRenewalEnabled" = false,
  "renewalStatus" = 'INITIATED',
  "renewalInitiatedAt" = NOW() - INTERVAL '14 days',
  "noticePeriodDays" = 30,
  "daysUntilExpiry" = 7,
  "expirationRisk" = 'CRITICAL',
  "updatedAt" = NOW()
WHERE id = 'contract-4';
-- Contract 5: Cybersecurity Assessment - Deloitte → expires in 120 days
UPDATE "Contract"
SET "endDate" = NOW() + INTERVAL '120 days',
  "expirationDate" = NOW() + INTERVAL '120 days',
  "effectiveDate" = NOW() - INTERVAL '10 months',
  "startDate" = NOW() - INTERVAL '10 months',
  status = 'ACTIVE',
  "totalValue" = 950000,
  "autoRenewalEnabled" = false,
  "renewalStatus" = 'PENDING',
  "noticePeriodDays" = 60,
  "daysUntilExpiry" = 120,
  "expirationRisk" = 'LOW',
  "updatedAt" = NOW()
WHERE id = 'contract-5';
-- Contract 6: ERP Implementation - SAP Consulting → expires in 30 days (high priority)
UPDATE "Contract"
SET "endDate" = NOW() + INTERVAL '30 days',
  "expirationDate" = NOW() + INTERVAL '30 days',
  "effectiveDate" = NOW() - INTERVAL '2 years',
  "startDate" = NOW() - INTERVAL '2 years',
  status = 'ACTIVE',
  "totalValue" = 12000000,
  "autoRenewalEnabled" = true,
  "renewalStatus" = 'PENDING',
  "noticePeriodDays" = 60,
  "daysUntilExpiry" = 30,
  "expirationRisk" = 'HIGH',
  "updatedAt" = NOW()
WHERE id = 'contract-6';
-- Contract 7: Mobile App Development - Capgemini → expires in 60 days
UPDATE "Contract"
SET "endDate" = NOW() + INTERVAL '60 days',
  "expirationDate" = NOW() + INTERVAL '60 days',
  "effectiveDate" = NOW() - INTERVAL '1 year',
  "startDate" = NOW() - INTERVAL '1 year',
  status = 'ACTIVE',
  "totalValue" = 3200000,
  "autoRenewalEnabled" = false,
  "renewalStatus" = 'PENDING',
  "noticePeriodDays" = 45,
  "daysUntilExpiry" = 60,
  "expirationRisk" = 'MEDIUM',
  "updatedAt" = NOW()
WHERE id = 'contract-7';
-- Contract 8: Network Infrastructure - Cisco Services → already expired (test expired state)
UPDATE "Contract"
SET "endDate" = NOW() - INTERVAL '5 days',
  "expirationDate" = NOW() - INTERVAL '5 days',
  "effectiveDate" = NOW() - INTERVAL '2 years',
  "startDate" = NOW() - INTERVAL '2 years',
  status = 'ACTIVE',
  "totalValue" = 5600000,
  "autoRenewalEnabled" = false,
  "renewalStatus" = 'PENDING',
  "noticePeriodDays" = 60,
  "daysUntilExpiry" = -5,
  "isExpired" = true,
  "expirationRisk" = 'CRITICAL',
  "updatedAt" = NOW()
WHERE id = 'contract-8';
-- Verify the updates
SELECT id,
  "contractTitle",
  status,
  "expirationDate",
  "totalValue",
  "autoRenewalEnabled",
  "renewalStatus",
  "noticePeriodDays",
  "expirationRisk"
FROM "Contract"
WHERE id LIKE 'contract-%'
ORDER BY "expirationDate" ASC NULLS LAST;