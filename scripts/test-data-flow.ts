/**
 * Test Data Flow Integration
 * 
 * This script tests the complete data flow from contract upload
 * through artifact generation to analytical engine processing
 */

import { unifiedOrchestrationService } from '../packages/data-orchestration/src/services/unified-orchestration.service';
import { analyticalSyncService } from '../packages/data-orchestration/src/services/analytical-sync.service';
import { eventBus, Events } from '../packages/data-orchestration/src/events/event-bus';
import pino from 'pino';

const logger = pino({ name: 'test-data-flow' });

async function testDataFlow() {
  console.log('\n🧪 Testing Complete Data Flow Integration\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Initialize orchestration
    console.log('\n📋 Step 1: Initialize Orchestration Service');
    await unifiedOrchestrationService.initialize();
    console.log('✅ Orchestration initialized');

    // Step 2: Check health
    console.log('\n📋 Step 2: Check System Health');
    const health = await unifiedOrchestrationService.healthCheck();
    console.log('Health Status:', health.status);
    console.log('Details:', JSON.stringify(health.details, null, 2));

    // Step 3: Test artifact sync
    console.log('\n📋 Step 3: Test Artifact Sync');
    const testArtifacts = [
      {
        type: 'OVERVIEW',
        content: JSON.stringify({
          summary: 'Test contract for IT services',
          parties: [
            { name: 'Acme Corp', role: 'client' },
            { name: 'Tech Solutions Inc', role: 'supplier' }
          ],
          contractType: 'Service Agreement',
          effectiveDate: '2024-01-01',
          expirationDate: '2025-12-31',
          jurisdiction: 'California',
          keyTerms: ['Payment terms', 'Deliverables', 'SLA']
        })
      },
      {
        type: 'FINANCIAL',
        content: JSON.stringify({
          totalValue: 500000,
          currency: 'USD',
          paymentTerms: ['Net 30', 'Monthly invoicing'],
          costBreakdown: [
            { category: 'Development', amount: 300000, description: 'Software development' },
            { category: 'Support', amount: 200000, description: 'Technical support' }
          ],
          discounts: []
        })
      },
      {
        type: 'RATES',
        content: JSON.stringify({
          rateCards: [
            { role: 'Senior Developer', rate: 150, unit: 'hour', currency: 'USD' },
            { role: 'Junior Developer', rate: 80, unit: 'hour', currency: 'USD' },
            { role: 'Project Manager', rate: 120, unit: 'hour', currency: 'USD' }
          ],
          roles: ['Senior Developer', 'Junior Developer', 'Project Manager'],
          locations: ['San Francisco, CA', 'New York, NY']
        })
      },
      {
        type: 'CLAUSES',
        content: JSON.stringify({
          clauses: [
            {
              id: 'clause-1',
              type: 'Payment',
              title: 'Payment Terms',
              content: 'Payment shall be made within 30 days of invoice',
              riskLevel: 'low',
              importance: 'high'
            },
            {
              id: 'clause-2',
              type: 'Termination',
              title: 'Termination Clause',
              content: 'Either party may terminate with 60 days notice',
              riskLevel: 'medium',
              importance: 'high'
            }
          ]
        })
      },
      {
        type: 'COMPLIANCE',
        content: JSON.stringify({
          regulations: ['GDPR', 'SOC 2'],
          complianceRequirements: [
            'Data encryption required',
            'Annual security audits',
            'Privacy policy compliance'
          ],
          certifications: ['ISO 27001', 'SOC 2 Type II']
        })
      },
      {
        type: 'RISK',
        content: JSON.stringify({
          overallScore: 65,
          riskFactors: [
            {
              category: 'Financial',
              severity: 'medium',
              description: 'Payment terms require close monitoring'
            },
            {
              category: 'Operational',
              severity: 'low',
              description: 'Standard termination clause'
            }
          ],
          recommendations: [
            'Review payment terms quarterly',
            'Ensure compliance with data protection requirements'
          ]
        })
      }
    ];

    const syncResult = await analyticalSyncService.syncArtifactsToAnalyticalEngines({
      contractId: 'test-contract-001',
      tenantId: 'test-tenant',
      artifacts: testArtifacts,
      userId: 'test-user'
    });

    console.log('Sync Result:', JSON.stringify(syncResult, null, 2));

    // Step 4: Test event emission
    console.log('\n📋 Step 4: Test Event Emission');
    let eventReceived = false;
    
    eventBus.on(Events.ARTIFACTS_GENERATED, (data: any) => {
      console.log('✅ ARTIFACTS_GENERATED event received!');
      console.log('Event data:', JSON.stringify(data, null, 2));
      eventReceived = true;
    });

    // Emit test event
    eventBus.emit(Events.ARTIFACTS_GENERATED, {
      contractId: 'test-contract-002',
      tenantId: 'test-tenant',
      userId: 'test-user',
      artifacts: testArtifacts,
      timestamp: new Date()
    });

    // Wait a bit for event processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (eventReceived) {
      console.log('✅ Event system working correctly');
    } else {
      console.log('⚠️  Event not received - check event bus configuration');
    }

    // Step 5: Get metrics
    console.log('\n📋 Step 5: Get Orchestration Metrics');
    const metrics = unifiedOrchestrationService.getMetrics();
    console.log('Metrics:', JSON.stringify(metrics, null, 2));

    // Step 6: Get configuration
    console.log('\n📋 Step 6: Get Orchestration Configuration');
    const config = unifiedOrchestrationService.getConfig();
    console.log('Configuration:', JSON.stringify(config, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('✅ Data Flow Test Complete!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   • Orchestration Status: ${health.status}`);
    console.log(`   • Artifacts Synced: ${syncResult.synced.rateCards + syncResult.synced.renewals + syncResult.synced.compliance + syncResult.synced.suppliers + syncResult.synced.spend}`);
    console.log(`   • Errors: ${syncResult.errors.length}`);
    console.log(`   • Processing Time: ${syncResult.processingTime}ms`);
    console.log(`   • Events Processed: ${metrics.totalEventsProcessed}`);
    console.log(`   • Analytical Syncs: ${metrics.analyticalSyncs}`);
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testDataFlow()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
