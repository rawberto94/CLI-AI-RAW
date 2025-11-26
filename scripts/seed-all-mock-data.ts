#!/usr/bin/env tsx
/**
 * Comprehensive mock data seeding script
 * Seeds all tables with realistic demo data
 * Updated to match current Prisma schema
 */

import { PrismaClient, ContractStatus, SeniorityLevel } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive mock data seeding...\n');

  const tenantId = 'demo';

  // 1. Ensure tenant exists
  console.log('1️⃣ Creating/updating tenant...');
  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    create: {
      id: tenantId,
      name: 'Demo Organization',
      slug: 'demo',
    },
    update: {},
  });
  console.log(`✅ Tenant: ${tenant.name}\n`);

  // 2. Create users
  console.log('2️⃣ Creating users...');
  // Using a simple hash for demo purposes - in production use bcrypt
  const demoPasswordHash = '$2b$10$demohashdemohashdemohashdemohashdemohashdemo';
  
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@demo.com' },
      create: {
        email: 'admin@demo.com',
        firstName: 'Demo',
        lastName: 'Admin',
        tenantId,
        role: 'ADMIN',
        passwordHash: demoPasswordHash,
        emailVerified: true,
      },
      update: {},
    }),
    prisma.user.upsert({
      where: { email: 'analyst@demo.com' },
      create: {
        email: 'analyst@demo.com',
        firstName: 'Contract',
        lastName: 'Analyst',
        tenantId,
        role: 'USER',
        passwordHash: demoPasswordHash,
        emailVerified: true,
      },
      update: {},
    }),
  ]);
  console.log(`✅ Created ${users.length} users\n`);

  // 3. Create contracts (matching current schema)
  console.log('3️⃣ Creating sample contracts...');
  const contractData = [
    {
      tenantId,
      fileName: 'it-services-accenture.pdf',
      mimeType: 'application/pdf',
      fileSize: BigInt(2500000),
      contractTitle: 'IT Services Agreement - Accenture',
      supplierName: 'Accenture',
      category: 'IT Services',
      status: ContractStatus.ACTIVE,
      uploadedAt: new Date('2024-01-15'),
      startDate: new Date('2024-01-15'),
      endDate: new Date('2025-12-31'),
      totalValue: 2500000,
      currency: 'USD',
      rawText: 'Sample contract for IT consulting services with Accenture. This Master Services Agreement covers software development, technical consulting, and managed services. The agreement includes provisions for rate cards, SLAs, and intellectual property rights.',
      description: 'Enterprise IT consulting and software development services',
      uploadedBy: users[0].id,
      searchableText: 'IT consulting software development Accenture technology services enterprise agreement',
    },
    {
      tenantId,
      fileName: 'software-dev-thoughtworks.pdf',
      mimeType: 'application/pdf',
      fileSize: BigInt(1800000),
      contractTitle: 'Software Development MSA - Thoughtworks',
      supplierName: 'Thoughtworks',
      category: 'Software Development',
      status: ContractStatus.ACTIVE,
      uploadedAt: new Date('2024-03-01'),
      startDate: new Date('2024-03-01'),
      endDate: new Date('2026-02-28'),
      totalValue: 1800000,
      currency: 'USD',
      rawText: 'Master Services Agreement for software development and digital transformation services with Thoughtworks. Includes agile development, DevOps practices, and continuous delivery.',
      description: 'Software development and digital transformation consulting',
      uploadedBy: users[0].id,
      searchableText: 'software development agile Thoughtworks DevOps digital transformation',
    },
    {
      tenantId,
      fileName: 'cloud-infrastructure-aws.pdf',
      mimeType: 'application/pdf',
      fileSize: BigInt(3200000),
      contractTitle: 'Cloud Infrastructure - AWS',
      supplierName: 'Amazon Web Services',
      category: 'Cloud Services',
      status: ContractStatus.ACTIVE,
      uploadedAt: new Date('2023-06-01'),
      startDate: new Date('2023-06-01'),
      endDate: new Date('2025-05-31'),
      totalValue: 3200000,
      currency: 'USD',
      rawText: 'Enterprise agreement for AWS cloud infrastructure including compute, storage, and networking services. Includes reserved instance pricing and enterprise support.',
      description: 'Cloud infrastructure and platform services',
      uploadedBy: users[0].id,
      searchableText: 'AWS cloud infrastructure compute storage networking enterprise',
    },
    {
      tenantId,
      fileName: 'data-analytics-infosys.pdf',
      mimeType: 'application/pdf',
      fileSize: BigInt(950000),
      contractTitle: 'Data Analytics Platform - Infosys',
      supplierName: 'Infosys',
      category: 'Data & Analytics',
      status: ContractStatus.PENDING_REVIEW,
      uploadedAt: new Date('2023-09-15'),
      startDate: new Date('2023-09-15'),
      endDate: new Date('2025-03-15'),
      totalValue: 950000,
      currency: 'USD',
      rawText: 'Statement of Work for data analytics platform development including data warehouse design, ETL pipelines, and business intelligence dashboards.',
      description: 'Data analytics and business intelligence platform development',
      uploadedBy: users[1].id,
      searchableText: 'data analytics Infosys business intelligence ETL data warehouse',
    },
    {
      tenantId,
      fileName: 'cybersecurity-deloitte.pdf',
      mimeType: 'application/pdf',
      fileSize: BigInt(650000),
      contractTitle: 'Cybersecurity Assessment - Deloitte',
      supplierName: 'Deloitte',
      category: 'Security',
      status: ContractStatus.DRAFT,
      uploadedAt: new Date('2024-10-01'),
      startDate: new Date('2024-11-01'),
      endDate: new Date('2025-09-30'),
      totalValue: 650000,
      currency: 'USD',
      rawText: 'Cybersecurity assessment and remediation services including vulnerability assessment, penetration testing, and security architecture review.',
      description: 'Cybersecurity consulting and assessment services',
      uploadedBy: users[1].id,
      searchableText: 'cybersecurity Deloitte security assessment penetration testing vulnerability',
    },
  ];

  const contracts = [];
  for (const contract of contractData) {
    const created = await prisma.contract.create({
      data: contract,
    });
    contracts.push(created);
  }
  console.log(`✅ Created ${contracts.length} contracts\n`);

  // 4. Create rate card suppliers
  console.log('4️⃣ Creating rate card suppliers...');
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

  // 5. Create rate card entries linked to contracts
  console.log('5️⃣ Creating rate card entries...');
  
  // Map supplier index to tier
  const supplierTiers = ['BIG_4', 'BIG_4', 'BOUTIQUE', 'OFFSHORE'] as const;
  const supplierCountries = ['United States', 'United States', 'United States', 'India'];
  const supplierRegions = ['Americas', 'Americas', 'Americas', 'APAC'];
  
  const rateCardData = [
    // Accenture rates
    { supplierIdx: 0, contractId: contracts[0].id, role: 'Senior Software Engineer', standardizedRole: 'Software Engineer', roleCategory: 'Engineering', seniority: 'SENIOR' as SeniorityLevel, dailyRate: 1200, country: 'United States', region: 'Americas', lineOfService: 'Technology' },
    { supplierIdx: 0, contractId: contracts[0].id, role: 'Principal Architect', standardizedRole: 'Solution Architect', roleCategory: 'Architecture', seniority: 'PRINCIPAL' as SeniorityLevel, dailyRate: 1800, country: 'United States', region: 'Americas', lineOfService: 'Technology' },
    { supplierIdx: 0, contractId: contracts[0].id, role: 'Data Scientist', standardizedRole: 'Data Scientist', roleCategory: 'Data', seniority: 'SENIOR' as SeniorityLevel, dailyRate: 1400, country: 'United States', region: 'Americas', lineOfService: 'Data & Analytics' },
    { supplierIdx: 0, contractId: contracts[0].id, role: 'DevOps Engineer', standardizedRole: 'DevOps Engineer', roleCategory: 'Engineering', seniority: 'MID' as SeniorityLevel, dailyRate: 1000, country: 'United States', region: 'Americas', lineOfService: 'Technology' },
    
    // Deloitte rates
    { supplierIdx: 1, contractId: contracts[4].id, role: 'Senior Developer', standardizedRole: 'Software Engineer', roleCategory: 'Engineering', seniority: 'SENIOR' as SeniorityLevel, dailyRate: 1150, country: 'United States', region: 'Americas', lineOfService: 'Technology' },
    { supplierIdx: 1, contractId: contracts[4].id, role: 'Lead Architect', standardizedRole: 'Solution Architect', roleCategory: 'Architecture', seniority: 'PRINCIPAL' as SeniorityLevel, dailyRate: 1650, country: 'United States', region: 'Americas', lineOfService: 'Technology' },
    { supplierIdx: 1, contractId: contracts[4].id, role: 'Security Analyst', standardizedRole: 'Security Engineer', roleCategory: 'Security', seniority: 'MID' as SeniorityLevel, dailyRate: 1100, country: 'United States', region: 'Americas', lineOfService: 'Security' },
    
    // Thoughtworks rates
    { supplierIdx: 2, contractId: contracts[1].id, role: 'Full Stack Developer', standardizedRole: 'Software Engineer', roleCategory: 'Engineering', seniority: 'SENIOR' as SeniorityLevel, dailyRate: 950, country: 'United States', region: 'Americas', lineOfService: 'Technology' },
    { supplierIdx: 2, contractId: contracts[1].id, role: 'Tech Lead', standardizedRole: 'Technical Lead', roleCategory: 'Engineering', seniority: 'PRINCIPAL' as SeniorityLevel, dailyRate: 1300, country: 'United States', region: 'Americas', lineOfService: 'Technology' },
    { supplierIdx: 2, contractId: contracts[1].id, role: 'UX Designer', standardizedRole: 'UX Designer', roleCategory: 'Design', seniority: 'MID' as SeniorityLevel, dailyRate: 850, country: 'United States', region: 'Americas', lineOfService: 'Design' },
    
    // Infosys rates
    { supplierIdx: 3, contractId: contracts[3].id, role: 'Senior Developer', standardizedRole: 'Software Engineer', roleCategory: 'Engineering', seniority: 'SENIOR' as SeniorityLevel, dailyRate: 650, country: 'India', region: 'APAC', lineOfService: 'Technology' },
    { supplierIdx: 3, contractId: contracts[3].id, role: 'Solution Architect', standardizedRole: 'Solution Architect', roleCategory: 'Architecture', seniority: 'PRINCIPAL' as SeniorityLevel, dailyRate: 850, country: 'India', region: 'APAC', lineOfService: 'Technology' },
    { supplierIdx: 3, contractId: contracts[3].id, role: 'QA Engineer', standardizedRole: 'QA Engineer', roleCategory: 'Quality', seniority: 'MID' as SeniorityLevel, dailyRate: 500, country: 'India', region: 'APAC', lineOfService: 'Quality Assurance' },
    { supplierIdx: 3, contractId: contracts[3].id, role: 'Data Engineer', standardizedRole: 'Data Engineer', roleCategory: 'Data', seniority: 'SENIOR' as SeniorityLevel, dailyRate: 700, country: 'India', region: 'APAC', lineOfService: 'Data & Analytics' },
  ];

  for (const rate of rateCardData) {
    const supplier = suppliers[rate.supplierIdx];
    await prisma.rateCardEntry.create({
      data: {
        tenantId,
        // Source
        source: 'MANUAL',
        contractId: rate.contractId,
        // Supplier
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierTier: supplierTiers[rate.supplierIdx],
        supplierCountry: supplierCountries[rate.supplierIdx],
        supplierRegion: supplierRegions[rate.supplierIdx],
        // Role
        roleOriginal: rate.role,
        roleStandardized: rate.standardizedRole,
        roleCategory: rate.roleCategory,
        seniority: rate.seniority,
        lineOfService: rate.lineOfService,
        // Rate
        dailyRate: rate.dailyRate,
        currency: 'USD',
        dailyRateUSD: rate.dailyRate,
        dailyRateCHF: Math.round(rate.dailyRate * 0.89), // Approximate conversion
        // Geographic
        country: rate.country,
        region: rate.region,
        // Contract
        effectiveDate: new Date('2024-01-01'),
        expiryDate: new Date('2025-12-31'),
        // Quality
        confidence: 0.95,
        dataQuality: 'HIGH',
      },
    });
  }
  console.log(`✅ Created ${rateCardData.length} rate card entries\n`);

  // 6. Create benchmarks
  // 6. Create contract metadata for enriched data
  console.log('6️⃣ Creating contract metadata...');
  for (const contract of contracts) {
    await prisma.contractMetadata.upsert({
      where: { contractId: contract.id },
      create: {
        contractId: contract.id,
        tenantId,
        updatedBy: users[0].id, // Admin user
        tags: ['demo', contract.category || 'general'],
        searchKeywords: [contract.contractTitle || '', contract.supplierName || ''].filter(Boolean),
      },
      update: {},
    });
  }
  console.log(`✅ Created ${contracts.length} contract metadata entries\n`);

  console.log('🎉 Mock data seeding complete!');
  console.log('\n📊 Summary:');
  console.log(`   - 1 tenant`);
  console.log(`   - ${users.length} users`);
  console.log(`   - ${contracts.length} contracts`);
  console.log(`   - ${suppliers.length} suppliers`);
  console.log(`   - ${rateCardData.length} rate card entries`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
