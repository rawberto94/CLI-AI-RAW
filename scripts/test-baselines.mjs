/**
 * Test Baseline Management System
 * 
 * Tests baseline import, comparison, and savings calculations
 */

import BaselineManagementService from '../packages/data-orchestration/src/services/baseline-management.service.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Sample baseline data for import
const SAMPLE_BASELINES = [
  // IT Professional Services - Target rates
  {
    role: 'Software Developer',
    seniority: 'Senior',
    country: 'US',
    dailyRateUSD: 800,
    baselineType: 'TARGET',
    confidence: 0.9,
    notes: 'Target rate for FY2025',
  },
  {
    role: 'Software Developer',
    seniority: 'Mid-Level',
    country: 'US',
    dailyRateUSD: 600,
    baselineType: 'TARGET',
    confidence: 0.9,
    notes: 'Target rate for FY2025',
  },
  {
    role: 'Software Developer',
    seniority: 'Junior',
    country: 'US',
    dailyRateUSD: 400,
    baselineType: 'TARGET',
    confidence: 0.9,
    notes: 'Target rate for FY2025',
  },
  
  // Historical best rates
  {
    role: 'Software Developer',
    seniority: 'Senior',
    country: 'US',
    dailyRateUSD: 750,
    baselineType: 'HISTORICAL_BEST',
    confidence: 1.0,
    notes: 'Best rate achieved in Q2 2024',
  },
  {
    role: 'Business Consultant',
    seniority: 'Senior',
    country: 'US',
    dailyRateUSD: 1200,
    baselineType: 'HISTORICAL_BEST',
    confidence: 1.0,
    notes: 'Best consulting rate 2024',
  },
  
  // Industry average rates
  {
    role: 'Software Developer',
    seniority: 'Senior',
    country: 'US',
    dailyRateUSD: 900,
    baselineType: 'INDUSTRY_AVERAGE',
    confidence: 0.7,
    notes: 'Gartner industry benchmark 2024',
  },
  {
    role: 'Data Scientist',
    seniority: 'Senior',
    country: 'US',
    dailyRateUSD: 1000,
    baselineType: 'INDUSTRY_AVERAGE',
    confidence: 0.7,
    notes: 'Market average for data science',
  },
];

async function testBaselineImport() {
  console.log('\n📥 TEST 1: Baseline Import\n');
  
  const service = new BaselineManagementService(prisma);
  
  try {
    const result = await service.importBaselines('demo', SAMPLE_BASELINES, {
      updateExisting: true,
    });
    
    console.log('✅ Import Result:');
    console.log(`   Imported: ${result.imported}`);
    console.log(`   Updated:  ${result.updated}`);
    console.log(`   Failed:   ${result.failed}`);
    console.log(`   Baseline IDs: ${result.baselineIds.length}`);
    
    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.forEach(err => {
        console.log(`   Row ${err.row}: ${err.error}`);
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  }
}

async function testBaselineStatistics() {
  console.log('\n📊 TEST 2: Baseline Statistics\n');
  
  const service = new BaselineManagementService(prisma);
  
  try {
    const stats = await service.getBaselineStatistics('demo');
    
    console.log('✅ Statistics:');
    console.log(`   Total Baselines:  ${stats.totalBaselines}`);
    console.log(`   Active Baselines: ${stats.activeBaselines}`);
    console.log('\n   By Type:');
    stats.byType.forEach(type => {
      console.log(`     ${type.type}: ${type.count} (avg: $${type.avgRate.toFixed(2)}/day)`);
    });
    
    return stats;
  } catch (error) {
    console.error('❌ Statistics failed:', error);
    throw error;
  }
}

async function testSingleComparison() {
  console.log('\n🔍 TEST 3: Single Rate Comparison\n');
  
  const service = new BaselineManagementService(prisma);
  
  try {
    // Find a rate card entry with baselines
    const entryWithBaseline = await prisma.rateCardEntry.findFirst({
      where: {
        tenantId: 'demo',
        baselineRates: {
          some: { status: 'ACTIVE' },
        },
      },
      include: {
        baselineRates: {
          where: { status: 'ACTIVE' },
        },
      },
    });
    
    if (!entryWithBaseline) {
      console.log('⚠️  No rate card entries with baselines found');
      return null;
    }
    
    console.log(`Testing: ${entryWithBaseline.role} (${entryWithBaseline.seniority})`);
    console.log(`Actual Rate: $${entryWithBaseline.dailyRateUSD}/day`);
    
    const comparisons = await service.compareAgainstBaselines(entryWithBaseline.id);
    
    console.log(`\n✅ Comparisons (${comparisons.length} baselines):\n`);
    
    comparisons.forEach(comp => {
      console.log(`   ${comp.baselineType}:`);
      console.log(`     Baseline: $${comp.baselineRate.toFixed(2)}/day`);
      console.log(`     Deviation: $${comp.deviation.toFixed(2)} (${comp.deviationPercentage.toFixed(1)}%)`);
      console.log(`     Status: ${comp.status}`);
      if (comp.savingsOpportunity > 0) {
        console.log(`     💰 Savings: $${comp.savingsOpportunity.toFixed(2)}/day`);
      }
      console.log('');
    });
    
    return comparisons;
  } catch (error) {
    console.error('❌ Comparison failed:', error);
    throw error;
  }
}

async function testBulkComparison() {
  console.log('\n📈 TEST 4: Bulk Baseline Comparison\n');
  
  const service = new BaselineManagementService(prisma);
  
  try {
    const result = await service.bulkCompareAgainstBaselines('demo', {
      minDeviationPercentage: 5,
    });
    
    console.log('✅ Bulk Comparison Results:');
    console.log(`   Total Entries:        ${result.totalEntries}`);
    console.log(`   With Baselines:       ${result.entriesWithBaselines}`);
    console.log(`   Total Savings Opp:    $${result.totalSavingsOpportunity.toFixed(2)}/day`);
    
    if (result.comparisons.length > 0) {
      console.log('\n   Top 5 Savings Opportunities:\n');
      
      result.comparisons.slice(0, 5).forEach((entry, idx) => {
        console.log(`   ${idx + 1}. ${entry.role} (${entry.seniority})`);
        console.log(`      Actual Rate: $${entry.actualRate.toFixed(2)}/day`);
        console.log(`      Max Savings: $${entry.maxSavings.toFixed(2)}/day`);
        
        entry.comparisons.forEach(comp => {
          if (comp.savingsOpportunity > 0) {
            console.log(`        vs ${comp.baselineType}: ${comp.deviationPercentage.toFixed(1)}% above`);
          }
        });
        console.log('');
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Bulk comparison failed:', error);
    throw error;
  }
}

async function testBaselineArchival() {
  console.log('\n🗄️  TEST 5: Archive Old Baselines\n');
  
  const service = new BaselineManagementService(prisma);
  
  try {
    // Archive baselines older than 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const result = await service.archiveOldBaselines('demo', oneYearAgo);
    
    console.log(`✅ Archived ${result.archived} old baselines`);
    
    return result;
  } catch (error) {
    console.error('❌ Archival failed:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting Baseline Management System Tests\n');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Import baselines
    await testBaselineImport();
    
    // Test 2: Get statistics
    await testBaselineStatistics();
    
    // Test 3: Single comparison
    await testSingleComparison();
    
    // Test 4: Bulk comparison
    await testBulkComparison();
    
    // Test 5: Archival
    await testBaselineArchival();
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ All tests completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
