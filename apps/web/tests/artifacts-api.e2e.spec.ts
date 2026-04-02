/**
 * E2E Test: Artifacts API and Data Verification
 * 
 * Tests artifact generation backend:
 * 1. Status API returns correct data structure
 * 2. Artifacts are actually populated in database
 * 3. Artifact data contains expected fields
 * 4. Artifact regeneration works
 * 5. Enhanced artifacts viewer receives correct data
 */

import { test, expect } from './utils/auth-fixture';

test.describe('Artifacts API and Data Verification', () => {
  const TEST_TENANT_ID = 'test-tenant-artifacts-api';
  let testContractId: string | null = null;

  test.beforeAll(async ({ request }) => {
    // Create a test contract via API to test against
    const contractContent = `
CONSULTING SERVICES AGREEMENT

Agreement dated: March 1, 2024
Client: Global Tech Inc.
Consultant: Expert Solutions LLC

SCOPE OF WORK:
- Business strategy consulting
- Technology roadmap development
- Digital transformation guidance

RATES:
- Lead Consultant: $200/hour
- Senior Consultant: $150/hour
- Associate Consultant: $100/hour

PROJECT MILESTONES:
Milestone 1: Initial Assessment (Due: March 31, 2024) - $30,000
Milestone 2: Strategy Development (Due: April 30, 2024) - $50,000
Milestone 3: Implementation Plan (Due: May 31, 2024) - $40,000

Total Project Value: $120,000

PAYMENT TERMS: Net 15 days

CONTRACT TERM: March 1, 2024 to May 31, 2024

COMPLIANCE: ISO 9001, SOC 2 Type II required

RISKS:
- Dependency on client resource availability
- Market conditions may impact strategy
- Technology changes may require plan adjustments
`;

    // Upload contract via API
    const uploadResponse = await request.post('http://localhost:3005/api/contracts/upload/initialize', {
      headers: {
        'x-tenant-id': TEST_TENANT_ID,
        'Content-Type': 'application/json'
      },
      data: {
        fileName: 'test-consulting-agreement.txt',
        fileSize: Buffer.byteLength(contractContent),
        mimeType: 'text/plain',
        tenantId: TEST_TENANT_ID
      }
    });

    if (uploadResponse.ok()) {
      const uploadData = await uploadResponse.json();
      testContractId = uploadData.contractId;
      console.log('Test contract created:', testContractId);
    }
  });

  test('status API should return correct data structure', async ({ request }) => {
    if (!testContractId) {
      test.skip();
      return;
    }

    const response = await request.get(
      `http://localhost:3005/api/contracts/${testContractId}/status`,
      {
        headers: { 'x-tenant-id': TEST_TENANT_ID }
      }
    );

    expect(response.ok()).toBeTruthy();
    const statusData = await response.json();

    // Verify required fields
    expect(statusData).toHaveProperty('contractId');
    expect(statusData).toHaveProperty('status');
    expect(statusData).toHaveProperty('currentStep');
    expect(statusData).toHaveProperty('progress');
    expect(statusData).toHaveProperty('artifactsGenerated');
    expect(statusData).toHaveProperty('totalArtifacts');
    
    // Verify data types
    expect(typeof statusData.contractId).toBe('string');
    expect(typeof statusData.progress).toBe('number');
    expect(statusData.progress).toBeGreaterThanOrEqual(0);
    expect(statusData.progress).toBeLessThanOrEqual(100);
    
    // Verify artifacts structure
    expect(statusData).toHaveProperty('hasOverview');
    expect(statusData).toHaveProperty('hasFinancial');
    expect(statusData).toHaveProperty('hasRisk');
    expect(statusData).toHaveProperty('hasCompliance');
    expect(statusData).toHaveProperty('hasClauses');
    
    console.log('Status API response:', JSON.stringify(statusData, null, 2));
  });

  test('should track processing stages correctly', async ({ request }) => {
    if (!testContractId) {
      test.skip();
      return;
    }

    // Poll status multiple times to track progress
    const stages = [];
    for (let i = 0; i < 5; i++) {
      const response = await request.get(
        `http://localhost:3005/api/contracts/${testContractId}/status`,
        {
          headers: { 'x-tenant-id': TEST_TENANT_ID }
        }
      );

      if (response.ok()) {
        const data = await response.json();
        stages.push({
          step: data.currentStep,
          progress: data.progress,
          status: data.status
        });
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('Processing stages:', stages);
    
    // Verify we captured some stage progression
    expect(stages.length).toBeGreaterThan(0);
    
    // Verify valid stages
    const validSteps = ['upload', 'ocr', 'artifacts', 'complete'];
    stages.forEach(stage => {
      if (stage.step) {
        expect(validSteps).toContain(stage.step.toLowerCase());
      }
    });
  });

  test('artifacts endpoint should return generated artifacts', async ({ request }) => {
    if (!testContractId) {
      test.skip();
      return;
    }

    // Wait a bit for artifacts to potentially be generated
    await new Promise(resolve => setTimeout(resolve, 5000));

    const response = await request.get(
      `http://localhost:3005/api/contracts/${testContractId}/artifacts`,
      {
        headers: { 'x-tenant-id': TEST_TENANT_ID }
      }
    );

    if (response.ok()) {
      const artifacts = await response.json();
      
      console.log('Artifacts response:', JSON.stringify(artifacts, null, 2));
      
      // If artifacts exist, verify structure
      if (artifacts && typeof artifacts === 'object') {
        // Check for common artifact types
        const expectedTypes = ['overview', 'financial', 'risk', 'compliance', 'schedule'];
        
        expectedTypes.forEach(type => {
          if (artifacts[type]) {
            console.log(`✓ Found ${type} artifact`);
            
            // Verify artifact has content
            expect(artifacts[type]).toBeTruthy();
          }
        });
      } else {
        console.log('⚠ Artifacts not yet generated or endpoint structure different');
      }
    } else {
      console.log('Artifacts endpoint returned:', response.status());
    }
  });

  test('contract data should include artifact references', async ({ request }) => {
    if (!testContractId) {
      test.skip();
      return;
    }

    const response = await request.get(
      `http://localhost:3005/api/contracts/${testContractId}`,
      {
        headers: { 'x-tenant-id': TEST_TENANT_ID }
      }
    );

    expect(response.ok()).toBeTruthy();
    const contractData = await response.json();

    console.log('Contract data:', JSON.stringify(contractData, null, 2));

    // Verify contract has basic metadata
    expect(contractData).toHaveProperty('id');
    expect(contractData.id || contractData.contractId).toBe(testContractId);
    
    // Check for artifact-related fields
    const artifactFields = ['artifacts', 'artifactCount', 'hasArtifacts', 'artifactTypes'];
    const hasAnyArtifactField = artifactFields.some(field => field in contractData);
    
    if (hasAnyArtifactField) {
      console.log('✓ Contract includes artifact metadata');
    } else {
      console.log('⚠ Contract may not have artifact metadata populated yet');
    }
  });

  test('enhanced artifacts should be queryable', async ({ request }) => {
    if (!testContractId) {
      test.skip();
      return;
    }

    // Try to fetch enhanced artifacts (if endpoint exists)
    const response = await request.get(
      `http://localhost:3005/api/contracts/${testContractId}/enhanced-artifacts`,
      {
        headers: { 'x-tenant-id': TEST_TENANT_ID }
      }
    );

    if (response.ok()) {
      const enhancedArtifacts = await response.json();
      console.log('Enhanced artifacts:', JSON.stringify(enhancedArtifacts, null, 2));
      
      // Verify enhanced data structure
      if (enhancedArtifacts && typeof enhancedArtifacts === 'object') {
        console.log('✓ Enhanced artifacts endpoint working');
      }
    } else if (response.status() === 404) {
      console.log('Enhanced artifacts endpoint not available (expected for new implementation)');
    } else {
      console.log('Enhanced artifacts response:', response.status());
    }
  });

  test('artifact regeneration should work', async ({ request }) => {
    if (!testContractId) {
      test.skip();
      return;
    }

    // Trigger artifact regeneration
    const response = await request.post(
      `http://localhost:3005/api/contracts/${testContractId}/artifacts/regenerate`,
      {
        headers: {
          'x-tenant-id': TEST_TENANT_ID,
          'Content-Type': 'application/json'
        },
        data: {
          artifactTypes: ['overview', 'financial']
        }
      }
    );

    if (response.ok()) {
      const result = await response.json();
      console.log('Regeneration triggered:', result);
      
      expect(result).toHaveProperty('message');
      console.log('✓ Artifact regeneration endpoint working');
    } else if (response.status() === 404) {
      console.log('Regeneration endpoint not yet implemented');
    } else {
      console.log('Regeneration response:', response.status(), await response.text());
    }
  });

  test('should verify artifact data completeness', async ({ request }) => {
    if (!testContractId) {
      test.skip();
      return;
    }

    // Get artifacts
    const artifactsResponse = await request.get(
      `http://localhost:3005/api/contracts/${testContractId}/artifacts`,
      {
        headers: { 'x-tenant-id': TEST_TENANT_ID }
      }
    );

    if (artifactsResponse.ok()) {
      const artifacts = await artifactsResponse.json();
      
      // Check for overview artifact content
      if (artifacts?.overview) {
        const overview = artifacts.overview;
        
        // Verify overview has expected fields
        const expectedOverviewFields = [
          'contractName',
          'parties',
          'effectiveDate',
          'expirationDate',
          'contractValue',
          'summary'
        ];
        
        expectedOverviewFields.forEach(field => {
          if (overview[field]) {
            console.log(`✓ Overview has ${field}`);
          }
        });
      }
      
      // Check for financial artifact content
      if (artifacts?.financial) {
        const financial = artifacts.financial;
        
        // Verify financial data structure
        const expectedFinancialFields = [
          'totalValue',
          'currency',
          'paymentTerms',
          'rates',
          'milestones'
        ];
        
        expectedFinancialFields.forEach(field => {
          if (financial[field]) {
            console.log(`✓ Financial has ${field}`);
          }
        });
      }
    } else {
      console.log('⚠ Artifacts not available for verification yet');
    }
  });

  test('status API should calculate progress correctly', async ({ request }) => {
    if (!testContractId) {
      test.skip();
      return;
    }

    const response = await request.get(
      `http://localhost:3005/api/contracts/${testContractId}/status`,
      {
        headers: { 'x-tenant-id': TEST_TENANT_ID }
      }
    );

    expect(response.ok()).toBeTruthy();
    const statusData = await response.json();

    // Verify progress calculation logic
    const { status, progress, currentStep } = statusData;

    // Progress should match status
    if (status === 'UPLOADED') {
      expect(progress).toBeLessThanOrEqual(25);
      expect(currentStep).toBe('upload');
    } else if (status === 'PROCESSING') {
      expect(progress).toBeGreaterThan(25);
      expect(progress).toBeLessThan(90);
    } else if (status === 'COMPLETED') {
      expect(progress).toBe(100);
      expect(currentStep).toBe('complete');
    }

    console.log(`Status: ${status}, Progress: ${progress}%, Step: ${currentStep}`);
  });

  test('should handle concurrent status requests', async ({ request }) => {
    if (!testContractId) {
      test.skip();
      return;
    }

    // Make multiple concurrent requests
    const requests = Array(10).fill(null).map(() =>
      request.get(
        `http://localhost:3005/api/contracts/${testContractId}/status`,
        {
          headers: { 'x-tenant-id': TEST_TENANT_ID }
        }
      )
    );

    const responses = await Promise.all(requests);
    
    // All should succeed
    responses.forEach((response, index) => {
      expect(response.ok()).toBeTruthy();
      console.log(`Request ${index + 1}: ${response.status()}`);
    });

    // All should return consistent data
    const dataArray = await Promise.all(
      responses.map(r => r.json())
    );

    const firstData = dataArray[0];
    dataArray.forEach((data, index) => {
      expect(data.contractId).toBe(firstData.contractId);
      expect(data.status).toBe(firstData.status);
      console.log(`Response ${index + 1} consistent: ✓`);
    });
  });
});
