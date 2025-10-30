-- Comprehensive mock data seed for Contract Intelligence system
-- Run this SQL script to populate demo data

-- 1. Create demo tenant
INSERT INTO "Tenant" (id, name, slug, "createdAt", "updatedAt")
VALUES ('demo-tenant', 'Demo Organization', 'demo-org', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = 'Demo Organization', slug = 'demo-org';

-- 2. Create sample contracts
INSERT INTO "Contract" (
    id, "tenantId", "contractTitle", status, "effectiveDate", "expirationDate",
    "supplierName", category, "rawText", filename, "contentType", size, "createdAt", "updatedAt"
)
VALUES
    ('contract-1', 'demo-tenant', 'IT Services Agreement - Accenture', 'ACTIVE', 
     '2024-01-15', '2025-12-31', 'Accenture', 'IT Services',
     'Sample contract for IT consulting services with Accenture. This agreement covers software development, cloud infrastructure, and technical consulting services for a period of 24 months.',
     'accenture-it-services-2024.pdf', 'application/pdf', 125000, NOW(), NOW()),
    
    ('contract-2', 'demo-tenant', 'Software Development MSA - Thoughtworks', 'ACTIVE',
     '2024-03-01', '2026-02-28', 'Thoughtworks', 'Software Development',
     'Master Services Agreement for software development including agile development, DevOps, and cloud-native application development.',
     'thoughtworks-msa-2024.pdf', 'application/pdf', 98000, NOW(), NOW()),
    
    ('contract-3', 'demo-tenant', 'Cloud Infrastructure - AWS', 'ACTIVE',
     '2023-06-01', '2025-05-31', 'Amazon Web Services', 'Cloud Services',
     'Enterprise agreement for AWS cloud infrastructure services including EC2, S3, RDS, and managed services.',
     'aws-enterprise-agreement.pdf', 'application/pdf', 215000, NOW(), NOW()),
    
    ('contract-4', 'demo-tenant', 'Data Analytics Platform - Infosys', 'PENDING_RENEWAL',
     '2023-09-15', '2025-03-15', 'Infosys', 'Data & Analytics',
     'Statement of Work for data analytics platform development using modern data engineering and ML capabilities.',
     'infosys-data-analytics-sow.pdf', 'application/pdf', 87000, NOW(), NOW()),
    
    ('contract-5', 'demo-tenant', 'Cybersecurity Assessment - Deloitte', 'DRAFT',
     '2024-10-01', '2025-09-30', 'Deloitte', 'Security',
     'Cybersecurity assessment and remediation services including penetration testing and security compliance audit.',
     'deloitte-security-assessment.pdf', 'application/pdf', 76000, NOW(), NOW()),
    
    ('contract-6', 'demo-tenant', 'ERP Implementation - SAP Consulting', 'ACTIVE',
     '2024-02-01', '2026-01-31', 'SAP Consulting', 'Enterprise Software',
     'SAP S/4HANA implementation and integration services for enterprise resource planning transformation.',
     'sap-erp-implementation.pdf', 'application/pdf', 342000, NOW(), NOW()),
    
    ('contract-7', 'demo-tenant', 'Mobile App Development - Capgemini', 'ACTIVE',
     '2024-04-15', '2025-04-14', 'Capgemini', 'Mobile Development',
     'Native mobile application development for iOS and Android platforms with continuous integration and deployment.',
     'capgemini-mobile-dev.pdf', 'application/pdf', 112000, NOW(), NOW()),
    
    ('contract-8', 'demo-tenant', 'Network Infrastructure - Cisco Services', 'ACTIVE',
     '2023-08-01', '2025-07-31', 'Cisco', 'Networking',
     'Enterprise network infrastructure upgrade and maintenance including SD-WAN and security appliances.',
     'cisco-network-services.pdf', 'application/pdf', 156000, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Create Import Jobs for rate cards
INSERT INTO "ImportJob" (
    id, "tenantId", source, status, "fileType", "fileName", "fileSize",
    "rowsProcessed", "rowsSucceeded", "rowsFailed", "extractedData",
    "startedAt", "completedAt", "processedBy", "createdAt"
)
VALUES
    ('import-acc', 'demo-tenant', 'UPLOAD', 'COMPLETED', 'CSV',
     'accenture-rates-2024.csv', 25600, 5, 5, 0, '[]'::jsonb,
     NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', 'admin@demo.com', NOW()),
    
    ('import-tw', 'demo-tenant', 'UPLOAD', 'COMPLETED', 'CSV',
     'thoughtworks-rates-2024.csv', 18400, 3, 3, 0, '[]'::jsonb,
     NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days', 'admin@demo.com', NOW()),
    
    ('import-inf', 'demo-tenant', 'UPLOAD', 'COMPLETED', 'CSV',
     'infosys-rates-2024.csv', 22100, 4, 4, 0, '[]'::jsonb,
     NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', 'admin@demo.com', NOW()),
    
    ('import-del', 'demo-tenant', 'UPLOAD', 'COMPLETED', 'CSV',
     'deloitte-rates-2024.csv', 19800, 3, 3, 0, '[]'::jsonb,
     NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', 'admin@demo.com', NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. Create Rate Cards
INSERT INTO "RateCard" (
    id, "tenantId", "importJobId", "supplierId", "supplierName", "supplierTier",
    "effectiveDate", "expiryDate", "originalCurrency", "baseCurrency", 
    source, "importedBy", status, "dataQuality"
)
VALUES
    ('ratecard-acc', 'demo-tenant', 'import-acc', 'supplier-accenture', 
     'Accenture', 'BIG_4', '2024-01-01', '2025-12-31', 'USD', 'USD',
     'CSV Import', 'admin@demo.com', 'APPROVED', 
     '{"completeness": 100, "consistency": 95, "accuracy": 98}'::jsonb),
    
    ('ratecard-tw', 'demo-tenant', 'import-tw', 'supplier-thoughtworks',
     'Thoughtworks', 'BOUTIQUE', '2024-01-01', '2025-12-31', 'USD', 'USD',
     'CSV Import', 'admin@demo.com', 'APPROVED',
     '{"completeness": 100, "consistency": 97, "accuracy": 99}'::jsonb),
    
    ('ratecard-inf', 'demo-tenant', 'import-inf', 'supplier-infosys',
     'Infosys', 'OFFSHORE', '2024-01-01', '2025-12-31', 'INR', 'USD',
     'CSV Import', 'admin@demo.com', 'APPROVED',
     '{"completeness": 100, "consistency": 96, "accuracy": 97}'::jsonb),
    
    ('ratecard-del', 'demo-tenant', 'import-del', 'supplier-deloitte',
     'Deloitte', 'BIG_4', '2024-01-01', '2025-12-31', 'USD', 'USD',
     'CSV Import', 'admin@demo.com', 'APPROVED',
     '{"completeness": 100, "consistency": 98, "accuracy": 99}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 5. Create Role Rates (Accenture)
INSERT INTO "RoleRate" (
    id, "rateCardId", role, "standardizedRole", seniority,
    "lineOfService", country, "dailyRate", currency, "effectiveDate", 
    "expiryDate", "isBaseline"
)
VALUES
    ('rate-acc-1', 'ratecard-acc', 'Senior Software Engineer', 
     'Software Engineer', 'SENIOR', 'Technology', 'United States', 1200, 'USD', 
     '2024-01-01', '2025-12-31', false),
    
    ('rate-acc-2', 'ratecard-acc', 'Principal Architect',
     'Solution Architect', 'PRINCIPAL', 'Technology', 'United States', 1800, 'USD',
     '2024-01-01', '2025-12-31', false),
    
    ('rate-acc-3', 'ratecard-acc', 'Data Scientist',
     'Data Scientist', 'SENIOR', 'Data & Analytics', 'United States', 1400, 'USD',
     '2024-01-01', '2025-12-31', false),
    
    ('rate-acc-4', 'ratecard-acc', 'DevOps Engineer',
     'DevOps Engineer', 'MID', 'Technology', 'United States', 1000, 'USD',
     '2024-01-01', '2025-12-31', false),
    
    ('rate-acc-5', 'ratecard-acc', 'Project Manager',
     'Project Manager', 'SENIOR', 'Management', 'United States', 1350, 'USD',
     '2024-01-01', '2025-12-31', false)
ON CONFLICT (id) DO NOTHING;

-- Create Role Rates (Thoughtworks)
INSERT INTO "RoleRate" (
    id, "rateCardId", role, "standardizedRole", seniority,
    "lineOfService", country, "dailyRate", currency, "effectiveDate", 
    "expiryDate", "isBaseline"
)
VALUES
    ('rate-tw-1', 'ratecard-tw', 'Full Stack Developer',
     'Software Engineer', 'SENIOR', 'Technology', 'United States', 950, 'USD',
     '2024-01-01', '2025-12-31', false),
    
    ('rate-tw-2', 'ratecard-tw', 'Tech Lead',
     'Technical Lead', 'LEAD', 'Technology', 'United States', 1300, 'USD',
     '2024-01-01', '2025-12-31', false),
    
    ('rate-tw-3', 'ratecard-tw', 'UX Designer',
     'UX Designer', 'MID', 'Design', 'United States', 850, 'USD',
     '2024-01-01', '2025-12-31', false)
ON CONFLICT (id) DO NOTHING;

-- Create Role Rates (Infosys)
INSERT INTO "RoleRate" (
    id, "rateCardId", role, "standardizedRole", seniority,
    "lineOfService", country, "dailyRate", currency, "effectiveDate", 
    "expiryDate", "isBaseline"
)
VALUES
    ('rate-inf-1', 'ratecard-inf', 'Senior Developer',
     'Software Engineer', 'SENIOR', 'Technology', 'India', 650, 'USD',
     '2024-01-01', '2025-12-31', false),
    
    ('rate-inf-2', 'ratecard-inf', 'Solution Architect',
     'Solution Architect', 'LEAD', 'Technology', 'India', 850, 'USD',
     '2024-01-01', '2025-12-31', false),
    
    ('rate-inf-3', 'ratecard-inf', 'QA Engineer',
     'QA Engineer', 'MID', 'Quality Assurance', 'India', 500, 'USD',
     '2024-01-01', '2025-12-31', false),
    
    ('rate-inf-4', 'ratecard-inf', 'Data Engineer',
     'Data Engineer', 'SENIOR', 'Data & Analytics', 'India', 700, 'USD',
     '2024-01-01', '2025-12-31', false)
ON CONFLICT (id) DO NOTHING;

-- Create Role Rates (Deloitte)
INSERT INTO "RoleRate" (
    id, "rateCardId", role, "standardizedRole", seniority,
    "lineOfService", country, "dailyRate", currency, "effectiveDate", 
    "expiryDate", "isBaseline"
)
VALUES
    ('rate-del-1', 'ratecard-del', 'Senior Developer',
     'Software Engineer', 'SENIOR', 'Technology', 'United States', 1150, 'USD',
     '2024-01-01', '2025-12-31', false),
    
    ('rate-del-2', 'ratecard-del', 'Lead Architect',
     'Solution Architect', 'LEAD', 'Technology', 'United States', 1650, 'USD',
     '2024-01-01', '2025-12-31', false),
    
    ('rate-del-3', 'ratecard-del', 'Security Analyst',
     'Security Engineer', 'MID', 'Security', 'United States', 1100, 'USD',
     '2024-01-01', '2025-12-31', false)
ON CONFLICT (id) DO NOTHING;

-- Summary
SELECT '🎉 Mock data seeded successfully!' as message;
SELECT 
    'Contracts' as table_name, 
    COUNT(*) as count 
FROM "Contract" 
WHERE "tenantId" = 'demo-tenant'
UNION ALL
SELECT 
    'Rate Cards' as table_name, 
    COUNT(*) as count 
FROM "RateCard" 
WHERE "tenantId" = 'demo-tenant'
UNION ALL
SELECT 
    'Role Rates' as table_name, 
    COUNT(*) as count 
FROM "RoleRate" 
WHERE "rateCardId" IN (SELECT id FROM "RateCard" WHERE "tenantId" = 'demo-tenant');
