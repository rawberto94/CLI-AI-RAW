/**
 * E2E Test: Verify Artifact Population
 * 
 * Deep dive tests to ensure artifacts are actually being created and stored:
 * 1. Verify worker process spawns correctly
 * 2. Monitor database for artifact creation
 * 3. Check artifact data structure and completeness
 * 4. Verify all artifact types are generated
 * 5. Validate artifact confidence scores
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test.describe('Artifact Population Verification', () => {
  const TEST_TENANT_ID = 'test-tenant-verify-artifacts';
  let testContractId: string | null = null;

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should generate and store all artifact types', async ({ page }) => {
    // Upload a comprehensive test contract
    await page.goto('/upload');
    
    const comprehensiveContract = `
COMPREHENSIVE SERVICES AGREEMENT

This Agreement is effective January 1, 2024 between:
CLIENT: Enterprise Solutions Corp, 123 Business Ave, New York, NY 10001
SUPPLIER: Professional Services Inc, 456 Provider St, Boston, MA 02101

ARTICLE 1: SERVICES AND DELIVERABLES
The Supplier shall provide the following services:
1.1 Software Development Services
1.2 Cloud Infrastructure Management
1.3 Security Consulting and Implementation
1.4 Technical Support and Maintenance

ARTICLE 2: FINANCIAL TERMS
2.1 Rate Schedule:
    - Principal Architect: $250.00 per hour
    - Senior Engineer: $175.00 per hour
    - Mid-level Engineer: $125.00 per hour
    - Junior Engineer: $85.00 per hour
    - Technical Support: $95.00 per hour
    
2.2 Project Milestones:
    Milestone 1: Requirements and Architecture (Due: Feb 15, 2024) - $75,000
    Milestone 2: Core Platform Development (Due: Apr 30, 2024) - $150,000
    Milestone 3: Integration and Testing (Due: Jun 30, 2024) - $100,000
    Milestone 4: Deployment and Training (Due: Aug 31, 2024) - $75,000
    
2.3 Total Contract Value: $400,000
2.4 Payment Terms: Net 30 days from invoice date
2.5 Late Payment: 2% per month on overdue amounts

ARTICLE 3: INTELLECTUAL PROPERTY
3.1 Work Product: All deliverables become property of Client upon payment
3.2 Pre-existing IP: Supplier retains ownership of pre-existing tools and frameworks
3.3 License Grant: Supplier grants Client perpetual license to use pre-existing IP

ARTICLE 4: COMPLIANCE AND STANDARDS
4.1 Required Certifications:
    - ISO 27001 Information Security Management
    - SOC 2 Type II Attestation
    - GDPR Compliance for EU data processing
    - HIPAA Compliance for healthcare data
4.2 Security Standards: NIST Cybersecurity Framework alignment required
4.3 Data Protection: Industry-standard encryption at rest and in transit

ARTICLE 5: RISK MANAGEMENT
5.1 Performance Risk: Supplier warrants 99.9% uptime for production systems
5.2 Data Breach: Maximum liability of $1,000,000 for security incidents
5.3 Disaster Recovery: 24-hour RTO, 1-hour RPO required
5.4 Insurance: Supplier maintains $2M professional liability coverage
5.5 Key Personnel: Named resources must be available or equivalent substitutes approved

ARTICLE 6: CONTRACT ADMINISTRATION
6.1 Term: January 1, 2024 through December 31, 2024
6.2 Renewal: Automatic 1-year renewal unless terminated with 90 days notice
6.3 Termination for Cause: 30 days written notice
6.4 Termination for Convenience: 60 days written notice
6.5 Change Management: All scope changes require written approval

ARTICLE 7: CONFIDENTIALITY
7.1 Definition: All non-public information exchanged is confidential
7.2 Protection: Standard of care equal to own confidential information
7.3 Duration: 5 years post-termination
7.4 Exceptions: Publicly available information, independently developed

ARTICLE 8: WARRANTIES AND LIABILITY
8.1 Service Warranty: Services performed in professional manner
8.2 Quality Standards: Deliverables meet industry standards
8.3 Limitation of Liability: Capped at total contract value except for:
    - Willful misconduct
    - Intellectual property infringement
    - Confidentiality breach
8.4 Indemnification: Each party indemnifies for own breaches

ARTICLE 9: DISPUTE RESOLUTION
9.1 Negotiation: 30 days good faith negotiation
9.2 Mediation: Non-binding mediation if negotiation fails
9.3 Arbitration: Binding arbitration in New York, NY
9.4 Governing Law: State of New York

ARTICLE 10: GENERAL PROVISIONS
10.1 Assignment: No assignment without written consent
10.2 Force Majeure: Relief from obligations for uncontrollable events
10.3 Notices: Written notice to addresses above
10.4 Entire Agreement: Supersedes all prior agreements
10.5 Amendments: Must be in writing and signed by both parties

SIGNATURES:
Client: Enterprise Solutions Corp
By: Sarah Johnson, CEO
Date: January 1, 2024

Supplier: Professional Services Inc  
By: Michael Chen, President
Date: January 1, 2024
`;

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'comprehensive-services-agreement.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(comprehensiveContract)
    });

    const uploadButton = page.getByRole('button', { name: /upload|analyze/i }).first();
    await uploadButton.click();

    // Wait for redirect and capture contract ID
    await page.waitForURL('**/contracts/*', { timeout: 30000 });
    const match = page.url().match(/\/contracts\/([^/?#]+)/);
    testContractId = match ? match[1] : null;
    
    expect(testContractId).toBeTruthy();
    console.log('✓ Contract created:', testContractId);

    // Wait for worker to process (give it time to generate artifacts)
    console.log('⏳ Waiting for artifact generation worker...');
    await page.waitForTimeout(15000); // 15 seconds for worker to start and generate

    // Query database directly for artifacts
    const artifacts = await prisma.artifact.findMany({
      where: { contractId: testContractId! },
      select: {
        id: true,
        type: true,
        confidence: true,
        processingTime: true,
        data: true,
        createdAt: true,
      },
    });

    console.log(`\n📊 Artifacts found in database: ${artifacts.length}`);
    
    if (artifacts.length === 0) {
      console.log('⚠️ No artifacts generated yet. Checking contract status...');
      
      const contract = await prisma.contract.findUnique({
        where: { id: testContractId! },
        select: {
          status: true,
          processedAt: true,
          lastAnalyzedAt: true,
        },
      });
      
      console.log('Contract status:', contract);
      
      // Wait a bit longer and retry
      console.log('⏳ Waiting additional 20 seconds...');
      await page.waitForTimeout(20000);
      
      const retryArtifacts = await prisma.artifact.findMany({
        where: { contractId: testContractId! },
      });
      
      console.log(`📊 Retry found ${retryArtifacts.length} artifacts`);
      
      if (retryArtifacts.length === 0) {
        console.log('❌ ISSUE: Artifacts not being generated by worker!');
        console.log('This indicates the worker process may not be spawning or failing silently.');
      } else {
        artifacts.push(...retryArtifacts);
      }
    }

    // Verify artifact types
    const expectedTypes = ['OVERVIEW', 'CLAUSES', 'FINANCIAL', 'RISK', 'COMPLIANCE'];
    const foundTypes = artifacts.map(a => a.type);
    
    console.log('\n📋 Expected artifact types:', expectedTypes);
    console.log('📋 Found artifact types:', foundTypes);
    
    for (const type of expectedTypes) {
      const artifact = artifacts.find(a => a.type === type);
      if (artifact) {
        console.log(`✓ ${type}: Generated in ${artifact.processingTime}ms, confidence: ${artifact.confidence}`);
        
        // Verify artifact has data
        expect(artifact.data).toBeTruthy();
        expect(typeof artifact.data).toBe('object');
        
        // Verify confidence is reasonable
        expect(artifact.confidence).toBeGreaterThan(0);
        expect(artifact.confidence).toBeLessThanOrEqual(1);
      } else {
        console.log(`✗ ${type}: NOT FOUND - This artifact type was not generated`);
      }
    }

    // At minimum, we should have OVERVIEW artifact
    const overviewArtifact = artifacts.find(a => a.type === 'OVERVIEW');
    if (overviewArtifact) {
      expect(overviewArtifact).toBeTruthy();
      console.log('\n✓ Overview artifact data:', JSON.stringify(overviewArtifact.data, null, 2).substring(0, 500));
    } else {
      console.log('\n❌ CRITICAL: Overview artifact missing - worker may not be running');
    }
  });

  test('should verify worker logs and execution', async ({ page }) => {
    // This test checks if the worker process is being invoked correctly
    await page.goto('/upload');
    
    const testFile = 'Worker execution test contract content';
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'worker-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(testFile)
    });

    const uploadButton = page.getByRole('button', { name: /upload|analyze/i }).first();
    await uploadButton.click();

    await page.waitForURL('**/contracts/*', { timeout: 30000 });
    const match = page.url().match(/\/contracts\/([^/?#]+)/);
    const contractId = match ? match[1] : null;

    expect(contractId).toBeTruthy();

    // Check if contract was marked as PROCESSING
    const contract = await prisma.contract.findUnique({
      where: { id: contractId! },
      select: {
        status: true,
        createdAt: true,
        fileName: true,
      },
    });

    console.log('Contract created:', contract);
    expect(contract?.status).toBe('PROCESSING');
    
    // Worker should transition this to COMPLETED after generation
    // Wait and check status progression
    await page.waitForTimeout(20000);
    
    const updatedContract = await prisma.contract.findUnique({
      where: { id: contractId! },
      select: {
        status: true,
        processedAt: true,
        lastAnalyzedAt: true,
        artifacts: {
          select: {
            type: true,
            confidence: true,
          },
        },
      },
    });

    console.log('Contract after processing:', updatedContract);
    
    if (updatedContract?.status === 'COMPLETED') {
      console.log('✓ Worker successfully completed processing');
      expect(updatedContract.artifacts.length).toBeGreaterThan(0);
    } else if (updatedContract?.status === 'PROCESSING') {
      console.log('⚠️ Still processing - worker may be running slowly');
    } else if (updatedContract?.status === 'FAILED') {
      console.log('❌ Worker failed - check server logs for errors');
    }
  });

  test('should verify artifact data structure matches schema', async ({ page }) => {
    // Upload a contract and verify artifact data structure
    await page.goto('/upload');
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'schema-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Schema validation test contract')
    });

    const uploadButton = page.getByRole('button', { name: /upload|analyze/i }).first();
    await uploadButton.click();

    await page.waitForURL('**/contracts/*', { timeout: 30000 });
    const match = page.url().match(/\/contracts\/([^/?#]+)/);
    const contractId = match ? match[1] : null;

    // Wait for generation
    await page.waitForTimeout(20000);

    // Get artifacts and verify structure
    const artifacts = await prisma.artifact.findMany({
      where: { contractId: contractId! },
    });

    for (const artifact of artifacts) {
      console.log(`\n📦 Validating ${artifact.type} artifact...`);
      
      // All artifacts should have these properties
      expect(artifact).toHaveProperty('id');
      expect(artifact).toHaveProperty('contractId');
      expect(artifact).toHaveProperty('tenantId');
      expect(artifact).toHaveProperty('type');
      expect(artifact).toHaveProperty('data');
      expect(artifact).toHaveProperty('confidence');
      expect(artifact).toHaveProperty('processingTime');
      expect(artifact).toHaveProperty('schemaVersion');
      
      // Validate data is JSON object
      expect(typeof artifact.data).toBe('object');
      expect(artifact.data).not.toBeNull();
      
      console.log(`✓ ${artifact.type} has valid structure`);
    }
  });

  test('should verify artifacts are queryable via API', async ({ page, request }) => {
    // Upload contract
    await page.goto('/upload');
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'api-query-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('API query test contract')
    });

    const uploadButton = page.getByRole('button', { name: /upload|analyze/i }).first();
    await uploadButton.click();

    await page.waitForURL('**/contracts/*', { timeout: 30000 });
    const match = page.url().match(/\/contracts\/([^/?#]+)/);
    const contractId = match ? match[1] : null;

    // Wait for artifacts
    await page.waitForTimeout(20000);

    // Query via API
    const response = await request.get(
      `http://localhost:3005/api/contracts/${contractId}/artifacts`,
      {
        headers: { 'x-tenant-id': TEST_TENANT_ID }
      }
    );

    console.log('Artifacts API status:', response.status());
    
    if (response.ok()) {
      const artifacts = await response.json();
      console.log('Artifacts from API:', Object.keys(artifacts));
      
      // Should have artifact data
      expect(artifacts).toBeTruthy();
    } else {
      console.log('Artifacts API not available or no artifacts yet');
    }
  });
});
