#!/usr/bin/env tsx
/**
 * Comprehensive mock data seeding script
 * Seeds all tables with realistic demo data
 */

import { PrismaClient, ContractStatus, SeniorityLevel } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive mock data seeding...\n');

  const tenantId = 'demo-tenant';

  // 1. Ensure tenant exists
  console.log('1️⃣ Creating/updating tenant...');
  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      name: 'Demo Organization',
      settings: {},
    },
    update: {
      name: 'Demo Organization',
    },
  });
  console.log(`✅ Tenant: ${tenant.name}\n`);

  // 2. Create contracts
  console.log('2️⃣ Creating sample contracts...');
  const contracts = await Promise.all([
    prisma.contract.upsert({
      where: { tenantId_title: { tenantId, title: 'IT Services Agreement - Accenture' } },
      create: {
        tenantId,
        title: 'IT Services Agreement - Accenture',
        status: 'ACTIVE',
        uploadDate: new Date('2024-01-15'),
        expiryDate: new Date('2025-12-31'),
        totalValue: 2500000,
        supplier: 'Accenture',
        category: 'IT Services',
        rawText: 'Sample contract for IT consulting services with Accenture...',
        metadata: {
          parties: ['Demo Organization', 'Accenture PLC'],
          effectiveDate: '2024-01-15',
          terms: '24 months',
        },
      },
      update: {},
    }),
    prisma.contract.upsert({
      where: { tenantId_title: { tenantId, title: 'Software Development MSA - Thoughtworks' } },
      create: {
        tenantId,
        title: 'Software Development MSA - Thoughtworks',
        status: 'ACTIVE',
        uploadDate: new Date('2024-03-01'),
        expiryDate: new Date('2026-02-28'),
        totalValue: 1800000,
        supplier: 'Thoughtworks',
        category: 'Software Development',
        rawText: 'Master Services Agreement for software development...',
        metadata: {
          parties: ['Demo Organization', 'Thoughtworks Inc'],
          effectiveDate: '2024-03-01',
          terms: '24 months',
        },
      },
      update: {},
    }),
    prisma.contract.upsert({
      where: { tenantId_title: { tenantId, title: 'Cloud Infrastructure - AWS' } },
      create: {
        tenantId,
        title: 'Cloud Infrastructure - AWS',
        status: 'ACTIVE',
        uploadDate: new Date('2023-06-01'),
        expiryDate: new Date('2025-05-31'),
        totalValue: 3200000,
        supplier: 'Amazon Web Services',
        category: 'Cloud Services',
        rawText: 'Enterprise agreement for AWS cloud infrastructure...',
        metadata: {
          parties: ['Demo Organization', 'Amazon Web Services Inc'],
          effectiveDate: '2023-06-01',
          terms: '24 months',
        },
      },
      update: {},
    }),
    prisma.contract.upsert({
      where: { tenantId_title: { tenantId, title: 'Data Analytics Platform - Infosys' } },
      create: {
        tenantId,
        title: 'Data Analytics Platform - Infosys',
        status: 'PENDING_RENEWAL',
        uploadDate: new Date('2023-09-15'),
        expiryDate: new Date('2025-03-15'),
        totalValue: 950000,
        supplier: 'Infosys',
        category: 'Data & Analytics',
        rawText: 'Statement of Work for data analytics platform development...',
        metadata: {
          parties: ['Demo Organization', 'Infosys Limited'],
          effectiveDate: '2023-09-15',
          terms: '18 months',
        },
      },
      update: {},
    }),
    prisma.contract.upsert({
      where: { tenantId_title: { tenantId, title: 'Cybersecurity Assessment - Deloitte' } },
      create: {
        tenantId,
        title: 'Cybersecurity Assessment - Deloitte',
        status: 'DRAFT',
        uploadDate: new Date('2024-10-01'),
        expiryDate: new Date('2025-09-30'),
        totalValue: 650000,
        supplier: 'Deloitte',
        category: 'Security',
        rawText: 'Cybersecurity assessment and remediation services...',
        metadata: {
          parties: ['Demo Organization', 'Deloitte Consulting LLP'],
          effectiveDate: '2024-11-01',
          terms: '12 months',
        },
      },
      update: {},
    }),
  ]);
  console.log(`✅ Created ${contracts.length} contracts\n`);

  // 3. Create rate card suppliers
  console.log('3️⃣ Creating rate card suppliers...');
  const suppliers = await Promise.all([
    prisma.rateCardSupplier.upsert({
      where: { tenantId_name: { tenantId, name: 'Accenture' } },
      create: {
        tenantId,
        name: 'Accenture',
        legalName: 'Accenture PLC',
        tier: 'BIG_4',
        country: 'United States',
        region: 'Americas',
        competitivenessScore: 3.5,
        averageRate: 1250,
        totalContracts: 15,
        totalRateCards: 45,
        activeRates: 38,
      },
      update: {},
    }),
    prisma.rateCardSupplier.upsert({
      where: { tenantId_name: { tenantId, name: 'Deloitte' } },
      create: {
        tenantId,
        name: 'Deloitte',
        legalName: 'Deloitte Consulting LLP',
        tier: 'BIG_4',
        country: 'United States',
        region: 'Americas',
        competitivenessScore: 3.8,
        averageRate: 1180,
        totalContracts: 12,
        totalRateCards: 38,
        activeRates: 35,
      },
      update: {},
    }),
    prisma.rateCardSupplier.upsert({
      where: { tenantId_name: { tenantId, name: 'Thoughtworks' } },
      create: {
        tenantId,
        name: 'Thoughtworks',
        legalName: 'Thoughtworks Inc',
        tier: 'BOUTIQUE',
        country: 'United States',
        region: 'Americas',
        competitivenessScore: 4.2,
        averageRate: 950,
        totalContracts: 8,
        totalRateCards: 22,
        activeRates: 20,
      },
      update: {},
    }),
    prisma.rateCardSupplier.upsert({
      where: { tenantId_name: { tenantId, name: 'Infosys' } },
      create: {
        tenantId,
        name: 'Infosys',
        legalName: 'Infosys Limited',
        tier: 'OFFSHORE',
        country: 'India',
        region: 'APAC',
        competitivenessScore: 4.5,
        averageRate: 650,
        totalContracts: 20,
        totalRateCards: 60,
        activeRates: 55,
      },
      update: {},
    }),
  ]);
  console.log(`✅ Created ${suppliers.length} suppliers\n`);

  // 4. Create rate card entries
  console.log('4️⃣ Creating rate card entries...');
  const rateCardData = [
    // Accenture rates
    { supplierId: suppliers[0].id, role: 'Senior Software Engineer', standardizedRole: 'Software Engineer', seniority: 'SENIOR' as SeniorityLevel, dailyRate: 1200, country: 'United States', lineOfService: 'Technology' },
    { supplierId: suppliers[0].id, role: 'Principal Architect', standardizedRole: 'Solution Architect', seniority: 'PRINCIPAL' as SeniorityLevel, dailyRate: 1800, country: 'United States', lineOfService: 'Technology' },
    { supplierId: suppliers[0].id, role: 'Data Scientist', standardizedRole: 'Data Scientist', seniority: 'SENIOR' as SeniorityLevel, dailyRate: 1400, country: 'United States', lineOfService: 'Data & Analytics' },
    { supplierId: suppliers[0].id, role: 'DevOps Engineer', standardizedRole: 'DevOps Engineer', seniority: 'MID' as SeniorityLevel, dailyRate: 1000, country: 'United States', lineOfService: 'Technology' },
    
    // Deloitte rates
    { supplierId: suppliers[1].id, role: 'Senior Developer', standardizedRole: 'Software Engineer', seniority: 'SENIOR' as SeniorityLevel, dailyRate: 1150, country: 'United States', lineOfService: 'Technology' },
    { supplierId: suppliers[1].id, role: 'Lead Architect', standardizedRole: 'Solution Architect', seniority: 'LEAD' as SeniorityLevel, dailyRate: 1650, country: 'United States', lineOfService: 'Technology' },
    { supplierId: suppliers[1].id, role: 'Security Analyst', standardizedRole: 'Security Engineer', seniority: 'MID' as SeniorityLevel, dailyRate: 1100, country: 'United States', lineOfService: 'Security' },
    
    // Thoughtworks rates
    { supplierId: suppliers[2].id, role: 'Full Stack Developer', standardizedRole: 'Software Engineer', seniority: 'SENIOR' as SeniorityLevel, dailyRate: 950, country: 'United States', lineOfService: 'Technology' },
    { supplierId: suppliers[2].id, role: 'Tech Lead', standardizedRole: 'Technical Lead', seniority: 'LEAD' as SeniorityLevel, dailyRate: 1300, country: 'United States', lineOfService: 'Technology' },
    { supplierId: suppliers[2].id, role: 'UX Designer', standardizedRole: 'UX Designer', seniority: 'MID' as SeniorityLevel, dailyRate: 850, country: 'United States', lineOfService: 'Design' },
    
    // Infosys rates
    { supplierId: suppliers[3].id, role: 'Senior Developer', standardizedRole: 'Software Engineer', seniority: 'SENIOR' as SeniorityLevel, dailyRate: 650, country: 'India', lineOfService: 'Technology' },
    { supplierId: suppliers[3].id, role: 'Solution Architect', standardizedRole: 'Solution Architect', seniority: 'LEAD' as SeniorityLevel, dailyRate: 850, country: 'India', lineOfService: 'Technology' },
    { supplierId: suppliers[3].id, role: 'QA Engineer', standardizedRole: 'QA Engineer', seniority: 'MID' as SeniorityLevel, dailyRate: 500, country: 'India', lineOfService: 'Quality Assurance' },
    { supplierId: suppliers[3].id, role: 'Data Engineer', standardizedRole: 'Data Engineer', seniority: 'SENIOR' as SeniorityLevel, dailyRate: 700, country: 'India', lineOfService: 'Data & Analytics' },
  ];

  for (const rate of rateCardData) {
    await prisma.rateCardEntry.create({
      data: {
        tenantId,
        supplierId: rate.supplierId,
        supplierName: suppliers.find(s => s.id === rate.supplierId)?.name || '',
        role: rate.role,
        standardizedRole: rate.standardizedRole,
        seniority: rate.seniority,
        dailyRate: rate.dailyRate,
        currency: 'USD',
        country: rate.country,
        lineOfService: rate.lineOfService,
        effectiveDate: new Date('2024-01-01'),
        expiryDate: new Date('2025-12-31'),
        isBaseline: false,
        source: 'NEGOTIATED',
      },
    });
  }
  console.log(`✅ Created ${rateCardData.length} rate card entries\n`);

  // 5. Create benchmarks
  console.log('5️⃣ Creating role benchmarks...');
  const benchmarks = [
    { role: 'Software Engineer', seniority: 'SENIOR' as SeniorityLevel, country: 'United States', p25: 1000, p50: 1150, p75: 1300, avg: 1150, sampleSize: 4 },
    { role: 'Solution Architect', seniority: 'PRINCIPAL' as SeniorityLevel, country: 'United States', p25: 1650, p50: 1725, p75: 1800, avg: 1725, sampleSize: 2 },
    { role: 'Data Scientist', seniority: 'SENIOR' as SeniorityLevel, country: 'United States', p25: 1400, p50: 1400, p75: 1400, avg: 1400, sampleSize: 1 },
    { role: 'Software Engineer', seniority: 'SENIOR' as SeniorityLevel, country: 'India', p25: 650, p50: 650, p75: 650, avg: 650, sampleSize: 1 },
  ];

  for (const benchmark of benchmarks) {
    await prisma.roleBenchmark.upsert({
      where: {
        tenantId_standardizedRole_seniority_country: {
          tenantId,
          standardizedRole: benchmark.role,
          seniority: benchmark.seniority,
          country: benchmark.country,
        },
      },
      create: {
        tenantId,
        standardizedRole: benchmark.role,
        seniority: benchmark.seniority,
        country: benchmark.country,
        p25Rate: benchmark.p25,
        p50Rate: benchmark.p50,
        p75Rate: benchmark.p75,
        averageRate: benchmark.avg,
        sampleSize: benchmark.sampleSize,
        lastUpdated: new Date(),
      },
      update: {
        p25Rate: benchmark.p25,
        p50Rate: benchmark.p50,
        p75Rate: benchmark.p75,
        averageRate: benchmark.avg,
        sampleSize: benchmark.sampleSize,
        lastUpdated: new Date(),
      },
    });
  }
  console.log(`✅ Created ${benchmarks.length} role benchmarks\n`);

  console.log('🎉 Mock data seeding complete!');
  console.log('\n📊 Summary:');
  console.log(`   - ${contracts.length} contracts`);
  console.log(`   - ${suppliers.length} suppliers`);
  console.log(`   - ${rateCardData.length} rate card entries`);
  console.log(`   - ${benchmarks.length} benchmarks`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
