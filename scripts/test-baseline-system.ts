#!/usr/bin/env tsx
/**
 * Test Baseline System End-to-End
 * 
 * 1. Import sample baselines
 * 2. Compare against existing rate cards
 * 3. Display savings opportunities
 */

import { PrismaClient } from '@prisma/client';
import { BaselineManagementService } from '../packages/data-orchestration/src/services/baseline-management.service';

const prisma = new PrismaClient();

// Sample baseline data for IT Professional Services
const SAMPLE_BASELINES = [
  {
    baselineName: 'IT-Dev-Senior-US-Target-2025',
    baselineType: 'TARGET_RATE',
    role: 'Developer',
    seniority: 'SENIOR',
    country: 'US',
    categoryL1: 'Professional Services',
    categoryL2: 'IT Professional Services',
    dailyRateUSD: 800,
    currency: 'USD',
    minimumRate: 700,
    maximumRate: 900,
    tolerancePercentage: 10,
    source: 'INTERNAL',
    sourceDetails: 'FY2025 strategic target rates',
    effectiveDate: new Date('2025-01-01'),
    notes: 'Target rate for senior developers in US market',
  },
  {
    baselineName: 'IT-Dev-Mid-US-Target-2025',
    baselineType: 'TARGET_RATE',
    role: 'Developer',
    seniority: 'MID_LEVEL',
    country: 'US',
    categoryL1: 'Professional Services',
    categoryL2: 'IT Professional Services',
    dailyRateUSD: 600,
    currency: 'USD',
    minimumRate: 500,
    maximumRate: 700,
    tolerancePercentage: 10,
    source: 'INTERNAL',
    effectiveDate: new Date('2025-01-01'),
  },
  {
    baselineName: 'IT-Dev-Junior-US-Target-2025',
    baselineType: 'TARGET_RATE',
    role: 'Developer',
    seniority: 'JUNIOR',
    country: 'US',
    categoryL1: 'Professional Services',
    categoryL2: 'IT Professional Services',
    dailyRateUSD: 400,
    currency: 'USD',
    minimumRate: 300,
    maximumRate: 500,
    tolerancePercentage: 10,
    source: 'INTERNAL',
    effectiveDate: new Date('2025-01-01'),
  },
  {
    baselineName: 'IT-Dev-Senior-US-Market-2024',
    baselineType: 'MARKET_BENCHMARK',
    role: 'Developer',
    seniority: 'SENIOR',
    country: 'US',
    categoryL1: 'Professional Services',
    categoryL2: 'IT Professional Services',
    dailyRateUSD: 950,
    currency: 'USD',
    tolerancePercentage: 15,
    source: 'MARKET_RESEARCH',
    sourceDetails: 'Gartner 2024 IT Services Benchmark',
    effectiveDate: new Date('2024-01-01'),
  },
  {
    baselineName: 'IT-Dev-Senior-US-Historical-Best',
    baselineType: 'HISTORICAL_BEST',
    role: 'Developer',
    seniority: 'SENIOR',
    country: 'US',
    categoryL1: 'Professional Services',
    categoryL2: 'IT Professional Services',
    dailyRateUSD: 750,
    currency: 'USD',
    source: 'HISTORICAL_DATA',
    sourceDetails: 'Best rate achieved Q2 2024',
    effectiveDate: new Date('2024-04-01'),
  },
  {
    baselineName: 'Consulting-Senior-US-Target-2025',
    baselineType: 'TARGET_RATE',
    role: 'Consultant',
    seniority: 'SENIOR',
    country: 'US',
    categoryL1: 'Professional Services',
    categoryL2: 'Business Consulting',
    dailyRateUSD: 1200,
    currency: 'USD',
    minimumRate: 1000,
    maximumRate: 1400,
    tolerancePercentage: 10,
    source: 'INTERNAL',
    effectiveDate: new Date('2025-01-01'),
  },
  {
    baselineName: 'DataScientist-Senior-US-Market-2024',
    baselineType: 'MARKET_BENCHMARK',
    role: 'Data Scientist',
    seniority: 'SENIOR',
    country: 'US',
    categoryL1: 'Professional Services',
    categoryL2: 'IT Professional Services',
    dailyRateUSD: 1100,
    currency: 'USD',
    source: 'MARKET_RESEARCH',
    effectiveDate: new Date('2024-01-01'),
  },
];

async function testBaselineImport() {
  console.log('\n📥 TEST 1: Import Baselines\n');
  
  const service = new BaselineManagementService(prisma);
  
  const result = await service.importBaselines('demo', SAMPLE_BASELINES, {
    updateExisting: true,
    autoApprove: true, // Auto-approve for testing
  });
  
  console.log('✅ Import Results:');
  console.log(`   Imported: ${result.imported}`);
  console.log(`   Updated:  ${result.updated}`);
  console.log(`   Failed:   ${result.failed}`);
  
  if (result.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    result.errors.forEach(err => {
      console.log(`   Row ${err.row}: ${err.error}`);
    });
  }
  
  return result;
}

