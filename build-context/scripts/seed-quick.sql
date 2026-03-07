-- Quick mock data seed - FINAL VERSION matching actual schema

-- 1. Ensure tenant exists (tenant already exists from earlier, just verify)
INSERT INTO "Tenant" (id, name, slug, "createdAt", "updatedAt")
VALUES ('demo-tenant', 'Demo Tenant', 'demo', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Create sample contracts (using correct status enum)
INSERT INTO "Contract" (
    id, "tenantId", "contractTitle", status, "effectiveDate", "expirationDate",
    "supplierName", category, "rawText", filename, "contentType", size, "createdAt", "updatedAt"
)
VALUES
    ('c1', 'demo-tenant', 'IT Services - Accenture', 'COMPLETED', 
     '2024-01-15', '2025-12-31', 'Accenture', 'IT Services',
     'IT consulting services including software development, cloud infrastructure, and technical consulting for 24 months.',
     'accenture-2024.pdf', 'application/pdf', 125000, NOW(), NOW()),
    
    ('c2', 'demo-tenant', 'Software Development - Thoughtworks', 'COMPLETED',
     '2024-03-01', '2026-02-28', 'Thoughtworks', 'Software Development',
     'Master Services Agreement for agile software development and DevOps.',
     'thoughtworks-msa.pdf', 'application/pdf', 98000, NOW(), NOW()),
    
    ('c3', 'demo-tenant', 'Cloud Services - AWS', 'COMPLETED',
     '2023-06-01', '2025-05-31', 'Amazon Web Services', 'Cloud Services',
     'Enterprise agreement for AWS cloud infrastructure including EC2, S3, RDS.',
     'aws-agreement.pdf', 'application/pdf', 215000, NOW(), NOW()),
    
    ('c4', 'demo-tenant', 'Data Analytics - Infosys', 'PROCESSING',
     '2023-09-15', '2025-03-15', 'Infosys', 'Data & Analytics',
     'Data analytics platform development using modern data engineering and ML.',
     'infosys-analytics.pdf', 'application/pdf', 87000, NOW(), NOW()),
    
    ('c5', 'demo-tenant', 'Cybersecurity - Deloitte', 'UPLOADED',
     '2024-10-01', '2025-09-30', 'Deloitte', 'Security',
     'Cybersecurity assessment and remediation including pen testing.',
     'deloitte-security.pdf', 'application/pdf', 76000, NOW(), NOW()),
    
    ('c6', 'demo-tenant', 'ERP Implementation - SAP', 'COMPLETED',
     '2024-02-01', '2026-01-31', 'SAP Consulting', 'Enterprise Software',
     'SAP S/4HANA implementation and integration services.',
     'sap-erp.pdf', 'application/pdf', 342000, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Create Import Jobs
INSERT INTO "ImportJob" (
    id, "tenantId", source, status, "fileType", "fileName", "fileSize",
    "rowsProcessed", "rowsSucceeded", "rowsFailed", "extractedData", "createdAt"
)
VALUES
    ('j1', 'demo-tenant', 'UPLOAD', 'COMPLETED', 'CSV',
     'accenture-rates.csv', 25600, 5, 5, 0, '[]'::jsonb, NOW() - INTERVAL '7 days'),
    
    ('j2', 'demo-tenant', 'UPLOAD', 'COMPLETED', 'CSV',
     'thoughtworks-rates.csv', 18400, 3, 3, 0, '[]'::jsonb, NOW() - INTERVAL '6 days'),
    
    ('j3', 'demo-tenant', 'UPLOAD', 'COMPLETED', 'CSV',
     'infosys-rates.csv', 22100, 4, 4, 0, '[]'::jsonb, NOW() - INTERVAL '5 days'),
    
    ('j4', 'demo-tenant', 'UPLOAD', 'COMPLETED', 'CSV',
     'deloitte-rates.csv', 19800, 3, 3, 0, '[]'::jsonb, NOW() - INTERVAL '4 days')
ON CONFLICT (id) DO NOTHING;

-- 4. Create Rate Cards
INSERT INTO "RateCard" (
    id, "tenantId", "importJobId", "supplierId", "supplierName", "supplierTier",
    "effectiveDate", "expiryDate", "originalCurrency", "baseCurrency", 
    source, "importedBy", status, "dataQuality"
)
VALUES
    ('rc1', 'demo-tenant', 'j1', 's1', 'Accenture', 'BIG_4', 
     '2024-01-01', '2025-12-31', 'USD', 'USD',
     'CSV Import', 'admin', 'APPROVED', 
     '{"completeness": 100, "consistency": 95}'::jsonb),
    
    ('rc2', 'demo-tenant', 'j2', 's2', 'Thoughtworks', 'BOUTIQUE',
     '2024-01-01', '2025-12-31', 'USD', 'USD',
     'CSV Import', 'admin', 'APPROVED',
     '{"completeness": 100, "consistency": 97}'::jsonb),
    
    ('rc3', 'demo-tenant', 'j3', 's3', 'Infosys', 'OFFSHORE',
     '2024-01-01', '2025-12-31', 'INR', 'USD',
     'CSV Import', 'admin', 'APPROVED',
     '{"completeness": 100, "consistency": 96}'::jsonb),
    
    ('rc4', 'demo-tenant', 'j4', 's4', 'Deloitte', 'BIG_4',
     '2024-01-01', '2025-12-31', 'USD', 'USD',
     'CSV Import', 'admin', 'APPROVED',
     '{"completeness": 100, "consistency": 98}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 5. Create Role Rates (using correct schema with all required fields)
INSERT INTO "RoleRate" (
    id, "rateCardId", "originalRoleName", "standardizedRole", "roleCategory", "seniorityLevel",
    "serviceLine", "originalLocation", geography, region, country,
    "originalRate", "originalPeriod", "originalCurrency",
    "hourlyRate", "dailyRate", "monthlyRate", "annualRate", "baseCurrency",
    confidence, "dataQuality", "createdAt", "updatedAt"
)
VALUES
    -- Accenture rates
    ('r1', 'rc1', 'Senior Software Engineer', 'Software Engineer', 'Technology', 'SENIOR',
     'Technology', 'United States', 'Americas', 'North America', 'United States',
     1200, 'DAILY', 'USD', 150, 1200, 24000, 288000, 'USD', 0.95, 'HIGH', NOW(), NOW()),
    
    ('r2', 'rc1', 'Principal Architect', 'Solution Architect', 'Technology', 'PRINCIPAL',
     'Technology', 'United States', 'Americas', 'North America', 'United States',
     1800, 'DAILY', 'USD', 225, 1800, 36000, 432000, 'USD', 0.95, 'HIGH', NOW(), NOW()),
    
    ('r3', 'rc1', 'Data Scientist', 'Data Scientist', 'Data & Analytics', 'SENIOR',
     'Data & Analytics', 'United States', 'Americas', 'North America', 'United States',
     1400, 'DAILY', 'USD', 175, 1400, 28000, 336000, 'USD', 0.95, 'HIGH', NOW(), NOW()),
    
    ('r4', 'rc1', 'DevOps Engineer', 'DevOps Engineer', 'Technology', 'MID',
     'Technology', 'United States', 'Americas', 'North America', 'United States',
     1000, 'DAILY', 'USD', 125, 1000, 20000, 240000, 'USD', 0.95, 'HIGH', NOW(), NOW()),
    
    -- Thoughtworks rates
    ('r5', 'rc2', 'Full Stack Developer', 'Software Engineer', 'Technology', 'SENIOR',
     'Technology', 'United States', 'Americas', 'North America', 'United States',
     950, 'DAILY', 'USD', 119, 950, 19000, 228000, 'USD', 0.95, 'HIGH', NOW(), NOW()),
    
    ('r6', 'rc2', 'Tech Lead', 'Technical Lead', 'Technology', 'LEAD',
     'Technology', 'United States', 'Americas', 'North America', 'United States',
     1300, 'DAILY', 'USD', 163, 1300, 26000, 312000, 'USD', 0.95, 'HIGH', NOW(), NOW()),
    
    ('r7', 'rc2', 'UX Designer', 'UX Designer', 'Design', 'MID',
     'Design', 'United States', 'Americas', 'North America', 'United States',
     850, 'DAILY', 'USD', 106, 850, 17000, 204000, 'USD', 0.95, 'HIGH', NOW(), NOW()),
    
    -- Infosys rates
    ('r8', 'rc3', 'Senior Developer', 'Software Engineer', 'Technology', 'SENIOR',
     'Technology', 'India', 'APAC', 'South Asia', 'India',
     650, 'DAILY', 'USD', 81, 650, 13000, 156000, 'USD', 0.95, 'HIGH', NOW(), NOW()),
    
    ('r9', 'rc3', 'Solution Architect', 'Solution Architect', 'Technology', 'LEAD',
     'Technology', 'India', 'APAC', 'South Asia', 'India',
     850, 'DAILY', 'USD', 106, 850, 17000, 204000, 'USD', 0.95, 'HIGH', NOW(), NOW()),
    
    ('r10', 'rc3', 'QA Engineer', 'QA Engineer', 'Quality Assurance', 'MID',
     'Quality Assurance', 'India', 'APAC', 'South Asia', 'India',
     500, 'DAILY', 'USD', 63, 500, 10000, 120000, 'USD', 0.95, 'HIGH', NOW(), NOW()),
    
    ('r11', 'rc3', 'Data Engineer', 'Data Engineer', 'Data & Analytics', 'SENIOR',
     'Data & Analytics', 'India', 'APAC', 'South Asia', 'India',
     700, 'DAILY', 'USD', 88, 700, 14000, 168000, 'USD', 0.95, 'HIGH', NOW(), NOW()),
    
    -- Deloitte rates
    ('r12', 'rc4', 'Senior Developer', 'Software Engineer', 'Technology', 'SENIOR',
     'Technology', 'United States', 'Americas', 'North America', 'United States',
     1150, 'DAILY', 'USD', 144, 1150, 23000, 276000, 'USD', 0.95, 'HIGH', NOW(), NOW()),
    
    ('r13', 'rc4', 'Lead Architect', 'Solution Architect', 'Technology', 'LEAD',
     'Technology', 'United States', 'Americas', 'North America', 'United States',
     1650, 'DAILY', 'USD', 206, 1650, 33000, 396000, 'USD', 0.95, 'HIGH', NOW(), NOW()),
    
    ('r14', 'rc4', 'Security Analyst', 'Security Engineer', 'Security', 'MID',
     'Security', 'United States', 'Americas', 'North America', 'United States',
     1100, 'DAILY', 'USD', 138, 1100, 22000, 264000, 'USD', 0.95, 'HIGH', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Summary
SELECT '✅ Demo data loaded successfully!' as status;
SELECT 
    'Contracts' as entity, COUNT(*) as count 
FROM "Contract" WHERE "tenantId" = 'demo-tenant'
UNION ALL
SELECT 'Rate Cards', COUNT(*) FROM "RateCard" WHERE "tenantId" = 'demo-tenant'
UNION ALL
SELECT 'Role Rates', COUNT(*) FROM "RoleRate" 
WHERE "rateCardId" IN (SELECT id FROM "RateCard" WHERE "tenantId" = 'demo-tenant');
