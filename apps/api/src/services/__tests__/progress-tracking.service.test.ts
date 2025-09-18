/**
 * Unit tests for Progress Tracking Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { progressTrackingService, ProcessingStage } from '../progress-tracking.service';

describe('ProgressTrackingService', () => {
  const testContractId = 'test-contract-123';
  const testTenantId = 'test-tenant';

  beforeEach(() => {
    // Clear any existing progress
    const existing = progressTrackingService.getProgress(testContractId);
    if (existing) {
      progressTrackingService['progressMap'].delete(testContractId);
    }
  });

  describe('initializeProgress', () => {
    it('should initialize progress tracking for a contract', () => {
      const progress = progressTrackingService.initializeProgress(testContractId, testTenantId);
      
      expect(progress.contractId).toBe(testContractId);
      expect(progress.tenantId).toBe(testTenantId);
      expect(progress.stage).toBe(ProcessingStage.UPLOAD_VALIDATION);
      expect(progress.progress).toBe(0);
      expect(progress.completedStages).toHaveLength(0);
      expect(progress.estimatedTimeRemaining).toBeGreaterThan(0);
    });

    it('should emit progress event on initialization', () => {
      const mockListener = vi.fn();
      progressTrackingService.on('progress', mockListener);
      
      progressTrackingService.initializeProgress(testContractId, testTenantId);
      
      expect(mockListener).toHaveBeenCalledOnce();
      
      progressTrackingService.off('progress', mockListener);
    });
  });

  describe('updateProgress', () => {
    beforeEach(() => {
      progressTrackingService.initializeProgress(testContractId, testTenantId);
    });

    it('should update progress for a stage', () => {
      const result = progressTrackingService.updateProgress(
        testContractId,
        ProcessingStage.FILE_EXTRACTION,
        50,
        'Extracting content...'
      );
      
      expect(result).toBeDefined();
      expect(result!.stage).toBe(ProcessingStage.FILE_EXTRACTION);
      expect(result!.message).toBe('Extracting content...');
      expect(result!.progress).toBeGreaterThan(0);
    });

    it('should calculate overall progress correctly', () => {
      // Complete upload validation
      progressTrackingService.completeStage(testContractId, ProcessingStage.UPLOAD_VALIDATION);
      
      // Update file extraction to 50%
      const result = progressTrackingService.updateProgress(
        testContractId,
        ProcessingStage.FILE_EXTRACTION,
        50
      );
      
      expect(result!.progress).toBeGreaterThan(5); // Should be more than just upload validation
      expect(result!.completedStages).toContain(ProcessingStage.UPLOAD_VALIDATION);
    });

    it('should return null for unknown contract', () => {
      const result = progressTrackingService.updateProgress(
        'unknown-contract',
        ProcessingStage.FILE_EXTRACTION,
        50
      );
      
      expect(result).toBeNull();
    });

    it('should update estimated time remaining', () => {
      const result = progressTrackingService.updateProgress(
        testContractId,
        ProcessingStage.FILE_EXTRACTION,
        25
      );
      
      expect(result!.estimatedTimeRemaining).toBeDefined();
      expect(result!.estimatedTimeRemaining).toBeGreaterThan(0);
    });
  });

  describe('completeStage', () => {
    beforeEach(() => {
      progressTrackingService.initializeProgress(testContractId, testTenantId);
    });

    it('should mark a stage as completed', () => {
      const result = progressTrackingService.completeStage(
        testContractId,
        ProcessingStage.UPLOAD_VALIDATION,
        'Upload validation completed'
      );
      
      expect(result).toBeDefined();
      expect(result!.completedStages).toContain(ProcessingStage.UPLOAD_VALIDATION);
      expect(result!.message).toBe('Upload validation completed');
    });

    it('should advance to next stage automatically', () => {
      const result = progressTrackingService.completeStage(
        testContractId,
        ProcessingStage.UPLOAD_VALIDATION
      );
      
      expect(result!.stage).toBe(ProcessingStage.FILE_EXTRACTION);
    });

    it('should emit completed event when all stages are done', () => {
      const mockListener = vi.fn();
      progressTrackingService.on('completed', mockListener);
      
      // Complete all stages
      const stages = [
        ProcessingStage.UPLOAD_VALIDATION,
        ProcessingStage.FILE_EXTRACTION,
        ProcessingStage.CONTENT_ANALYSIS,
        ProcessingStage.TEMPLATE_ANALYSIS,
        ProcessingStage.FINANCIAL_ANALYSIS,
        ProcessingStage.ENHANCED_OVERVIEW,
        ProcessingStage.CLAUSES_ANALYSIS,
        ProcessingStage.RATES_ANALYSIS,
        ProcessingStage.RISK_ASSESSMENT,
        ProcessingStage.COMPLIANCE_CHECK,
        ProcessingStage.BENCHMARK_ANALYSIS,
        ProcessingStage.ARTIFACT_GENERATION,
        ProcessingStage.INDEXATION
      ];
      
      stages.forEach(stage => {
        progressTrackingService.completeStage(testContractId, stage);
      });
      
      expect(mockListener).toHaveBeenCalledOnce();
      
      progressTrackingService.off('completed', mockListener);
    });

    it('should set progress to 100% when completed', () => {
      // Complete all stages to reach completion
      const stages = [
        ProcessingStage.UPLOAD_VALIDATION,
        ProcessingStage.FILE_EXTRACTION,
        ProcessingStage.CONTENT_ANALYSIS,
        ProcessingStage.TEMPLATE_ANALYSIS,
        ProcessingStage.FINANCIAL_ANALYSIS,
        ProcessingStage.ENHANCED_OVERVIEW,
        ProcessingStage.CLAUSES_ANALYSIS,
        ProcessingStage.RATES_ANALYSIS,
        ProcessingStage.RISK_ASSESSMENT,
        ProcessingStage.COMPLIANCE_CHECK,
        ProcessingStage.BENCHMARK_ANALYSIS,
        ProcessingStage.ARTIFACT_GENERATION,
        ProcessingStage.INDEXATION
      ];
      
      let result;
      stages.forEach(stage => {
        result = progressTrackingService.completeStage(testContractId, stage);
      });
      
      expect(result!.progress).toBe(100);
      expect(result!.stage).toBe(ProcessingStage.COMPLETED);
      expect(result!.estimatedTimeRemaining).toBe(0);
    });
  });

  describe('addError', () => {
    beforeEach(() => {
      progressTrackingService.initializeProgress(testContractId, testTenantId);
    });

    it('should add recoverable error', () => {
      const result = progressTrackingService.addError(
        testContractId,
        ProcessingStage.FILE_EXTRACTION,
        'Temporary extraction error',
        true,
        1
      );
      
      expect(result).toBeDefined();
      expect(result!.errors).toHaveLength(1);
      expect(result!.errors![0].error).toBe('Temporary extraction error');
      expect(result!.errors![0].recoverable).toBe(true);
      expect(result!.errors![0].retryCount).toBe(1);
    });

    it('should mark as failed for non-recoverable errors', () => {
      const result = progressTrackingService.addError(
        testContractId,
        ProcessingStage.FILE_EXTRACTION,
        'Critical extraction error',
        false
      );
      
      expect(result!.stage).toBe(ProcessingStage.FAILED);
      expect(result!.progress).toBe(0);
      expect(result!.estimatedTimeRemaining).toBe(0);
    });

    it('should emit error event', () => {
      const mockListener = vi.fn();
      progressTrackingService.on('error', mockListener);
      
      progressTrackingService.addError(
        testContractId,
        ProcessingStage.FILE_EXTRACTION,
        'Test error',
        true
      );
      
      expect(mockListener).toHaveBeenCalledOnce();
      
      progressTrackingService.off('error', mockListener);
    });

    it('should emit failed event for non-recoverable errors', () => {
      const mockListener = vi.fn();
      progressTrackingService.on('failed', mockListener);
      
      progressTrackingService.addError(
        testContractId,
        ProcessingStage.FILE_EXTRACTION,
        'Critical error',
        false
      );
      
      expect(mockListener).toHaveBeenCalledOnce();
      
      progressTrackingService.off('failed', mockListener);
    });
  });

  describe('getProgress', () => {
    it('should return progress for existing contract', () => {
      progressTrackingService.initializeProgress(testContractId, testTenantId);
      
      const progress = progressTrackingService.getProgress(testContractId);
      
      expect(progress).toBeDefined();
      expect(progress!.contractId).toBe(testContractId);
    });

    it('should return null for non-existent contract', () => {
      const progress = progressTrackingService.getProgress('non-existent');
      
      expect(progress).toBeNull();
    });
  });

  describe('getTenantProgress', () => {
    it('should return all progress for a tenant', () => {
      const contract1 = 'contract-1';
      const contract2 = 'contract-2';
      const otherTenant = 'other-tenant';
      
      progressTrackingService.initializeProgress(contract1, testTenantId);
      progressTrackingService.initializeProgress(contract2, testTenantId);
      progressTrackingService.initializeProgress('contract-3', otherTenant);
      
      const tenantProgress = progressTrackingService.getTenantProgress(testTenantId);
      
      expect(tenantProgress).toHaveLength(2);
      expect(tenantProgress.every(p => p.tenantId === testTenantId)).toBe(true);
    });

    it('should return empty array for tenant with no contracts', () => {
      const tenantProgress = progressTrackingService.getTenantProgress('empty-tenant');
      
      expect(tenantProgress).toHaveLength(0);
    });
  });

  describe('stage dependencies', () => {
    beforeEach(() => {
      progressTrackingService.initializeProgress(testContractId, testTenantId);
    });

    it('should respect stage dependencies', () => {
      // Complete upload validation
      progressTrackingService.completeStage(testContractId, ProcessingStage.UPLOAD_VALIDATION);
      
      // Should advance to file extraction
      const progress = progressTrackingService.getProgress(testContractId);
      expect(progress!.stage).toBe(ProcessingStage.FILE_EXTRACTION);
      
      // Complete file extraction
      progressTrackingService.completeStage(testContractId, ProcessingStage.FILE_EXTRACTION);
      
      // Should advance to content analysis
      const progress2 = progressTrackingService.getProgress(testContractId);
      expect(progress2!.stage).toBe(ProcessingStage.CONTENT_ANALYSIS);
    });
  });
});