async function testBaselineStatistics() {
  console.log('\n📊 TEST 2: Baseline Statistics\n');
  
  const service = new BaselineManagementService(prisma);
  const stats = await service.getBaselineStatistics('demo');
  
  console.log('✅ Statistics:');
  console.log(`   Total Baselines:  ${stats.totalBaselines}`);
  console.log(`   Active Baselines: ${stats.activeBaselines}`);
  
  console.log('\n   By Type:');
  stats.byType.forEach(type => {
    console.log(`     ${type.type}: ${type.count} baselines (avg: $${type.avgRate.toFixed(2)}/day)`);
  });
  
  if (stats.byCategory.length > 0) {
    console.log('\n   By Category:');
    stats.byCategory.forEach(cat => {
      console.log(`     ${cat.category}: ${cat.count} baselines`);
    });
  }
  
  return stats;
}

async function testBulkComparison() {
  console.log('\n📈 TEST 3: Bulk Comparison Against Baselines\n');
  
  const service = new BaselineManagementService(prisma);
  const result = await service.bulkCompareAgainstBaselines('demo', {
    minVariancePercentage: 5,
  });
  
  console.log('✅ Bulk Comparison Results:');
  console.log(`   Total Rate Cards:     ${result.totalEntries}`);
  console.log(`   With Baselines:       ${result.entriesWithMatches}`);
  console.log(`   Total Savings Opp:    $${result.totalSavingsOpportunity.toFixed(2)}/day`);
  
  if (result.comparisons.length > 0) {
    const annualSavings = result.totalSavingsOpportunity * 220; // 220 working days
    console.log(`   Annual Savings Est:   $${annualSavings.toFixed(2)}`);
    
    console.log('\n   Top 5 Savings Opportunities:\n');
    
    result.comparisons.slice(0, 5).forEach((entry, idx) => {
      console.log(`   ${idx + 1}. ${entry.resourceType || entry.lineOfService || 'Unknown Role'}`);
      console.log(`      Actual Rate: $${entry.actualRate.toFixed(2)}/day`);
      console.log(`      Max Savings: $${entry.maxSavings.toFixed(2)}/day`);
      
      entry.comparisons.forEach(comp => {
        if (comp.potentialSavings > 0) {
          console.log(`        vs ${comp.baselineType}: ${comp.variancePercentage.toFixed(1)}% above ($${comp.baselineRate}/day baseline)`);
        }
      });
      console.log('');
    });
  } else {
    console.log('\n   ⚠️  No rate cards found with significant deviations from baselines');
  }
  
  return result;
}

async function testSingleComparison() {
  console.log('\n🔍 TEST 4: Single Rate Card Comparison\n');
  
  const service = new BaselineManagementService(prisma);
  
  // Find a rate card entry
  const rateCard = await prisma.rateCardEntry.findFirst({
    where: { tenantId: 'demo' },
  });
  
  if (!rateCard) {
    console.log('⚠️  No rate cards found in database');
    return null;
  }
  
  console.log(`Testing Rate Card: ${rateCard.resourceType || rateCard.lineOfService || 'Unknown'}`);
  console.log(`Actual Rate: $${Number(rateCard.dailyRateUSD).toFixed(2)}/day`);
  
  const comparisons = await service.compareAgainstBaselines(rateCard.id);
  
  if (comparisons.length === 0) {
    console.log('\n⚠️  No matching baselines found for this rate card');
    return null;
  }
  
  console.log(`\n✅ Found ${comparisons.length} matching baselines:\n`);
  
  comparisons.forEach(comp => {
    console.log(`   ${comp.baselineName}`);
    console.log(`     Type:      ${comp.baselineType}`);
    console.log(`     Baseline:  $${comp.baselineRate.toFixed(2)}/day`);
    console.log(`     Variance:  $${comp.variance.toFixed(2)} (${comp.variancePercentage.toFixed(1)}%)`);
    console.log(`     Status:    ${comp.status}`);
    console.log(`     Tolerance: ${comp.isWithinTolerance ? 'WITHIN' : 'OUTSIDE'}`);
    if (comp.potentialSavings > 0) {
      console.log(`     💰 Savings: $${comp.potentialSavings.toFixed(2)}/day`);
    }
    console.log('');
  });
  
  return comparisons;
}

async function main() {
  console.log('🚀 Baseline System End-to-End Test\n');
  console.log('=' .repeat(70));
  
  try {
    // Test 1: Import baselines
    await testBaselineImport();
    
    // Test 2: Get statistics
    await testBaselineStatistics();
    
    // Test 3: Bulk comparison
    await testBulkComparison();
    
    // Test 4: Single comparison
    await testSingleComparison();
    
    console.log('\n' + '=' .repeat(70));
    console.log('✅ All tests completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
