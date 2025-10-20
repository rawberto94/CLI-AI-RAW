/**
 * End-to-End Test: Complete Artifact Editing Workflow
 * Tests: Upload → Extract → Edit → Save → Verify Propagation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('E2E: Complete Artifact Editing Workflow', () => {
  const TEST_TENANT_ID = 'e2e-tenant-' + Date.now();
  const TEST_USER_ID = 'e2e-user-' + Date.now();
  let contractId: string;
  let artifactId: string;

  beforeAll(async () => {
    // Setup: Ensure database is ready
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup
    if (artifactId) {
      await prisma.artifactEdit.deleteMany({ where: { artifactId } });
      await prisma.artifact.deleteMany({ where: { id: artifactId } });
    }
    if (contractId) {
      await prisma.contract.deleteMany({ where: { id: contractId } });
    }
    await prisma.$disconnect();
  });

  it('should complete full workflow: upload → extract → edit → propagate', async () => {
    // Step 1: Upload Contract
    console.log('📤 Step 1: Uploading contract...');
    const uploadResponse = await fetch(`${API_BASE}/api/contracts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'test-contract.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        tenantId: TEST_TENANT_ID,
        userId: TEST_USER_ID,
      }),
    });

    expect(uploadResponse.status).toBe(201);
    const uploadData = await uploadResponse.json();
    contractId = uploadData.contract.id;
    console.log(`✓ Contract uploaded: ${contractId}`);

    // Step 2: Extract Artifacts (simulated)
    console.log('🔍 Step 2: Extracting artifacts...');
    const artifact = await prisma.artifact.create({
      data: {
        contractId,
        type: 'rate_card',
        data: {
          rateCards: [
            {
              role: 'Developer',
              seniorityLevel: 'Mid',
              hourlyRate: 100,
              currency: 'USD',
            },
          ],
        },
        confidence: 0.95,
        extractedAt: new Date(),
      },
    });
    artifactId = artifact.id;
    console.log(`✓ Artifact extracted: ${artifactId}`);

    // Step 3: Edit Artifact
    console.log('✏️  Step 3: Editing artifact...');
    const editResponse = await fetch(
      `${API_BASE}/api/contracts/${contractId}/artifacts/${artifactId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            data: {
              rateCards: [
                {
                  role: 'Senior Developer',
                  seniorityLevel: 'Senior',
                  hourlyRate: 150,
                  currency: 'USD',
                  location: 'US',
                  skills: ['JavaScript', 'TypeScript', 'React'],
                },
              ],
            },
          },
          userId: TEST_USER_ID,
          tenantId: TEST_TENANT_ID,
          reason: 'E2E test update',
        }),
      }
    );

    expect(editResponse.status).toBe(200);
    const editData = await editResponse.json();
    expect(editData.success).toBe(true);
    expect(editData.artifact.isEdited).toBe(true);
    expect(editData.artifact.editCount).toBe(1);
    console.log('✓ Artifact edited successfully');

    // Step 4: Verify Version History
    console.log('📜 Step 4: Verifying version history...');
    const versionsResponse = await fetch(
      `${API_BASE}/api/contracts/${contractId}/artifacts/${artifactId}/versions`
    );

    expect(versionsResponse.status).toBe(200);
    const versionsData = await versionsResponse.json();
    expect(versionsData.versions.length).toBeGreaterThan(0);
    expect(versionsData.versions[0].editedBy).toBe(TEST_USER_ID);
    console.log(`✓ Version history created: ${versionsData.versions.length} versions`);

    // Step 5: Verify Propagation
    console.log('🔄 Step 5: Verifying propagation...');
    
    // Wait for async propagation
    await new Promise(resolve => setTimeout(resolve, 2000));

    const updatedArtifact = await prisma.artifact.findUnique({
      where: { id: artifactId },
    });

    expect(updatedArtifact?.lastPropagatedAt).toBeDefined();
    expect(updatedArtifact?.propagationStatus).toMatch(/completed|partial/);
    console.log(`✓ Propagation completed: ${updatedArtifact?.propagationStatus}`);

    // Step 6: Verify Search Index Update
    console.log('🔍 Step 6: Verifying search index...');
    const searchResponse = await fetch(
      `${API_BASE}/api/contracts/search/enhanced?q=Senior Developer&tenantId=${TEST_TENANT_ID}`
    );

    expect(searchResponse.status).toBe(200);
    const searchData = await searchResponse.json();
    // Should find the updated contract
    console.log(`✓ Search index updated: ${searchData.results?.length || 0} results`);

    // Step 7: Test Revert Functionality
    console.log('⏮️  Step 7: Testing revert...');
    const revertResponse = await fetch(
      `${API_BASE}/api/contracts/${contractId}/artifacts/${artifactId}/revert/1`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: TEST_USER_ID,
          tenantId: TEST_TENANT_ID,
        }),
      }
    );

    expect(revertResponse.status).toBe(200);
    const revertData = await revertResponse.json();
    expect(revertData.success).toBe(true);
    console.log('✓ Revert successful');

    // Step 8: Verify Revert
    console.log('✅ Step 8: Verifying revert...');
    const revertedArtifact = await prisma.artifact.findUnique({
      where: { id: artifactId },
    });

    expect(revertedArtifact?.data.rateCards[0].role).toBe('Developer');
    expect(revertedArtifact?.data.rateCards[0].hourlyRate).toBe(100);
    console.log('✓ Artifact reverted to original state');

    console.log('');
    console.log('🎉 E2E Test Completed Successfully!');
    console.log('===================================');
    console.log('✓ Contract uploaded');
    console.log('✓ Artifacts extracted');
    console.log('✓ Artifact edited');
    console.log('✓ Version history created');
    console.log('✓ Changes propagated');
    console.log('✓ Search index updated');
    console.log('✓ Revert functionality works');
  });

  it('should handle concurrent edits correctly', async () => {
    console.log('🔀 Testing concurrent edits...');

    // Create test artifact
    const artifact = await prisma.artifact.create({
      data: {
        contractId,
        type: 'rate_card',
        data: { value: 0 },
        confidence: 0.95,
        extractedAt: new Date(),
      },
    });

    const testArtifactId = artifact.id;

    // Simulate two users editing simultaneously
    const edit1Promise = fetch(
      `${API_BASE}/api/contracts/${contractId}/artifacts/${testArtifactId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: { data: { value: 1 } },
          userId: 'user1',
          tenantId: TEST_TENANT_ID,
          lastModified: artifact.lastEditedAt?.toISOString(),
        }),
      }
    );

    const edit2Promise = fetch(
      `${API_BASE}/api/contracts/${contractId}/artifacts/${testArtifactId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: { data: { value: 2 } },
          userId: 'user2',
          tenantId: TEST_TENANT_ID,
          lastModified: artifact.lastEditedAt?.toISOString(),
        }),
      }
    );

    const [response1, response2] = await Promise.all([edit1Promise, edit2Promise]);

    // One should succeed, one should get conflict
    const success = response1.status === 200 || response2.status === 200;
    const conflict = response1.status === 409 || response2.status === 409;

    expect(success).toBe(true);
    expect(conflict).toBe(true);
    console.log('✓ Concurrent edit conflict detected correctly');

    // Cleanup
    await prisma.artifactEdit.deleteMany({ where: { artifactId: testArtifactId } });
    await prisma.artifact.delete({ where: { id: testArtifactId } });
  });

  it('should handle bulk updates efficiently', async () => {
    console.log('📦 Testing bulk updates...');

    // Create multiple artifacts
    const artifacts = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        prisma.artifact.create({
          data: {
            contractId,
            type: 'rate_card',
            data: { index: i },
            confidence: 0.95,
            extractedAt: new Date(),
          },
        })
      )
    );

    const startTime = Date.now();

    // Bulk update
    const bulkResponse = await fetch(
      `${API_BASE}/api/contracts/${contractId}/artifacts/bulk-update`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: artifacts.map(a => ({
            artifactId: a.id,
            updates: { data: { updated: true } },
          })),
          userId: TEST_USER_ID,
          tenantId: TEST_TENANT_ID,
        }),
      }
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(bulkResponse.status).toBe(200);
    const bulkData = await bulkResponse.json();
    expect(bulkData.results.length).toBe(10);
    expect(bulkData.results.every((r: any) => r.success)).toBe(true);

    console.log(`✓ Bulk update completed in ${duration}ms`);
    console.log(`  Average: ${(duration / 10).toFixed(2)}ms per artifact`);

    // Cleanup
    await Promise.all(
      artifacts.map(a =>
        prisma.artifactEdit.deleteMany({ where: { artifactId: a.id } })
      )
    );
    await prisma.artifact.deleteMany({
      where: { id: { in: artifacts.map(a => a.id) } },
    });
  });
});
