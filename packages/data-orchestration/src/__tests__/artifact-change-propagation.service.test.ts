/**
 * Integration Tests for Artifact Change Propagation Service
 * Tests event publishing, engine notifications, and retry logic
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ArtifactChangePropagationService } from '../services/artifact-change-propagation.service';
import { EventBus } from '../events/event-bus';

describe('ArtifactChangePropagationService - Integration Tests', () => {
  let service: ArtifactChangePropagationService;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.getInstance();
    service = new ArtifactChangePropagationService();
  });

  describe('Event Publishing', () => {
    it('should publish ARTIFACT_UPDATED event', async () => {
      const eventSpy = jest.spyOn(eventBus, 'publish');

      await service.propagateArtifactChange({
        artifactId: 'test-artifact-id',
        contractId: 'test-contract-id',
        tenantId: 'test-tenant-id',
        changeType: 'update',
        changedFields: ['data.rateCards'],
        userId: 'test-user-id',
      });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ARTIFACT_UPDATED',
        })
      );
    });

    it('should identify affected engines', async () => {
      const result = await service.identifyAffectedEngines({
        artifactType: 'rate_card',
        changedFields: ['data.rateCards[0].hourlyRate'],
      });

      expect(result).toContain('rate-card-benchmarking');
      expect(result).toContain('cost-savings');
    });
  });

  describe('Analytical Engine Notifications', () => {
    it('should notify Rate Card Benchmarking Engine', async () => {
      const result = await service.notifyEngine({
        engineName: 'rate-card-benchmarking',
        artifactId: 'test-artifact-id',
        contractId: 'test-contract-id',
        changeType: 'update',
      });

      expect(result.success).toBe(true);
      expect(result.engineName).toBe('rate-card-benchmarking');
    });

    it('should notify all affected engines', async () => {
      const result = await service.propagateArtifactChange({
        artifactId: 'test-artifact-id',
        contractId: 'test-contract-id',
        tenantId: 'test-tenant-id',
        changeType: 'update',
        changedFields: ['data.rateCards'],
        userId: 'test-user-id',
      });

      expect(result.notifiedEngines.length).toBeGreaterThan(0);
      expect(result.notifiedEngines).toContain('rate-card-benchmarking');
    });
  });

  describe('Search Index Updates', () => {
    it('should trigger search index update', async () => {
      const result = await service.updateSearchIndex({
        contractId: 'test-contract-id',
        tenantId: 'test-tenant-id',
        artifactId: 'test-artifact-id',
      });

      expect(result.success).toBe(true);
    });

    it('should handle search index failures gracefully', async () => {
      // Simulate search index failure
      const result = await service.updateSearchIndex({
        contractId: 'invalid-contract-id',
        tenantId: 'test-tenant-id',
        artifactId: 'test-artifact-id',
      });

      // Should not throw, but log error
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('RAG Knowledge Base Sync', () => {
    it('should trigger RAG sync', async () => {
      const result = await service.syncRAGKnowledgeBase({
        contractId: 'test-contract-id',
        tenantId: 'test-tenant-id',
        artifactId: 'test-artifact-id',
      });

      expect(result.success).toBe(true);
    });

    it('should handle RAG sync failures gracefully', async () => {
      const result = await service.syncRAGKnowledgeBase({
        contractId: 'invalid-contract-id',
        tenantId: 'test-tenant-id',
        artifactId: 'test-artifact-id',
      });

      // Should not block artifact update
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed propagations', async () => {
      let attemptCount = 0;
      const mockNotify = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      });

      service.notifyEngine = mockNotify;

      const result = await service.propagateWithRetry({
        engineName: 'test-engine',
        artifactId: 'test-artifact-id',
        contractId: 'test-contract-id',
        maxRetries: 3,
      });

      expect(attemptCount).toBe(3);
      expect(result.success).toBe(true);
    });

    it('should use exponential backoff', async () => {
      const timestamps: number[] = [];
      
      const mockNotify = jest.fn().mockImplementation(() => {
        timestamps.push(Date.now());
        if (timestamps.length < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      });

      service.notifyEngine = mockNotify;

      await service.propagateWithRetry({
        engineName: 'test-engine',
        artifactId: 'test-artifact-id',
        contractId: 'test-contract-id',
        maxRetries: 3,
      });

      // Verify increasing delays
      if (timestamps.length >= 3) {
        const delay1 = timestamps[1] - timestamps[0];
        const delay2 = timestamps[2] - timestamps[1];
        expect(delay2).toBeGreaterThan(delay1);
      }
    });

    it('should log permanent failures', async () => {
      const mockNotify = jest.fn().mockRejectedValue(new Error('Permanent failure'));
      service.notifyEngine = mockNotify;

      const result = await service.propagateWithRetry({
        engineName: 'test-engine',
        artifactId: 'test-artifact-id',
        contractId: 'test-contract-id',
        maxRetries: 3,
      });

      expect(result.success).toBe(false);
      expect(result.permanentFailure).toBe(true);
      expect(mockNotify).toHaveBeenCalledTimes(3);
    });
  });

  describe('Propagation Status Tracking', () => {
    it('should track propagation status', async () => {
      const result = await service.propagateArtifactChange({
        artifactId: 'test-artifact-id',
        contractId: 'test-contract-id',
        tenantId: 'test-tenant-id',
        changeType: 'update',
        changedFields: ['data'],
        userId: 'test-user-id',
      });

      expect(result.propagationStatus).toBeDefined();
      expect(result.propagationStatus).toMatch(/completed|partial|failed/);
    });

    it('should update artifact propagation timestamp', async () => {
      await service.propagateArtifactChange({
        artifactId: 'test-artifact-id',
        contractId: 'test-contract-id',
        tenantId: 'test-tenant-id',
        changeType: 'update',
        changedFields: ['data'],
        userId: 'test-user-id',
      });

      // Verify lastPropagatedAt was updated
      const artifact = await service.getArtifact('test-artifact-id');
      expect(artifact?.lastPropagatedAt).toBeDefined();
    });
  });

  describe('Complete Propagation Flow', () => {
    it('should complete full propagation cycle', async () => {
      const result = await service.propagateArtifactChange({
        artifactId: 'test-artifact-id',
        contractId: 'test-contract-id',
        tenantId: 'test-tenant-id',
        changeType: 'update',
        changedFields: ['data.rateCards'],
        userId: 'test-user-id',
      });

      // Verify all steps completed
      expect(result.eventPublished).toBe(true);
      expect(result.notifiedEngines.length).toBeGreaterThan(0);
      expect(result.searchIndexUpdated).toBeDefined();
      expect(result.ragSynced).toBeDefined();
      expect(result.propagationStatus).toBe('completed');
    });

    it('should handle partial failures gracefully', async () => {
      // Simulate one engine failure
      const mockNotify = jest.fn()
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Engine failure'))
        .mockResolvedValueOnce({ success: true });

      service.notifyEngine = mockNotify;

      const result = await service.propagateArtifactChange({
        artifactId: 'test-artifact-id',
        contractId: 'test-contract-id',
        tenantId: 'test-tenant-id',
        changeType: 'update',
        changedFields: ['data'],
        userId: 'test-user-id',
      });

      expect(result.propagationStatus).toBe('partial');
      expect(result.failedEngines).toBeDefined();
      expect(result.failedEngines.length).toBeGreaterThan(0);
    });
  });
});
