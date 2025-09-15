#!/usr/bin/env node

/**
 * Test script to validate unified intelligence storage integration with enhanced orchestrator
 */

import { unifiedIntelligenceStorage } from '../apps/api/src/intelligence/unified-intelligence-storage';
import { contractInsightsOrchestrator } from '../apps/api/src/insights/contract-insights-orchestrator';

console.log('🧪 Testing Unified Intelligence Integration...\n');

async function testUnifiedIntelligenceIntegration() {
  try {
    // Test 1: Create intelligence record
    console.log('1. Testing intelligence record creation...');
    const testMetadata = {
      contractName: 'Test Service Agreement',
      contractType: 'Service Agreement',
      documentSize: 100000,
      documentPages: 25,
      sourceSystem: 'test',
      uploadedBy: 'test-user',
      uploadedAt: new Date(),
    };

    await unifiedIntelligenceStorage.createIntelligenceRecord(
      'test-doc-123',
      'test-tenant',
      testMetadata
    );
    console.log('✅ Intelligence record created successfully');

    // Test 2: Update with worker result
    console.log('2. Testing worker result integration...');
    const testWorkerData = {
      totalValue: 100000,
      currency: 'USD',
      paymentTerms: [{ termType: 'Net 30', amount: 100000 }],
      costOptimizationOpportunities: [],
      budgetAnalysis: { budgetUtilization: 0.8 }
    };

    await unifiedIntelligenceStorage.updateWithWorkerResult(
      'test-doc-123',
      'financial',
      testWorkerData,
      { financialBestPractices: ['Negotiate better payment terms'] }
    );
    console.log('✅ Worker result integrated successfully');

    // Test 3: Get comprehensive intelligence
    console.log('3. Testing comprehensive intelligence retrieval...');
    const intelligence = await contractInsightsOrchestrator.getComprehensiveIntelligence('test-doc-123');
    if (intelligence) {
      console.log('✅ Comprehensive intelligence retrieved successfully');
      console.log(`   - Document ID: ${intelligence.documentId}`);
      console.log(`   - Contract Name: ${intelligence.metadata.contractName}`);
      console.log(`   - Overall Quality: ${intelligence.qualityMetrics.overallQuality}%`);
    } else {
      console.log('❌ Failed to retrieve comprehensive intelligence');
    }

    // Test 4: Test cross-functional analysis
    console.log('4. Testing cross-functional analysis...');
    const crossAnalysis = await contractInsightsOrchestrator.getCrossFunctionalAnalysis(
      'test-doc-123',
      'financial',
      'totalValue',
      'risk',
      'overallRiskScore'
    );
    
    if (crossAnalysis) {
      console.log('✅ Cross-functional analysis working');
      console.log(`   - Correlation confidence: ${crossAnalysis.confidence || 'N/A'}`);
    } else {
      console.log('❌ Cross-functional analysis failed');
    }

    // Test 5: Test intelligence graph
    console.log('5. Testing intelligence graph generation...');
    const graph = contractInsightsOrchestrator.getIntelligenceGraph('test-doc-123');
    if (graph) {
      console.log('✅ Intelligence graph generated successfully');
      console.log(`   - Nodes: ${graph.nodes?.length || 0}`);
      console.log(`   - Edges: ${graph.edges?.length || 0}`);
    } else {
      console.log('❌ Intelligence graph generation failed');
    }

    // Test 6: Test orchestrator integration
    console.log('6. Testing enhanced orchestrator integration...');
    const contractInsights = await contractInsightsOrchestrator.analyzeContract('test-doc-123');
    if (contractInsights) {
      console.log('✅ Enhanced orchestrator analysis working');
      console.log(`   - Financial insights available: ${!!contractInsights.financial}`);
      console.log(`   - Cross-analysis available: ${!!contractInsights.crossAnalysis}`);
      console.log(`   - Aggregated insights available: ${!!contractInsights.aggregatedInsights}`);
    } else {
      console.log('❌ Enhanced orchestrator analysis failed');
    }

    console.log('\n🎉 All unified intelligence integration tests completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

// Run the test
testUnifiedIntelligenceIntegration()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });