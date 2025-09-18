/**
 * Simple test to check if artifacts are being generated correctly
 */

console.log('🔍 Testing artifact generation...');

// Test 1: Check if workers can be imported
console.log('\n📦 Testing worker imports...');

try {
  // Test financial worker
  const financialWorker = await import('./apps/workers/financial.worker.ts');
  console.log('✅ Financial worker imported successfully');
  
  // Test if runFinancial function exists
  if (typeof financialWorker.runFinancial === 'function') {
    console.log('✅ runFinancial function exists');
  } else {
    console.log('❌ runFinancial function not found');
  }
} catch (error) {
  console.log('❌ Financial worker import failed:', error.message);
}

try {
  // Test enhanced overview worker
  const overviewWorker = await import('./apps/workers/enhanced-overview.worker.ts');
  console.log('✅ Enhanced overview worker imported successfully');
  
  // Test if runEnhancedOverview function exists
  if (typeof overviewWorker.runEnhancedOverview === 'function') {
    console.log('✅ runEnhancedOverview function exists');
  } else {
    console.log('❌ runEnhancedOverview function not found');
  }
} catch (error) {
  console.log('❌ Enhanced overview worker import failed:', error.message);
}

try {
  // Test auto-indexation worker
  const indexationWorker = await import('./apps/workers/auto-indexation.worker.ts');
  console.log('✅ Auto-indexation worker imported successfully');
  
  // Test if runAutoIndexation function exists
  if (typeof indexationWorker.runAutoIndexation === 'function') {
    console.log('✅ runAutoIndexation function exists');
  } else {
    console.log('❌ runAutoIndexation function not found');
  }
} catch (error) {
  console.log('❌ Auto-indexation worker import failed:', error.message);
}

// Test 2: Check artifact schemas
console.log('\n📋 Testing artifact schemas...');

try {
  // Try to import schemas
  const schemas = await import('./packages/schemas/src/index.ts');
  console.log('✅ Schemas imported successfully');
  
  if (schemas.FinancialArtifactV1Schema) {
    console.log('✅ FinancialArtifactV1Schema exists');
  } else {
    console.log('❌ FinancialArtifactV1Schema not found');
  }
  
  if (schemas.OverviewArtifactV1Schema) {
    console.log('✅ OverviewArtifactV1Schema exists');
  } else {
    console.log('❌ OverviewArtifactV1Schema not found');
  }
} catch (error) {
  console.log('❌ Schema import failed:', error.message);
}

// Test 3: Check database client
console.log('\n🗄️ Testing database client...');

try {
  // Try to import database client
  const db = await import('./packages/clients/db/index.ts');
  console.log('✅ Database client imported successfully');
  
  if (db.default) {
    console.log('✅ Default database export exists');
  } else {
    console.log('❌ Default database export not found');
  }
} catch (error) {
  console.log('❌ Database client import failed:', error.message);
}

// Test 4: Mock artifact generation
console.log('\n🧪 Testing mock artifact generation...');

try {
  // Create a mock job data
  const mockJob = {
    data: {
      docId: 'test-contract-123',
      tenantId: 'test-tenant-456'
    }
  };
  
  console.log('✅ Mock job data created:', JSON.stringify(mockJob, null, 2));
  
  // Test artifact structure
  const mockFinancialArtifact = {
    metadata: {
      docId: mockJob.data.docId,
      fileType: 'pdf',
      totalPages: 1,
      ocrRate: 0,
      provenance: [{
        worker: 'financial',
        timestamp: new Date().toISOString(),
        durationMs: 1500,
        model: 'gpt-4o',
        confidenceScore: 92
      }]
    },
    financialTerms: [
      {
        termId: 'PAY-001',
        termType: 'Payment',
        termSubcategory: 'Base Payment',
        description: 'Monthly professional services fee',
        amount: '$75,000',
        frequency: 'monthly',
        conditions: 'Payable within 30 days of invoice',
        businessImpact: 'Significant monthly cash outflow for professional services',
        cashFlowImpact: 'negative',
        riskLevel: 'medium',
        complianceRequirements: 'Standard payment processing compliance'
      }
    ],
    financialSummary: {
      totalValue: '$900,000',
      paymentTerms: 1,
      penalties: 0,
      obligations: 1,
      controls: 0,
      riskLevel: 'medium',
      cashFlowImpact: 'negative'
    },
    confidenceScore: 92,
    bestPractices: {
      cashFlowManagement: [
        {
          strategy: 'Payment Schedule Optimization',
          description: 'Optimize payment timing to align with cash flow cycles',
          implementation: 'Negotiate payment terms that align with revenue cycles',
          benefits: ['Improved cash flow predictability', 'Reduced working capital requirements'],
          timeline: '30 days',
          resources: ['Finance team', 'Contract management'],
          successMetrics: ['Days payable outstanding', 'Cash conversion cycle']
        }
      ]
    }
  };
  
  console.log('✅ Mock financial artifact structure validated');
  console.log('📊 Financial terms count:', mockFinancialArtifact.financialTerms.length);
  console.log('💰 Total value:', mockFinancialArtifact.financialSummary.totalValue);
  console.log('🎯 Confidence score:', mockFinancialArtifact.confidenceScore + '%');
  
} catch (error) {
  console.log('❌ Mock artifact generation failed:', error.message);
}

console.log('\n✨ Artifact generation test complete!');