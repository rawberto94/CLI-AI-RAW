/**
 * Test Script for Procurement Intelligence System
 * 
 * This script tests all data providers and API endpoints
 */

import { getDataProviderFactory } from '../packages/data-orchestration/src/providers/data-provider-factory';
import { DataMode } from '../packages/data-orchestration/src/types/data-provider.types';

async function testProviders() {
  console.log('🧪 Testing Procurement Intelligence Providers\n');
  
  const factory = getDataProviderFactory();
  
  // Test 1: Health Check
  console.log('1️⃣  Testing Provider Health...');
  try {
    const health = await factory.checkAllProviders();
    console.log('✅ Health Check Results:');
    console.log(JSON.stringify(health, null, 2));
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
  
  console.log('\n---\n');
  
  // Test 2: Rate Benchmarking (Mock Mode)
  console.log('2️⃣  Testing Rate Benchmarking (Mock Mode)...');
  try {
    const response = await factory.getData('rate-benchmarking', {
      lineOfService: 'Software Development',
      seniority: 'Senior',
      geography: 'North America - West Coast'
    }, DataMode.MOCK);
    
    console.log('✅ Rate Benchmarking Response:');
    console.log(`   Mode: ${response.metadata.mode}`);
    console.log(`   Source: ${response.metadata.source}`);
    console.log(`   Average Rate: $${response.data.marketRates.average}/hr`);
    console.log(`   Sample Size: ${response.data.marketRates.count}`);
    console.log(`   Trends: ${response.data.trends.length} periods`);
  } catch (error) {
    console.error('❌ Rate benchmarking test failed:', error);
  }
  
  console.log('\n---\n');
  
  // Test 3: Supplier Analytics (Mock Mode)
  console.log('3️⃣  Testing Supplier Analytics (Mock Mode)...');
  try {
    const response = await factory.getData('supplier-analytics', {
      supplierId: 'SUP001',
      timeframe: '12months'
    }, DataMode.MOCK);
    
    console.log('✅ Supplier Analytics Response:');
    console.log(`   Mode: ${response.metadata.mode}`);
    console.log(`   Delivery Score: ${response.data.performance.deliveryScore}%`);
    console.log(`   Quality Score: ${response.data.performance.qualityScore}%`);
    console.log(`   Risk Score: ${response.data.performance.riskScore}%`);
    console.log(`   Contract Count: ${response.data.relationships.contractCount}`);
  } catch (error) {
    console.error('❌ Supplier analytics test failed:', error);
  }
  
  console.log('\n---\n');
  
  // Test 4: Negotiation Prep (Mock Mode)
  console.log('4️⃣  Testing Negotiation Prep (Mock Mode)...');
  try {
    const response = await factory.getData('negotiation-prep', {
      contractId: 'CNT001',
      category: 'Software Development'
    }, DataMode.MOCK);
    
    console.log('✅ Negotiation Prep Response:');
    console.log(`   Mode: ${response.metadata.mode}`);
    console.log(`   Leverage Points: ${response.data.leveragePoints.length}`);
    console.log(`   Recommendations: ${response.data.recommendations.length}`);
    console.log(`   Market Position: Rank ${response.data.marketPosition.supplierRank} of ${response.data.marketPosition.totalSuppliers}`);
  } catch (error) {
    console.error('❌ Negotiation prep test failed:', error);
  }
  
  console.log('\n---\n');
  
  // Test 5: Savings Pipeline (Mock Mode)
  console.log('5️⃣  Testing Savings Pipeline (Mock Mode)...');
  try {
    const response = await factory.getData('savings-pipeline', {
      timeframe: '12months'
    }, DataMode.MOCK);
    
    console.log('✅ Savings Pipeline Response:');
    console.log(`   Mode: ${response.metadata.mode}`);
    console.log(`   Opportunities: ${response.data.opportunities.length}`);
    console.log(`   Total Pipeline: $${response.data.pipeline.total.toLocaleString()}`);
    console.log(`   Trends: ${response.data.trends.length} periods`);
  } catch (error) {
    console.error('❌ Savings pipeline test failed:', error);
  }
  
  console.log('\n---\n');
  
  // Test 6: Renewal Radar (Mock Mode)
  console.log('6️⃣  Testing Renewal Radar (Mock Mode)...');
  try {
    const response = await factory.getData('renewal-radar', {
      timeframe: '3months',
      riskLevel: 'high'
    }, DataMode.MOCK);
    
    console.log('✅ Renewal Radar Response:');
    console.log(`   Mode: ${response.metadata.mode}`);
    console.log(`   Upcoming Renewals: ${response.data.upcomingRenewals.length}`);
    console.log(`   Total Contracts: ${response.data.riskAnalysis.totalContracts}`);
    console.log(`   Total Value: $${response.data.riskAnalysis.totalValue.toLocaleString()}`);
    console.log(`   Action Items: ${response.data.actionItems.length}`);
  } catch (error) {
    console.error('❌ Renewal radar test failed:', error);
  }
  
  console.log('\n---\n');
  
  // Test 7: Fallback Behavior
  console.log('7️⃣  Testing Fallback Behavior...');
  try {
    // This should fallback to mock if real is unavailable
    const response = await factory.getData('rate-benchmarking', {
      lineOfService: 'Software Development'
    }, DataMode.REAL);
    
    console.log('✅ Fallback Test:');
    console.log(`   Requested Mode: REAL`);
    console.log(`   Actual Mode: ${response.metadata.mode}`);
    console.log(`   Source: ${response.metadata.source}`);
  } catch (error) {
    console.error('❌ Fallback test failed:', error);
  }
  
  console.log('\n✨ All tests completed!\n');
}

// Run tests
testProviders().catch(console.error);
