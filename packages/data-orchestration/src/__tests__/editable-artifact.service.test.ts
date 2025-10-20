/**
 * Integration Tests for Editable Artifact Service
 * Tests artifact editing flow, validation, conflict detection, and version history
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EditableArtifactService } from '../services/editable-artifact.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const service = new EditableArtifactService();

describe('EditableArtifactService - Integration Tests', () => {
  let testContractId: string;
  let testArtifactId: string;
  let testTenantId: string;
  let testUserId: string;

  beforeEach(async () => {
    // Setup test data
    testTenantId = 'test-tenant-' + Date.now();
    testUserId = 'test-user-' + Date.now();
    
    // Create test contract
    const contract = await prisma.contract.create({
      data: {
        tenantId: testTenantId,
        fileName: 'test-contract.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        status: 'completed',
        uploadedBy: testUserId,
      },
    });
    testContractId = contract.id;

    // Create test artifact
    const artifact = await prisma.artifact.create({
      data: {
        contractId: testContractId,
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
    testArtifactId = artifact.id;
  });

  afterEach(async () => {
    // Cleanup test data
    await prisma.artifactEdit.deleteMany({ where: { artifactId: testArtifactId } });
    await prisma.artifact.deleteMany({ where: { contractId: testContractId } });
    await prisma.contract.deleteMany({ where: { id: testContractId } });
  });

  describe('Single Field Updates', () => {
    it('should update a single field successfully', async () => {
      const result = await service.updateArtifactField({
        artifactId: testArtifactId,
        fieldPath: 'data.rateCards[0].hourlyRate',
        value: 120,
        userId: testUserId,
        tenantId: testTenantId,
      });

      expect(result.success).toBe(true);
      expect(result.artifact?.data.rateCards[0].hourlyRate).toBe(120);
      expect(result.artifact?.isEdited).toBe(true);
      expect(result.artifact?.editCount).toBe(1);
    });

    it('should validate field updates', async () => {
      const result = await service.updateArtifactField({
        artifactId: testArtifactId,
        fieldPath: 'data.rateCards[0].hourlyRate',
        value: -50, // Invalid negative rate
        userId: testUserId,
        tenantId: testTenantId,
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors?.length).toBeGreaterThan(0);
    });
  });

  describe('Full Artifact Updates', () => {
    it('should update entire artifact successfully', async () => {
      const updates = {
        data: {
          rateCards: [
            {
              role: 'Senior Developer',
              seniorityLevel: 'Senior',
              hourlyRate: 150,
              currency: 'USD',
            },
          ],
        },
      };

      const result = await service.updateArtifact({
        artifactId: testArtifactId,
        updates,
        userId: testUserId,
        tenantId: testTenantId,
        reason: 'Updating rate card data',
      });

      expect(result.success).toBe(true);
      expect(result.artifact?.data.rateCards[0].role).toBe('Senior Developer');
      expect(result.artifact?.editCount).toBe(1);
    });

    it('should create version history on update', async () => {
      await service.updateArtifact({
        artifactId: testArtifactId,
        updates: { data: { rateCards: [] } },
        userId: testUserId,
        tenantId: testTenantId,
        reason: 'Test update',
      });

      const versions = await service.getArtifactVersionHistory(testArtifactId);
      expect(versions.length).toBeGreaterThan(0);
      expect(versions[0].editedBy).toBe(testUserId);
      expect(versions[0].reason).toBe('Test update');
    });
  });

  describe('Conflict Detection', () => {
    it('should detect concurrent edit conflicts', async () => {
      // Get current artifact
      const artifact = await prisma.artifact.findUnique({
        where: { id: testArtifactId },
      });

      // Simulate another user's edit
      await prisma.artifact.update({
        where: { id: testArtifactId },
        data: {
          data: { rateCards: [] },
          lastEditedAt: new Date(),
          lastEditedBy: 'another-user',
        },
      });

      // Try to update with old timestamp
      const result = await service.updateArtifact({
        artifactId: testArtifactId,
        updates: { data: { rateCards: [] } },
        userId: testUserId,
        tenantId: testTenantId,
        lastModified: artifact?.lastEditedAt,
      });

      expect(result.success).toBe(false);
      expect(result.conflict).toBe(true);
    });
  });

  describe('Version History', () => {
    it('should list all versions', async () => {
      // Create multiple versions
      await service.updateArtifact({
        artifactId: testArtifactId,
        updates: { data: { version: 1 } },
        userId: testUserId,
        tenantId: testTenantId,
      });

      await service.updateArtifact({
        artifactId: testArtifactId,
        updates: { data: { version: 2 } },
        userId: testUserId,
        tenantId: testTenantId,
      });

      const versions = await service.getArtifactVersionHistory(testArtifactId);
      expect(versions.length).toBe(2);
    });

    it('should revert to previous version', async () => {
      const originalData = { rateCards: [{ role: 'Original' }] };
      
      // Update to new data
      await service.updateArtifact({
        artifactId: testArtifactId,
        updates: { data: originalData },
        userId: testUserId,
        tenantId: testTenantId,
      });

      await service.updateArtifact({
        artifactId: testArtifactId,
        updates: { data: { rateCards: [{ role: 'Modified' }] } },
        userId: testUserId,
        tenantId: testTenantId,
      });

      // Revert to version 1
      const result = await service.revertToVersion({
        artifactId: testArtifactId,
        version: 1,
        userId: testUserId,
        tenantId: testTenantId,
      });

      expect(result.success).toBe(true);
      expect(result.artifact?.data.rateCards[0].role).toBe('Original');
    });
  });

  describe('Validation Framework', () => {
    it('should validate rate card structure', async () => {
      const invalidData = {
        data: {
          rateCards: [
            {
              // Missing required fields
              role: 'Developer',
            },
          ],
        },
      };

      const result = await service.updateArtifact({
        artifactId: testArtifactId,
        updates: invalidData,
        userId: testUserId,
        tenantId: testTenantId,
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
    });

    it('should validate currency codes', async () => {
      const result = await service.updateArtifactField({
        artifactId: testArtifactId,
        fieldPath: 'data.rateCards[0].currency',
        value: 'INVALID',
        userId: testUserId,
        tenantId: testTenantId,
      });

      expect(result.success).toBe(false);
      expect(result.validationErrors?.some(e => e.field === 'currency')).toBe(true);
    });
  });
});
