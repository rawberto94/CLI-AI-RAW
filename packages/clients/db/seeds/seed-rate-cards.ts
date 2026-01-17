/**
 * Seed script to create sample rate card data for testing
 */

import { PrismaClient, SeniorityLevel, SupplierTier } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {

  // Get the first tenant
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    throw new Error('No tenant found. Please create a tenant first.');
  }

  // Create sample suppliers
  const suppliers = await Promise.all([
    prisma.rateCardSupplier.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Accenture' } },
      create: {
        tenantId: tenant.id,
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
      where: { tenantId_name: { tenantId: tenant.id, name: 'Deloitte' } },
      create: {
        tenantId: tenant.id,
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
      where: { tenantId_name: { tenantId: tenant.id, name: 'Thoughtworks' } },
      create: {
        tenantId: tenant.id,
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
      where: { tenantId_name: { tenantId: tenant.id, name: 'Infosys' } },
      create: {
        tenantId: tenant.id,
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

  // Sample rate cards for different roles
  const sampleRates = [
    // Accenture rates
    { supplier: suppliers[0], role: 'Senior Software Engineer', standardized: 'Software Engineer', seniority: 'SENIOR', dailyRate: 1200, country: 'United States' },
    { supplier: suppliers[0], role: 'Principal Architect', standardized: 'Solution Architect', seniority: 'PRINCIPAL', dailyRate: 1800, country: 'United States' },
    { supplier: suppliers[0], role: 'Data Scientist', standardized: 'Data Scientist', seniority: 'SENIOR', dailyRate: 1400, country: 'United States' },
    { supplier: suppliers[0], role: 'DevOps Engineer', standardized: 'DevOps Engineer', seniority: 'MID', dailyRate: 1000, country: 'United States' },
    { supplier: suppliers[0], role: 'Project Manager', standardized: 'Project Manager', seniority: 'SENIOR', dailyRate: 1300, country: 'United States' },

    // Deloitte rates
    { supplier: suppliers[1], role: 'Senior Developer', standardized: 'Software Engineer', seniority: 'SENIOR', dailyRate: 1150, country: 'United States' },
    { supplier: suppliers[1], role: 'Lead Architect', standardized: 'Solution Architect', seniority: 'PRINCIPAL', dailyRate: 1750, country: 'United States' },
    { supplier: suppliers[1], role: 'Senior Data Engineer', standardized: 'Data Engineer', seniority: 'SENIOR', dailyRate: 1300, country: 'United States' },
    { supplier: suppliers[1], role: 'Cloud Engineer', standardized: 'Cloud Engineer', seniority: 'MID', dailyRate: 1050, country: 'United States' },
    { supplier: suppliers[1], role: 'Scrum Master', standardized: 'Scrum Master', seniority: 'MID', dailyRate: 950, country: 'United States' },

    // Thoughtworks rates
    { supplier: suppliers[2], role: 'Software Engineer', standardized: 'Software Engineer', seniority: 'SENIOR', dailyRate: 950, country: 'United States' },
    { supplier: suppliers[2], role: 'Tech Lead', standardized: 'Tech Lead', seniority: 'PRINCIPAL', dailyRate: 1400, country: 'United States' },
    { supplier: suppliers[2], role: 'UX Designer', standardized: 'UX Designer', seniority: 'SENIOR', dailyRate: 900, country: 'United States' },
    { supplier: suppliers[2], role: 'QA Engineer', standardized: 'QA Engineer', seniority: 'MID', dailyRate: 800, country: 'United States' },

    // Infosys rates
    { supplier: suppliers[3], role: 'Senior Java Developer', standardized: 'Software Engineer', seniority: 'SENIOR', dailyRate: 650, country: 'India' },
    { supplier: suppliers[3], role: 'Solution Architect', standardized: 'Solution Architect', seniority: 'PRINCIPAL', dailyRate: 900, country: 'India' },
    { supplier: suppliers[3], role: 'Full Stack Developer', standardized: 'Software Engineer', seniority: 'MID', dailyRate: 500, country: 'India' },
    { supplier: suppliers[3], role: 'Database Administrator', standardized: 'Database Administrator', seniority: 'MID', dailyRate: 550, country: 'India' },
  ];

  const rateCards = [];
  for (const rate of sampleRates) {
    const converted = {
      usd: rate.dailyRate * (rate.country === 'India' ? 1.0 : 1.0),
      chf: rate.dailyRate * (rate.country === 'India' ? 0.88 : 0.88),
    };

    const rateCard = await prisma.rateCardEntry.create({
      data: {
        tenantId: tenant.id,
        source: 'MANUAL',
        enteredBy: 'system',

        supplierId: rate.supplier.id,
        supplierName: rate.supplier.name,
        supplierTier: rate.supplier.tier,
        supplierCountry: rate.supplier.country,
        supplierRegion: rate.supplier.region,

        roleOriginal: rate.role,
        roleStandardized: rate.standardized,
        roleCategory: 'Technology',
        seniority: rate.seniority as SeniorityLevel,
        lineOfService: 'Technology Consulting',

        dailyRate: rate.dailyRate,
        currency: 'USD',
        dailyRateUSD: converted.usd,
        dailyRateCHF: converted.chf,

        country: rate.country,
        region: rate.country === 'India' ? 'APAC' : 'Americas',
        remoteAllowed: true,

        effectiveDate: new Date('2025-01-01'),
        expiryDate: new Date('2025-12-31'),
        contractValue: rate.dailyRate * 250, // 250 days

        confidence: 0.95,
        dataQuality: 'HIGH',
      },
    });

    rateCards.push(rateCard);
  }

  // Calculate some benchmark data for a few entries
  
  // Get all Software Engineer rates for benchmarking
  const swEngRates = rateCards
    .filter(r => r.roleStandardized === 'Software Engineer' && r.country === 'United States')
    .map(r => Number(r.dailyRateUSD))
    .sort((a, b) => a - b);

  if (swEngRates.length > 0) {
    const avg = swEngRates.reduce((sum, r) => sum + r, 0) / swEngRates.length;
    const median = swEngRates[Math.floor(swEngRates.length / 2)];

    // Update rate cards with market averages
    await prisma.rateCardEntry.updateMany({
      where: {
        roleStandardized: 'Software Engineer',
        country: 'United States',
      },
      data: {
        marketRateAverage: avg,
        marketRateMedian: median,
        marketRateP25: swEngRates[Math.floor(swEngRates.length * 0.25)],
        marketRateP75: swEngRates[Math.floor(swEngRates.length * 0.75)],
      },
    });
  }

}

main()
  .catch(() => {
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
