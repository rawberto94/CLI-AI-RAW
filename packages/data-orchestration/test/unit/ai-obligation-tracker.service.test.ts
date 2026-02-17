/**
 * Unit Tests for AI Obligation Tracker Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIObligationTrackerService } from '../../src/services/ai-obligation-tracker.service';
import type { Obligation, ObligationSummary } from '../../src/services/ai-obligation-tracker.service';

describe('AIObligationTrackerService', () => {
  let service: AIObligationTrackerService;

  beforeEach(() => {
    service = new AIObligationTrackerService();
  });

  describe('extractObligations', () => {
    it('should extract payment obligations from contract text', async () => {
      const text = 'The Client shall pay the Vendor within 30 days of invoice receipt.';
      const result = await service.extractObligations('tenant-1', 'contract-1', text, {
        client: 'Client',
        vendor: 'Vendor',
      });

      expect(result.obligations.length).toBeGreaterThan(0);
      expect(result.obligations[0]?.type).toBe('payment');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should extract delivery obligations', async () => {
      const text = 'The Vendor shall deliver all milestones within the agreed timeline.';
      const result = await service.extractObligations('tenant-1', 'contract-1', text);

      expect(result.obligations.length).toBeGreaterThan(0);
      const deliveryObl = result.obligations.find(o => o.type === 'delivery');
      expect(deliveryObl).toBeDefined();
    });

    it('should extract compliance obligations', async () => {
      const text = 'Both parties shall comply with all applicable regulations and laws.';
      const result = await service.extractObligations('tenant-1', 'contract-1', text);

      expect(result.obligations.length).toBeGreaterThan(0);
      const complianceObl = result.obligations.find(o => o.type === 'compliance');
      expect(complianceObl).toBeDefined();
    });

    it('should return warnings when no obligations found', async () => {
      const text = 'This is just a general description with no obligation language.';
      const result = await service.extractObligations('tenant-1', 'contract-1', text);

      expect(result.obligations.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should suggest payment review when no payment obligations found', async () => {
      const text = 'The Vendor shall deliver the goods.';
      const result = await service.extractObligations('tenant-1', 'contract-1', text);

      expect(result.suggestions.some(s => s.includes('payment'))).toBe(true);
    });

    it('should handle multiple obligations in contract text', async () => {
      const text = [
        'The Client shall pay the Vendor net 30 days.',
        'The Vendor shall deliver all software by December 31.',
        'Both parties must comply with GDPR regulations.',
        'The Vendor shall report monthly on project progress.',
      ].join('. ');

      const result = await service.extractObligations('tenant-1', 'contract-1', text, {
        client: 'Client',
        vendor: 'Vendor',
      });

      expect(result.obligations.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('addObligation', () => {
    it('should add a manual obligation', () => {
      const obligation = service.addObligation({
        tenantId: 'tenant-1',
        contractId: 'contract-1',
        title: 'Monthly Report',
        description: 'Submit monthly progress report',
        type: 'reporting',
        priority: 'medium',
        status: 'pending',
        obligor: 'Vendor',
        obligee: 'Client',
        extractionConfidence: 1.0,
        dueDate: new Date('2025-03-01'),
      });

      expect(obligation.id).toBeDefined();
      expect(obligation.title).toBe('Monthly Report');
      expect(obligation.type).toBe('reporting');
      expect(obligation.createdAt).toBeInstanceOf(Date);
    });

    it('should be retrievable after adding', () => {
      const added = service.addObligation({
        tenantId: 'tenant-1',
        contractId: 'contract-1',
        title: 'Test Obligation',
        description: 'Test',
        type: 'payment',
        priority: 'high',
        status: 'pending',
        obligor: 'Client',
        obligee: 'Vendor',
        extractionConfidence: 0.95,
      });

      const found = service.getObligation(added.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(added.id);
    });
  });

  describe('updateObligationStatus', () => {
    it('should update obligation status to completed', async () => {
      const obligation = service.addObligation({
        tenantId: 'tenant-1',
        contractId: 'contract-1',
        title: 'Payment Due',
        description: 'Pay invoice',
        type: 'payment',
        priority: 'high',
        status: 'pending',
        obligor: 'Client',
        obligee: 'Vendor',
        extractionConfidence: 0.9,
      });

      const updated = await service.updateObligationStatus(obligation.id, 'completed', {
        completedBy: 'user-1',
        completionNotes: 'Paid via bank transfer',
      });

      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeInstanceOf(Date);
      expect(updated?.completedBy).toBe('user-1');
    });

    it('should return null for non-existent obligation', async () => {
      const result = await service.updateObligationStatus('non-existent', 'completed');
      expect(result).toBeNull();
    });
  });

  describe('getObligationSummary', () => {
    beforeEach(() => {
      const now = new Date();
      // Add various obligations
      service.addObligation({
        tenantId: 'tenant-1',
        contractId: 'contract-1',
        title: 'Payment 1',
        description: 'Pay',
        type: 'payment',
        priority: 'high',
        status: 'pending',
        obligor: 'Client',
        obligee: 'Vendor',
        extractionConfidence: 0.9,
        dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days
      });

      service.addObligation({
        tenantId: 'tenant-1',
        contractId: 'contract-1',
        title: 'Report 1',
        description: 'Report',
        type: 'reporting',
        priority: 'medium',
        status: 'completed',
        obligor: 'Vendor',
        obligee: 'Client',
        extractionConfidence: 0.85,
      });

      service.addObligation({
        tenantId: 'tenant-1',
        contractId: 'contract-2',
        title: 'Delivery 1',
        description: 'Deliver',
        type: 'delivery',
        priority: 'critical',
        status: 'overdue',
        obligor: 'Vendor',
        obligee: 'Client',
        extractionConfidence: 0.95,
        dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      });
    });

    it('should return correct totals', async () => {
      const summary = await service.getObligationSummary('tenant-1');
      expect(summary.total).toBe(3);
    });

    it('should count by status correctly', async () => {
      const summary = await service.getObligationSummary('tenant-1');
      expect(summary.byStatus.pending).toBe(1);
      expect(summary.byStatus.completed).toBe(1);
      expect(summary.byStatus.overdue).toBe(1);
    });

    it('should count by type correctly', async () => {
      const summary = await service.getObligationSummary('tenant-1');
      expect(summary.byType.payment).toBe(1);
      expect(summary.byType.reporting).toBe(1);
      expect(summary.byType.delivery).toBe(1);
    });

    it('should calculate completion rate', async () => {
      const summary = await service.getObligationSummary('tenant-1');
      expect(summary.completionRate).toBeCloseTo(1 / 3, 2);
    });

    it('should return empty summary for unknown tenant', async () => {
      const summary = await service.getObligationSummary('unknown-tenant');
      expect(summary.total).toBe(0);
      expect(summary.completionRate).toBe(0);
    });
  });

  describe('generateAlerts', () => {
    it('should generate overdue alerts', async () => {
      service.addObligation({
        tenantId: 'tenant-1',
        contractId: 'contract-1',
        title: 'Overdue Payment',
        description: 'Was due yesterday',
        type: 'payment',
        priority: 'critical',
        status: 'pending',
        obligor: 'Client',
        obligee: 'Vendor',
        extractionConfidence: 0.9,
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      });

      const alerts = await service.generateAlerts('tenant-1');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]?.type).toBe('overdue');
      expect(alerts[0]?.severity).toBe('critical');
    });

    it('should generate upcoming alerts', async () => {
      service.addObligation({
        tenantId: 'tenant-1',
        contractId: 'contract-1',
        title: 'Upcoming Delivery',
        description: 'Due in 5 days',
        type: 'delivery',
        priority: 'high',
        status: 'in_progress',
        obligor: 'Vendor',
        obligee: 'Client',
        extractionConfidence: 0.85,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      });

      const alerts = await service.generateAlerts('tenant-1');
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some(a => a.type === 'upcoming')).toBe(true);
    });

    it('should sort alerts by severity', async () => {
      const now = Date.now();
      service.addObligation({
        tenantId: 'tenant-1',
        contractId: 'contract-1',
        title: 'Critical overdue',
        description: 'Overdue',
        type: 'payment',
        priority: 'critical',
        status: 'pending',
        obligor: 'Client',
        obligee: 'Vendor',
        extractionConfidence: 0.9,
        dueDate: new Date(now - 5 * 24 * 60 * 60 * 1000),
      });

      service.addObligation({
        tenantId: 'tenant-1',
        contractId: 'contract-1',
        title: 'Upcoming report',
        description: 'Soon',
        type: 'reporting',
        priority: 'medium',
        status: 'in_progress',
        obligor: 'Vendor',
        obligee: 'Client',
        extractionConfidence: 0.8,
        dueDate: new Date(now + 6 * 24 * 60 * 60 * 1000),
      });

      const alerts = await service.generateAlerts('tenant-1');
      if (alerts.length >= 2) {
        const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        expect(severityOrder[alerts[0]!.severity]!).toBeLessThanOrEqual(severityOrder[alerts[1]!.severity]!);
      }
    });
  });

  describe('getObligation', () => {
    it('should return null for non-existent obligation', () => {
      const result = service.getObligation('non-existent');
      expect(result).toBeNull();
    });
  });
});
