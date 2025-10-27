#!/usr/bin/env node
/**
 * Seed realistic rate card data for baseline comparison testing
 * 
 * Creates a sample contract with IT consulting rate cards that match
 * the baselines we imported for testing.
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), 'apps/web/.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding Rate Card Data');
  console.log('==========================\n');

  const tenantId = 'demo';

  // Create or get supplier
  console.log('🏢 Creating supplier...');
  const supplier = await prisma.rateCardSupplier.upsert({
    where: {
      tenantId_name: {
        tenantId,
        name: 'TechConsult Inc.'
      }
    },
    create: {
      tenantId,
      name: 'TechConsult Inc.',
      legalName: 'TechConsult Incorporated',
      tier: 'TIER_2',
      country: 'USA',
      region: 'North America',
    },
    update: {}
  });
  console.log(`✅ Supplier created: ${supplier.id}\n`);

  // Create or get contract
  console.log('📄 Creating sample contract...');
  
  const contract = await prisma.contract.create({
    data: {
      fileName: 'SOW-2025-IT-001.pdf',
      originalName: 'IT Consulting Services SOW.pdf',
      mimeType: 'application/pdf',
      fileSize: BigInt(1024000),
      uploadedAt: new Date(),
      storagePath: '/contracts/test/SOW-2025-IT-001.pdf',
      
      // Contract details
      contractTitle: 'IT Consulting Services - FY2025',
      supplierName: 'TechConsult Inc.',
      contractType: 'STATEMENT_OF_WORK',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      totalValue: 2500000,
      currency: 'USD',
      
      // Add required tenant relation
      tenant: {
        connectOrCreate: {
          where: { id: tenantId },
          create: {
            id: tenantId,
            name: 'Demo Tenant',
            slug: 'demo'
          }
        }
      }
    }
  });

  console.log(`✅ Contract created: ${contract.id}`);

  // Create rate cards matching our baselines
  console.log('\n💳 Creating rate card entries...');
  
  const rateCardData = [
    // Senior Software Developers - should match TARGET_RATE baseline ($800)
    {
      roleOriginal: 'Senior Software Developer',
      roleStandardized: 'Software Developer',
      seniority: 'SENIOR',
      dailyRateUSD: 950, // $150 above baseline - savings opportunity!
      country: 'USA',
      lineOfService: 'Software Development',
      volumeCommitted: 5,
    },
    {
      roleOriginal: 'Senior DevOps Engineer',
      roleStandardized: 'Software Developer',
      seniority: 'SENIOR',
      dailyRateUSD: 920,
      country: 'USA',
      lineOfService: 'DevOps',
      volumeCommitted: 3,
    },
    
    // Mid-level developers - should match TARGET_RATE baseline ($600)
    {
      roleOriginal: 'Mid-Level Software Developer',
      roleStandardized: 'Software Developer',
      seniority: 'MID',
      dailyRateUSD: 720, // $120 above baseline
      country: 'USA',
      lineOfService: 'Software Development',
      volumeCommitted: 8,
    },
    {
      roleOriginal: 'Software Engineer II',
      roleStandardized: 'Software Developer',
      seniority: 'MID',
      dailyRateUSD: 680,
      country: 'USA',
      lineOfService: 'Software Development',
      volumeCommitted: 6,
    },
    
    // Junior developers - should match TARGET_RATE baseline ($400)
    {
      roleOriginal: 'Junior Software Developer',
      roleStandardized: 'Software Developer',
      seniority: 'JUNIOR',
      dailyRateUSD: 480, // $80 above baseline
      country: 'USA',
      lineOfService: 'Software Development',
      volumeCommitted: 4,
    },
    
    // Management Consultants - should match consulting baseline ($1200)
    {
      roleOriginal: 'Senior Management Consultant',
      roleStandardized: 'Management Consultant',
      seniority: 'SENIOR',
      dailyRateUSD: 1350, // $150 above baseline
      country: 'USA',
      lineOfService: 'Management Consulting',
      volumeCommitted: 2,
    },
    
    // Some roles that won't match baselines (for comparison)
    {
      roleOriginal: 'Project Manager',
      roleStandardized: 'Project Manager',
      seniority: 'SENIOR',
      dailyRateUSD: 850,
      country: 'USA',
      lineOfService: 'Project Management',
      volumeCommitted: 3,
    },
    {
      roleOriginal: 'Business Analyst',
      roleStandardized: 'Business Analyst',
      seniority: 'MID',
      dailyRateUSD: 650,
      country: 'USA',
      lineOfService: 'Business Analysis',
      volumeCommitted: 4,
    }
  ];

  let created = 0;
  let failed = 0;

  for (const rateData of rateCardData) {
    try {
      await prisma.rateCardEntry.create({
        data: {
          tenantId,
          contractId: contract.id,
          ...rateData,
          currency: 'USD',
          dailyRate: rateData.dailyRateUSD,
          dailyRateCHF: rateData.dailyRateUSD * 0.88, // Approx conversion
          effectiveDate: new Date('2025-01-01'),
          source: 'MANUAL',
          supplierName: 'TechConsult Inc.',
          supplierId: supplier.id,
          supplierTier: 'TIER_2',
          supplierCountry: 'USA',
          supplierRegion: 'North America',
          region: 'North America',
          roleCategory: rateData.lineOfService,
          confidence: 0.95,
          dataQuality: 'HIGH',
        }
      });
      created++;
      console.log(`   ✓ ${rateData.roleOriginal} (${rateData.seniority}) - $${rateData.dailyRateUSD}/day`);
    } catch (error) {
      failed++;
      console.error(`   ✗ Failed to create ${rateData.roleOriginal}: ${error.message}`);
    }
  }

  console.log(`\n✅ Rate Cards Created: ${created}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}`);
  }

  // Calculate expected savings
  console.log('\n💰 Expected Savings Opportunities:');
  console.log('   Senior SW Developer: 5 × $150/day = $750/day');
  console.log('   Senior DevOps: 3 × $120/day = $360/day');
  console.log('   Mid-level Developer: 8 × $120/day = $960/day');
  console.log('   Mid-level Engineer: 6 × $80/day = $480/day');
  console.log('   Junior Developer: 4 × $80/day = $320/day');
  console.log('   Senior Consultant: 2 × $150/day = $300/day');
  console.log('   ─────────────────────────────────────────');
  console.log('   TOTAL: ~$3,170/day savings potential');
  console.log('   Annual (220 days): ~$697,400/year\n');

  console.log('✅ Seed complete! Ready to test baseline comparisons.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
