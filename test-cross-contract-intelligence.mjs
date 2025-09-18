/**
 * Cross-Contract Intelligence System Test
 * Tests relationship mapping, pattern recognition, and portfolio insights
 */

import fetch from 'node-fetch';

console.log('🧠 TESTING CROSS-CONTRACT INTELLIGENCE SYSTEM');
console.log('==============================================');

const API_BASE = 'http://localhost:3001';
const TENANT_ID = 'test-tenant';

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  sampleContracts: 5,
  minSimilarity: 0.3
};

/**
 * Create sample contracts for testing
 */
async function createSampleContracts() {
  console.log('\n📄 Creating Sample Contracts for Testing...');
  
  const sampleContracts = [
    {
      filename: 'master-service-agreement.pdf',
      contentType: 'application/pdf',
      size: 1024000,
      metadata: {
        contractType: 'Master Service Agreement',
        vendor: 'TechCorp Solutions',
        totalValue: 500000,
        paymentTerms: 'Net 30',
        serviceType: 'IT Services'
      }
    },
    {
      filename: 'sow-web-development.pdf',
      contentType: 'application/pdf',
      size: 512000,
      metadata: {
        contractType: 'Statement of Work',
        vendor: 'TechCorp Solutions',
        totalValue: 75000,
        paymentTerms: 'Net 30',
        serviceType: 'Web Development'
      }
    },
    {
      filename: 'consulting-agreement.pdf',
      contentType: 'application/pdf',
      size: 768000,
      metadata: {
        contractType: 'Consulting Agreement',
        vendor: 'Strategic Advisors Inc',
        totalValue: 120000,
        paymentTerms: 'Net 15',
        serviceType: 'Business Consulting'
      }
    },
    {
      filename: 'software-license.pdf',
      contentType: 'application/pdf',
      size: 256000,
      metadata: {
        contractType: 'Software License',
        vendor: 'SoftwareCorp',
        totalValue: 50000,
        paymentTerms: 'Annual',
        serviceType: 'Software Licensing'
      }
    },
    {
      filename: 'maintenance-agreement.pdf',
      contentType: 'application/pdf',
      size: 384000,
      metadata: {
        contractType: 'Maintenance Agreement',
        vendor: 'TechCorp Solutions',
        totalValue: 25000,
        paymentTerms: 'Net 30',
        serviceType: 'IT Maintenance'
      }
    }
  ];
  
  const createdContracts = [];
  
  for (const [index, contractData] of sampleContracts.entries()) {
    try {
      console.log(`  Creating contract ${index + 1}: ${contractData.filename}`);
      
      // Initialize upload
      const initResponse = await fetch(`${API_BASE}/uploads/init-signed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': TENANT_ID
        },
        body: JSON.stringify(contractData)
      });
      
      if (!initResponse.ok) {
        throw new Error(`Init failed: ${initResponse.status}`);
      }
      
      const initData = await initResponse.json();
      
      // Finalize upload
      const finalizeResponse = await fetch(`${API_BASE}/uploads/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': TENANT_ID
        },
        body: JSON.stringify({
          docId: initData.docId,
          filename: contractData.filename,
          storagePath: initData.storagePath || `test/${initData.docId}`
        })
      });
      
      if (finalizeResponse.ok) {
        createdContracts.push({
          id: initData.docId,
          filename: contractData.filename,
          ...contractData.metadata
        });
        console.log(`    ✅ Created: ${initData.docId}`);
      } else {
        console.log(`    ❌ Failed to finalize: ${contractData.filename}`);
      }
      
    } catch (error) {
      console.log(`    ❌ Failed to create ${contractData.filename}: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Created ${createdContracts.length}/${sampleContracts.length} sample contracts`);
  return createdContracts;
}

/**
 * Test contract relationship analysis
 */
