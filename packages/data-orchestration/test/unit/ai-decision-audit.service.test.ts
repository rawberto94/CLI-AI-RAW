/**
 * Unit Tests for AI Decision Audit Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock prisma before importing the service
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    aiDecision: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockRejectedValue(new Error('DB not available')),
      count: vi.fn().mockRejectedValue(new Error('DB not available')),
    },
  },
}));

import { AIDecisionAuditService } from '../../src/services/ai-decision-audit.service';
import type { AIDecision, AuditQuery } from '../../src/services/ai-decision-audit.service';

describe('AIDecisionAuditService', () => {
  let service: AIDecisionAuditService;

  beforeEach(() => {
    service = new AIDecisionAuditService();
  });

  describe('recordDecision', () => {
    it('should record a decision and return it with an id', async () => {
      const decision = await service.recordDecision({
        tenantId: 'tenant-1',
        userId: 'user-1',
        feature: 'extraction',
        model: 'gpt-4o',
        output: { text: 'extracted data' },
        outputType: 'json',
        confidence: 0.92,
        processingTimeMs: 1500,
        outcome: 'pending',
      });

      expect(decision).toBeDefined();
      expect(decision.id).toBeDefined();
      expect(decision.tenantId).toBe('tenant-1');
      expect(decision.feature).toBe('extraction');
      expect(decision.model).toBe('gpt-4o');
      expect(decision.confidence).toBe(0.92);
      expect(decision.outcome).toBe('pending');
      expect(decision.createdAt).toBeInstanceOf(Date);
      expect(decision.inputHash).toBeDefined();
    });

    it('should allow recording multiple decisions', async () => {
      await service.recordDecision({
        tenantId: 'tenant-1',
        feature: 'extraction',
        model: 'gpt-4o',
        output: { a: 1 },
        outputType: 'json',
        confidence: 0.85,
        processingTimeMs: 1000,
        outcome: 'pending',
      });

      await service.recordDecision({
        tenantId: 'tenant-1',
        feature: 'summarization',
        model: 'gpt-4o-mini',
        output: { b: 2 },
        outputType: 'json',
        confidence: 0.78,
        processingTimeMs: 800,
        outcome: 'accepted',
      });

      const result = await service.queryDecisions({ tenantId: 'tenant-1' });
      expect(result.total).toBe(2);
    });
  });

  describe('recordFeedback', () => {
    it('should record user feedback on a decision', async () => {
      const decision = await service.recordDecision({
        tenantId: 'tenant-1',
        feature: 'extraction',
        model: 'gpt-4o',
        output: { text: 'test' },
        outputType: 'json',
        confidence: 0.9,
        processingTimeMs: 500,
        outcome: 'pending',
      });

      const updated = await service.recordFeedback(decision.id, {
        wasCorrect: true,
        submittedBy: 'user-1',
      });

      expect(updated).toBeDefined();
      expect(updated?.outcome).toBe('accepted');
      expect(updated?.userFeedback?.wasCorrect).toBe(true);
      expect(updated?.reviewedAt).toBeInstanceOf(Date);
    });

    it('should set outcome to rejected when feedback is negative', async () => {
      const decision = await service.recordDecision({
        tenantId: 'tenant-1',
        feature: 'risk_analysis',
        model: 'gpt-4o',
        output: {},
        outputType: 'json',
        confidence: 0.65,
        processingTimeMs: 2000,
        outcome: 'pending',
      });

      const updated = await service.recordFeedback(decision.id, {
        wasCorrect: false,
        feedbackText: 'Incorrect risk level',
        submittedBy: 'user-2',
      });

      expect(updated?.outcome).toBe('rejected');
    });

    it('should set outcome to modified when correctedValue is provided', async () => {
      const decision = await service.recordDecision({
        tenantId: 'tenant-1',
        feature: 'extraction',
        model: 'gpt-4o',
        output: { value: 100 },
        outputType: 'json',
        confidence: 0.75,
        processingTimeMs: 1200,
        outcome: 'pending',
      });

      const updated = await service.recordFeedback(decision.id, {
        wasCorrect: false,
        correctedValue: { value: 150 },
        submittedBy: 'user-1',
      });

      expect(updated?.outcome).toBe('modified');
    });

    it('should return null for non-existent decision ID', async () => {
      const result = await service.recordFeedback('non-existent-id', {
        wasCorrect: true,
        submittedBy: 'user-1',
      });
      expect(result).toBeNull();
    });
  });

  describe('queryDecisions', () => {
    beforeEach(async () => {
      // Seed test decisions
      await service.recordDecision({
        tenantId: 'tenant-1',
        userId: 'user-1',
        contractId: 'contract-1',
        feature: 'extraction',
        model: 'gpt-4o',
        output: {},
        outputType: 'json',
        confidence: 0.95,
        processingTimeMs: 1000,
        outcome: 'accepted',
      });

      await service.recordDecision({
        tenantId: 'tenant-1',
        userId: 'user-2',
        contractId: 'contract-2',
        feature: 'summarization',
        model: 'gpt-4o-mini',
        output: {},
        outputType: 'json',
        confidence: 0.7,
        processingTimeMs: 500,
        outcome: 'pending',
      });

      await service.recordDecision({
        tenantId: 'tenant-2',
        feature: 'risk_analysis',
        model: 'gpt-4o',
        output: {},
        outputType: 'json',
        confidence: 0.4,
        processingTimeMs: 3000,
        outcome: 'rejected',
      });
    });

    it('should filter by tenantId', async () => {
      const result = await service.queryDecisions({ tenantId: 'tenant-1' });
      expect(result.total).toBe(2);
      expect(result.decisions.every(d => d.tenantId === 'tenant-1')).toBe(true);
    });

    it('should filter by feature', async () => {
      const result = await service.queryDecisions({
        tenantId: 'tenant-1',
        feature: 'extraction',
      });
      expect(result.total).toBe(1);
      expect(result.decisions[0]?.feature).toBe('extraction');
    });

    it('should filter by model', async () => {
      const result = await service.queryDecisions({
        tenantId: 'tenant-1',
        model: 'gpt-4o-mini',
      });
      expect(result.total).toBe(1);
      expect(result.decisions[0]?.model).toBe('gpt-4o-mini');
    });

    it('should filter by confidence range', async () => {
      const result = await service.queryDecisions({
        tenantId: 'tenant-1',
        minConfidence: 0.8,
      });
      expect(result.total).toBe(1);
      expect(result.decisions[0]?.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should filter by contractId', async () => {
      const result = await service.queryDecisions({
        tenantId: 'tenant-1',
        contractId: 'contract-1',
      });
      expect(result.total).toBe(1);
    });

    it('should support pagination', async () => {
      const result = await service.queryDecisions({
        tenantId: 'tenant-1',
        limit: 1,
        offset: 0,
      });
      expect(result.decisions.length).toBe(1);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it('should sort by date descending', async () => {
      const result = await service.queryDecisions({ tenantId: 'tenant-1' });
      const dates = result.decisions.map(d => d.createdAt.getTime());
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    });
  });

  describe('getUsageStats', () => {
    it('should return correct usage statistics', async () => {
      await service.recordDecision({
        tenantId: 'tenant-1',
        feature: 'extraction',
        model: 'gpt-4o',
        output: {},
        outputType: 'json',
        confidence: 0.9,
        processingTimeMs: 1000,
        tokensUsed: 500,
        estimatedCost: 0.02,
        outcome: 'accepted',
      });

      await service.recordDecision({
        tenantId: 'tenant-1',
        feature: 'summarization',
        model: 'gpt-4o',
        output: {},
        outputType: 'json',
        confidence: 0.8,
        processingTimeMs: 2000,
        tokensUsed: 800,
        estimatedCost: 0.03,
        outcome: 'pending',
      });

      const stats = await service.getUsageStats('tenant-1');

      expect(stats.totalDecisions).toBe(2);
      expect(stats.byFeature.extraction).toBe(1);
      expect(stats.byFeature.summarization).toBe(1);
      expect(stats.byModel['gpt-4o']).toBe(2);
      expect(stats.avgConfidence).toBeCloseTo(0.85, 10);
      expect(stats.totalTokens).toBe(1300);
      expect(stats.estimatedCost).toBe(0.05);
    });

    it('should return empty stats for unknown tenant', async () => {
      const stats = await service.getUsageStats('unknown-tenant');
      expect(stats.totalDecisions).toBe(0);
    });
  });

  describe('getDecision', () => {
    it('should return a decision by its ID', async () => {
      const created = await service.recordDecision({
        tenantId: 'tenant-1',
        feature: 'extraction',
        model: 'gpt-4o',
        output: {},
        outputType: 'json',
        confidence: 0.9,
        processingTimeMs: 500,
        outcome: 'accepted',
      });

      const found = await service.getDecision(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.getDecision('non-existent');
      expect(found).toBeNull();
    });
  });
});
