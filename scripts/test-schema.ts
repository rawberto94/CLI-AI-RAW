#!/usr/bin/env tsx
/**
 * Quick test to verify taxonomy and baseline schema
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Procurement Taxonomy & Baseline Schema\n');

  // Test 1: Check procurement categories
  console.log('TEST 1: Procurement Categories');
  const categoryCount = await prisma.procurementCategory.count({
    where: { tenantId: 'demo' },
  });
  console.log(`✅ Found ${categoryCount} procurement categories\n`);

  // Show L1 breakdown
  const l1Categories = await prisma.procurementCategory.groupBy({
    by: ['categoryL1'],
    where: { tenantId: 'demo' },
    _count: true,
  });
  
  console.log('L1 Category Breakdown:');
  l1Categories.forEach(cat => {
    console.log(`  ${cat.categoryL1}: ${cat._count} subcategories`);
  });

  // Test 2: Check baseline rates
  console.log('\nTEST 2: Baseline Rates');
  const baselineCount = await prisma.baselineRate.count({
    where: { tenantId: 'demo' },
  });
  console.log(`✅ Found ${baselineCount} baseline rates`);

  if (baselineCount > 0) {
    const byType = await prisma.baselineRate.groupBy({
      by: ['baselineType'],
      where: { tenantId: 'demo', status: 'ACTIVE' },
      _count: true,
      _avg: { dailyRateUSD: true },
    });

    console.log('\nBy Type:');
    byType.forEach(t => {
      console.log(`  ${t.baselineType}: ${t._count} (avg: $${t._avg.dailyRateUSD?.toFixed(2)}/day)`);
    });
  }

  // Test 3: Check rate card entries with baselines
  console.log('\nTEST 3: Rate Cards with Baselines');
  const rateCardsWithBaselines = await prisma.rateCardEntry.count({
    where: {
      tenantId: 'demo',
      baselineRates: {
        some: { status: 'ACTIVE' },
      },
    },
  });
  console.log(`✅ ${rateCardsWithBaselines} rate card entries have active baselines\n`);

  // Test 4: Check contracts with categories
  console.log('TEST 4: Contracts with Categories');
  const contractsWithCategories = await prisma.contract.count({
    where: {
      tenantId: 'demo',
      procurementCategoryId: { not: null },
    },
  });
  console.log(`✅ ${contractsWithCategories} contracts are categorized\n`);

  console.log('✅ All schema tests passed!\n');
}

main()
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
