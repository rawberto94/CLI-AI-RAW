#!/usr/bin/env node

/**
 * End-to-end test for rate card benchmarking system
 * 
 * This script:
 * 1. Creates test rate cards in the database
 * 2. Calls the benchmarking API
 * 3. Verifies the results
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_TENANT_ID = 'test-tenant-benchmarking';

async function cleanup() {
  console.log('🧹 Cleaning up test data...');
  
  // Delete in correct order due to foreign keys
  await prisma.rateSavingsOpportunity.deleteMany({ where: { rateCard: { tenantId: TEST_TENANT_ID } } });
  await prisma.benchmarkSnapshot.deleteMany({ where: { rateCard: { tenantId: TEST_TENANT_ID } } });
  await prisma.rateCardEntry.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  await prisma.rateCardSupplier.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  
  console.log('✅ Cleanup complete');
}

async function createTestData() {
  console.log('📝 Creating test data...');
  
  // Create test suppliers
  const supplier1 = await prisma.rateCardSupplier.create({
    data: {
      tenantId: TEST_TENANT_ID,
      name: 'Premium Consulting Inc',
      country: 'United States',
      tier: 'TIER_1',
      totalContracts: 5,
      averageRating: 4.5,
    },
  });

  const supplier2 = await prisma.rateCardSupplier.create({
    data: {
      tenantId: TEST_TENANT_ID,
      name: 'Budget Solutions Ltd',
      country: 'United States',
      tier: 'TIER_2',
      totalContracts: 3,
      averageRating: 3.8,
    },
  });

  const supplier3 = await prisma.rateCardSupplier.create({
    data: {
      tenantId: TEST_TENANT_ID,
      name: 'Global Tech Partners',
      country: 'United States',
      tier: 'TIER_1',
      totalContracts: 7,
      averageRating: 4.2,
    },
  });

  console.log('✅ Created 3 suppliers');

  // Create test rate cards with varying rates
  const rateCards = [];
  
  // Senior Java Developer rates from different suppliers
  const seniorJavaRates = [
    { supplier: supplier1, rate: 1200, name: 'Premium Senior Java Dev' },
    { supplier: supplier2, rate: 800, name: 'Budget Senior Java Dev' },
    { supplier: supplier3, rate: 1000, name: 'Global Senior Java Dev' },
    { supplier: supplier1, rate: 1300, name: 'Premium Senior Java Dev 2' },
    { supplier: supplier2, rate: 750, name: 'Budget Senior Java Dev 2' },
  ];

  for (const data of seniorJavaRates) {
    const rateCard = await prisma.rateCardEntry.create({
      data: {
        tenantId: TEST_TENANT_ID,
        supplierId: data.supplier.id,
        roleStandard: 'Java Developer',
        roleOriginal: data.name,
        seniority: 'Senior',
        lineOfService: 'Technology',
        category: 'Software Development',
        dailyRate: data.rate,
        currency: 'USD',
        country: 'United States',
        source: 'MANUAL',
        effectiveDate: new Date(),
      },
    });
    rateCards.push(rateCard);
  }

  console.log(`✅ Created ${rateCards.length} rate cards`);
  
  return rateCards;
}

async function testBenchmarking(rateCardId: string) {
  console.log(`\n🔍 Testing benchmark calculation for rate card: ${rateCardId}`);
  
  const response = await fetch(`http://localhost:3005/api/benchmarking/calculate/${rateCardId}`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Benchmark API failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`Benchmark failed: ${result.error}`);
  }

  console.log('\n📊 Benchmark Results:');
  console.log('─'.repeat(60));
  
  const { benchmark } = result.data;
  
  console.log(`\n📈 Statistics:`);
  console.log(`   Mean: $${benchmark.statistics.mean.toFixed(2)}`);
  console.log(`   Median: $${benchmark.statistics.median.toFixed(2)}`);
  console.log(`   P10: $${benchmark.statistics.p10.toFixed(2)}`);
  console.log(`   P25: $${benchmark.statistics.p25.toFixed(2)}`);
  console.log(`   P75: $${benchmark.statistics.p75.toFixed(2)}`);
  console.log(`   P90: $${benchmark.statistics.p90.toFixed(2)}`);
  console.log(`   Std Dev: $${benchmark.statistics.standardDeviation.toFixed(2)}`);
  console.log(`   Sample Size: ${benchmark.statistics.sampleSize}`);
  
  console.log(`\n🎯 Market Position:`);
  console.log(`   Position: ${benchmark.marketPosition.position}`);
  console.log(`   Percentile: ${benchmark.marketPosition.percentile.toFixed(1)}%`);
  console.log(`   Deviation from Median: $${benchmark.marketPosition.deviationFromMedian.toFixed(2)} (${benchmark.marketPosition.percentageDeviation.toFixed(1)}%)`);
  
  if (benchmark.savingsAnalysis) {
    console.log(`\n💰 Savings Analysis:`);
    console.log(`   To Median: $${Math.abs(benchmark.savingsAnalysis.savingsToMedian).toFixed(2)}`);
    console.log(`   To P25: $${Math.abs(benchmark.savingsAnalysis.savingsToP25).toFixed(2)}`);
    console.log(`   To P10: $${Math.abs(benchmark.savingsAnalysis.savingsToP10).toFixed(2)}`);
    console.log(`   Above Market: ${benchmark.savingsAnalysis.isAboveMarket ? 'Yes ⚠️' : 'No ✅'}`);
  }
  
  console.log('\n✅ Benchmark calculation successful!');
  
  return result.data;
}

async function testSavingsOpportunities(rateCardId: string) {
  console.log(`\n💡 Testing savings opportunities detection for: ${rateCardId}`);
  
  const response = await fetch(`http://localhost:3005/api/benchmarking/opportunities/${rateCardId}`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Opportunities API failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`Opportunities detection failed: ${result.error}`);
  }

  console.log(`\n🎯 Found ${result.data.length} opportunities:`);
  
  result.data.forEach((opp: any, index: number) => {
    console.log(`\n${index + 1}. ${opp.category}`);
    console.log(`   Potential Savings: $${opp.estimatedSavings?.toFixed(2) || 0}`);
    console.log(`   Confidence: ${(opp.confidence * 100).toFixed(0)}%`);
    console.log(`   Effort: ${opp.effortLevel}`);
    console.log(`   Risk: ${opp.riskLevel}`);
    console.log(`   Action: ${opp.recommendedAction}`);
    if (opp.alternativeSuppliers?.length > 0) {
      console.log(`   Alternative Suppliers: ${opp.alternativeSuppliers.join(', ')}`);
    }
  });
  
  console.log('\n✅ Opportunities detection successful!');
  
  return result.data;
}

async function testMarketIntelligence() {
  console.log(`\n🌍 Testing market intelligence...`);
  
  const response = await fetch(
    `http://localhost:3005/api/benchmarking/market?role=Java Developer&seniority=Senior&country=United States`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error(`Market intelligence API failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`Market intelligence failed: ${result.error}`);
  }

  const intel = result.data;
  
  console.log('\n📊 Market Intelligence for Senior Java Developer (US):');
  console.log('─'.repeat(60));
  console.log(`   Sample Size: ${intel.sampleSize}`);
  console.log(`   Average Rate: $${intel.averageRate.toFixed(2)}`);
  console.log(`   Median Rate: $${intel.medianRate.toFixed(2)}`);
  console.log(`   Rate Range: $${intel.rateRange.min.toFixed(2)} - $${intel.rateRange.max.toFixed(2)}`);
  console.log(`   Std Deviation: $${intel.standardDeviation.toFixed(2)}`);
  
  if (intel.topSuppliers?.length > 0) {
    console.log(`\n   Top Competitive Suppliers:`);
    intel.topSuppliers.forEach((s: any, i: number) => {
      console.log(`   ${i + 1}. ${s.name} - $${s.averageRate.toFixed(2)}`);
    });
  }
  
  if (intel.insights?.length > 0) {
    console.log(`\n   Market Insights:`);
    intel.insights.forEach((insight: string) => {
      console.log(`   • ${insight}`);
    });
  }
  
  console.log('\n✅ Market intelligence successful!');
  
  return intel;
}

async function testBulkBenchmarking() {
  console.log(`\n🚀 Testing bulk benchmarking...`);
  
  const response = await fetch(
    `http://localhost:3005/api/benchmarking/bulk`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: TEST_TENANT_ID }),
    }
  );

  if (!response.ok) {
    throw new Error(`Bulk benchmarking API failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(`Bulk benchmarking failed: ${result.error}`);
  }

  console.log('\n📊 Bulk Benchmarking Results:');
  console.log('─'.repeat(60));
  console.log(`   Total Processed: ${result.data.processed}`);
  console.log(`   Successful: ${result.data.successful}`);
  console.log(`   Failed: ${result.data.failed}`);
  console.log(`   Duration: ${result.data.duration}`);
  
  console.log('\n✅ Bulk benchmarking successful!');
  
  return result.data;
}

async function main() {
  console.log('🚀 Starting Rate Card Benchmarking E2E Test\n');
  console.log('═'.repeat(60));
  
  try {
    // Step 1: Cleanup
    await cleanup();
    
    // Step 2: Create test data
    const rateCards = await createTestData();
    
    // Wait for Next.js to be ready
    console.log('\n⏳ Waiting for Next.js server...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Test individual benchmark
    const highRateCard = rateCards.find(rc => rc.dailyRate === 1300);
    if (!highRateCard) throw new Error('High rate card not found');
    
    await testBenchmarking(highRateCard.id);
    
    // Step 4: Test savings opportunities
    await testSavingsOpportunities(highRateCard.id);
    
    // Step 5: Test market intelligence
    await testMarketIntelligence();
    
    // Step 6: Test bulk benchmarking
    await testBulkBenchmarking();
    
    console.log('\n═'.repeat(60));
    console.log('✅ All tests passed successfully!');
    console.log('═'.repeat(60));
    
    console.log('\n📝 Summary:');
    console.log(`   • Created ${rateCards.length} test rate cards`);
    console.log(`   • Calculated individual benchmarks`);
    console.log(`   • Detected savings opportunities`);
    console.log(`   • Generated market intelligence`);
    console.log(`   • Ran bulk benchmarking`);
    console.log('\n🎉 Rate card benchmarking system is fully functional!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