async function testContractRelationships(contracts) {
  console.log('\n🔗 Testing Contract Relationship Analysis...');
  
  if (contracts.length < 2) {
    console.log('  ⚠️ Need at least 2 contracts for relationship testing');
    return { success: false, error: 'Insufficient contracts' };
  }
  
  const results = [];
  
  for (const contract of contracts.slice(0, 3)) { // Test first 3 contracts
    try {
      console.log(`  Analyzing relationships for: ${contract.filename}`);
      
      const response = await fetch(`${API_BASE}/api/contracts/${contract.id}/relationships`, {
        headers: {
          'x-tenant-id': TENANT_ID
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        console.log(`    📊 Found ${data.totalRelationships} relationships`);
        console.log(`    🏷️ Relationship types: ${data.relationshipTypes.join(', ')}`);
        
        // Log specific relationships
        data.relationships.forEach((rel, index) => {
          console.log(`      ${index + 1}. ${rel.relationshipType} (strength: ${rel.strength.toFixed(2)})`);
          console.log(`         ${rel.description}`);
          console.log(`         Identified by: ${rel.identifiedBy.join(', ')}`);
        });
        
        results.push({
          contractId: contract.id,
          success: true,
          relationships: data.totalRelationships,
          types: data.relationshipTypes
        });
        
      } else {
        const errorData = await response.json();
        console.log(`    ❌ Failed: ${errorData.error}`);
        results.push({
          contractId: contract.id,
          success: false,
          error: errorData.error
        });
      }
      
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({
        contractId: contract.id,
        success: false,
        error: error.message
      });
    }
  }
  
  const successfulAnalyses = results.filter(r => r.success).length;
  console.log(`\n📈 Relationship Analysis: ${successfulAnalyses}/${results.length} successful`);
  
  return {
    success: successfulAnalyses > 0,
    results,
    totalRelationships: results.reduce((sum, r) => sum + (r.relationships || 0), 0)
  };
}

/**
 * Test pattern recognition
 */
async function testPatternRecognition() {
  console.log('\n🔍 Testing Pattern Recognition...');
  
  try {
    const response = await fetch(`${API_BASE}/api/portfolio/patterns`, {
      headers: {
        'x-tenant-id': TENANT_ID
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log(`  📊 Total patterns identified: ${data.totalPatterns}`);
      console.log(`  🏷️ Pattern types found: ${Object.keys(data.patternsByType).length}`);
      
      // Display pattern details
      Object.entries(data.patternsByType).forEach(([type, patterns]) => {
        console.log(`    ${type}: ${patterns.length} patterns`);
        patterns.slice(0, 2).forEach((pattern, index) => {
          console.log(`      ${index + 1}. ${pattern.name} (${pattern.frequency} contracts)`);
          console.log(`         Risk: ${pattern.riskLevel}, Confidence: ${pattern.confidence}`);
          console.log(`         Recommendations: ${pattern.recommendations.slice(0, 2).join('; ')}`);
        });
      });
      
      return {
        success: true,
        totalPatterns: data.totalPatterns,
        patternTypes: Object.keys(data.patternsByType),
        patterns: data.patterns
      };
      
    } else {
      const errorData = await response.json();
      console.log(`  ❌ Failed: ${errorData.error}`);
      return { success: false, error: errorData.error };
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test portfolio insights generation
 */
async function testPortfolioInsights() {
  console.log('\n💡 Testing Portfolio Insights Generation...');
  
  try {
    const response = await fetch(`${API_BASE}/api/portfolio/insights`, {
      headers: {
        'x-tenant-id': TENANT_ID
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log(`  📊 Total insights generated: ${data.totalInsights}`);
      console.log(`  💰 Potential savings: $${data.summary.potentialSavings?.toLocaleString() || 0}`);
      console.log(`  🛡️ Risk reduction: ${data.summary.riskReduction || 0}%`);
      
      console.log(`  📈 Impact distribution:`);
      console.log(`    High impact: ${data.summary.highImpactInsights}`);
      console.log(`    Medium impact: ${data.summary.mediumImpactInsights}`);
      console.log(`    Low impact: ${data.summary.lowImpactInsights}`);
      
      // Display top insights
      console.log(`  🔝 Top insights:`);
      data.insights.slice(0, 3).forEach((insight, index) => {
        console.log(`    ${index + 1}. ${insight.title} (${insight.impact} impact)`);
        console.log(`       ${insight.description}`);
        console.log(`       Confidence: ${insight.confidence}, Affected contracts: ${insight.affectedContracts.length}`);
        console.log(`       Recommendations: ${insight.recommendations.slice(0, 2).join('; ')}`);
      });
      
      return {
        success: true,
        totalInsights: data.totalInsights,
        potentialSavings: data.summary.potentialSavings,
        riskReduction: data.summary.riskReduction,
        insights: data.insights
      };
      
    } else {
      const errorData = await response.json();
      console.log(`  ❌ Failed: ${errorData.error}`);
      return { success: false, error: errorData.error };
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test similar contract finding
 */
async function testSimilarContracts(contracts) {
  console.log('\n🔍 Testing Similar Contract Finding...');
  
  if (contracts.length < 2) {
    console.log('  ⚠️ Need at least 2 contracts for similarity testing');
    return { success: false, error: 'Insufficient contracts' };
  }
  
  const testContract = contracts[0];
  
  try {
    console.log(`  Finding contracts similar to: ${testContract.filename}`);
    
    const response = await fetch(`${API_BASE}/api/contracts/${testContract.id}/similar?limit=5&minSimilarity=${TEST_CONFIG.minSimilarity}`, {
      headers: {
        'x-tenant-id': TENANT_ID
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log(`  📊 Found ${data.totalFound} similar contracts`);
      
      data.similarContracts.forEach((similar, index) => {
        console.log(`    ${index + 1}. Contract ${similar.contractId}`);
        console.log(`       Similarity: ${similar.similarity.toFixed(2)}`);
        console.log(`       Relationship: ${similar.relationshipType}`);
        console.log(`       Description: ${similar.description}`);
        console.log(`       Identified by: ${similar.identifiedBy.join(', ')}`);
      });
      
      return {
        success: true,
        totalFound: data.totalFound,
        similarContracts: data.similarContracts,
        searchCriteria: data.searchCriteria
      };
      
    } else {
      const errorData = await response.json();
      console.log(`  ❌ Failed: ${errorData.error}`);
      return { success: false, error: errorData.error };
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test portfolio analytics
 */
async function testPortfolioAnalytics() {
  console.log('\n📈 Testing Portfolio Analytics...');
  
  try {
    const response = await fetch(`${API_BASE}/api/portfolio/analytics`, {
      headers: {
        'x-tenant-id': TENANT_ID
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log(`  📊 Portfolio Overview:`);
      console.log(`    Total contracts: ${data.portfolio.totalContracts}`);
      console.log(`    Total value: $${data.portfolio.totalValue?.toLocaleString() || 0}`);
      console.log(`    Average value: $${data.portfolio.averageValue?.toLocaleString() || 0}`);
      
      console.log(`  📋 Contract status distribution:`);
      Object.entries(data.portfolio.contractsByStatus).forEach(([status, count]) => {
        console.log(`    ${status}: ${count}`);
      });
      
      console.log(`  🧠 Intelligence Summary:`);
      console.log(`    Total patterns: ${data.intelligence.totalPatterns}`);
      console.log(`    Total insights: ${data.intelligence.totalInsights}`);
      
      console.log(`  🔝 Top recommendations:`);
      data.recommendations.topInsights.forEach((insight, index) => {
        console.log(`    ${index + 1}. ${insight.title} (${insight.impact} impact, ${insight.confidence} confidence)`);
      });
      
      return {
        success: true,
        portfolio: data.portfolio,
        intelligence: data.intelligence,
        recommendations: data.recommendations
      };
      
    } else {
      const errorData = await response.json();
      console.log(`  ❌ Failed: ${errorData.error}`);
      return { success: false, error: errorData.error };
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test intelligence refresh
 */
async function testIntelligenceRefresh() {
  console.log('\n🔄 Testing Intelligence Refresh...');
  
  try {
    const response = await fetch(`${API_BASE}/api/portfolio/refresh-intelligence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': TENANT_ID
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      console.log(`  ✅ Intelligence refresh successful`);
      console.log(`  📊 Refreshed data:`);
      console.log(`    Patterns: ${data.refreshed.patterns}`);
      console.log(`    Insights: ${data.refreshed.insights}`);
      console.log(`    Relationships: ${data.refreshed.relationships}`);
      console.log(`    Contracts analyzed: ${data.refreshed.contracts}`);
      
      return {
        success: true,
        refreshed: data.refreshed,
        message: data.message
      };
      
    } else {
      const errorData = await response.json();
      console.log(`  ❌ Failed: ${errorData.error}`);
      return { success: false, error: errorData.error };
    }
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Run all cross-contract intelligence tests
 */
async function runAllTests() {
  const results = {
    contractCreation: null,
    relationships: null,
    patterns: null,
    insights: null,
    similarContracts: null,
    analytics: null,
    refresh: null
  };
  
  try {
    console.log('🚀 Starting Cross-Contract Intelligence Tests...\n');
    
    // Create sample contracts
    let contracts = [];
    try {
      contracts = await createSampleContracts();
      results.contractCreation = { 
        success: contracts.length > 0, 
        contractsCreated: contracts.length 
      };
    } catch (error) {
      console.error('❌ Contract creation failed:', error.message);
      results.contractCreation = { success: false, error: error.message };
    }
    
    // Wait for contracts to be processed
    if (contracts.length > 0) {
      console.log('\n⏳ Waiting for contract processing...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Test relationship analysis
    try {
      results.relationships = await testContractRelationships(contracts);
      console.log('✅ Relationship analysis test completed');
    } catch (error) {
      console.error('❌ Relationship analysis test failed:', error.message);
      results.relationships = { success: false, error: error.message };
    }
    
    // Test pattern recognition
    try {
      results.patterns = await testPatternRecognition();
      console.log('✅ Pattern recognition test completed');
    } catch (error) {
      console.error('❌ Pattern recognition test failed:', error.message);
      results.patterns = { success: false, error: error.message };
    }
    
    // Test portfolio insights
    try {
      results.insights = await testPortfolioInsights();
      console.log('✅ Portfolio insights test completed');
    } catch (error) {
      console.error('❌ Portfolio insights test failed:', error.message);
      results.insights = { success: false, error: error.message };
    }
    
    // Test similar contracts
    try {
      results.similarContracts = await testSimilarContracts(contracts);
      console.log('✅ Similar contracts test completed');
    } catch (error) {
      console.error('❌ Similar contracts test failed:', error.message);
      results.similarContracts = { success: false, error: error.message };
    }
    
    // Test portfolio analytics
    try {
      results.analytics = await testPortfolioAnalytics();
      console.log('✅ Portfolio analytics test completed');
    } catch (error) {
      console.error('❌ Portfolio analytics test failed:', error.message);
      results.analytics = { success: false, error: error.message };
    }
    
    // Test intelligence refresh
    try {
      results.refresh = await testIntelligenceRefresh();
      console.log('✅ Intelligence refresh test completed');
    } catch (error) {
      console.error('❌ Intelligence refresh test failed:', error.message);
      results.refresh = { success: false, error: error.message };
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
  
  // Print final results
  console.log('\n📋 FINAL CROSS-CONTRACT INTELLIGENCE TEST RESULTS');
  console.log('=================================================');
  
  const testResults = [
    { name: 'Contract Creation', result: results.contractCreation },
    { name: 'Relationship Analysis', result: results.relationships },
    { name: 'Pattern Recognition', result: results.patterns },
    { name: 'Portfolio Insights', result: results.insights },
    { name: 'Similar Contracts', result: results.similarContracts },
    { name: 'Portfolio Analytics', result: results.analytics },
    { name: 'Intelligence Refresh', result: results.refresh }
  ];
  
  testResults.forEach(({ name, result }) => {
    const status = result?.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${name}`);
    if (!result?.success && result?.error) {
      console.log(`    Error: ${result.error}`);
    }
  });
  
  const passedTests = testResults.filter(t => t.result?.success).length;
  const totalTests = testResults.length;
  
  console.log(`\n📊 Test Summary: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All cross-contract intelligence tests passed!');
    console.log('\n✨ Cross-contract intelligence system is working correctly!');
  } else {
    console.log('⚠️ Some tests failed. The intelligence system may need attention.');
  }
  
  // Detailed summary
  console.log('\n📈 DETAILED INTELLIGENCE RESULTS');
  console.log('================================');
  
  if (results.contractCreation?.success) {
    console.log(`📄 Contracts: ${results.contractCreation.contractsCreated} created for testing`);
  }
  
  if (results.relationships?.success) {
    console.log(`🔗 Relationships: ${results.relationships.totalRelationships} relationships identified`);
  }
  
  if (results.patterns?.success) {
    console.log(`🔍 Patterns: ${results.patterns.totalPatterns} patterns found across ${results.patterns.patternTypes.length} types`);
  }
  
  if (results.insights?.success) {
    console.log(`💡 Insights: ${results.insights.totalInsights} insights generated`);
    if (results.insights.potentialSavings) {
      console.log(`💰 Potential Savings: $${results.insights.potentialSavings.toLocaleString()}`);
    }
  }
  
  if (results.similarContracts?.success) {
    console.log(`🔍 Similar Contracts: ${results.similarContracts.totalFound} similar contracts found`);
  }
  
  return results;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { 
  runAllTests, 
  createSampleContracts,
  testContractRelationships, 
  testPatternRecognition, 
  testPortfolioInsights,
  testSimilarContracts,
  testPortfolioAnalytics,
  testIntelligenceRefresh
};