/**
 * Unit tests for Upload Error Handler Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  uploadErrorHandlerService, 
  ErrorCategory, 
  ErrorSeverity, 
  RecoveryAction 
} from '../upload-error-handler.service';

describe('UploadErrorHandlerService', () => {
  const testContractId = 'test-contract-123';
  const testContext = { contractId: testContractId, operation: 'test' };
  const testCorrelationId = 'corr-123';

  beforeEach(() => {
    // Reset retry counts
    uploadErrorHandlerService.resetRetryCount(testContractId);
  });

  describe('handleError', () => {
    it('should handle validation errors', async () => {
      const validationError = new Error('Invalid file type: application/exe');
      
      const result = await uploadErrorHandlerService.handleError(
        validationError,
        testContext,
        testCorrelationId
      );
      
      expect(result.success).toBe(false);
      expect(result.action).toBe(RecoveryAction.ABORT);
      expect(result.message).toContain('supported file format');
    });

    it('should handle network errors with retry', async () => {
      const networkError = new Error('Network timeout occurred');
      
      const result = await uploadErrorHandlerService.handleError(
        networkError,
        testContext,
        testCorrelationId
      );
      
      expect(result.success).toBe(false);
      expect(result.action).toBe(RecoveryAction.RETRY);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should handle storage errors with retry', async () => {
      const storageError = new Error('S3 bucket unavailable');
      
      const result = await uploadErrorHandlerService.handleError(
        storageError,
        testContext,
        testCorrelationId
      );
      
      expect(result.success).toBe(false);
      expect(result.action).toBe(RecoveryAction.RETRY);
      expect(result.retryAfter).toBeDefined();
    });

    it('should handle security violations with immediate abort', async () => {
      const securityError = new Error('Malware detected in file');
      
      const result = await uploadErrorHandlerService.handleError(
        securityError,
        testContext,
        testCorrelationId
      );
      
      expect(result.success).toBe(false);
      expect(result.action).toBe(RecoveryAction.ABORT);
      expect(result.message).toContain('Security violation');
    });

    it('should handle quota exceeded errors', async () => {
      const quotaError = new Error('Upload quota exceeded for tenant');
      
      const result = await uploadErrorHandlerService.handleError(
        quotaError,
        testContext,
        testCorrelationId
      );
      
      expect(result.success).toBe(false);
      expect(result.action).toBe(RecoveryAction.MANUAL_INTERVENTION);
      expect(result.message).toContain('Quota exceeded');
    });

    it('should handle processing errors with fallback', async () => {
      const processingError = new Error('Processing pipeline failed');
      
      const result = await uploadErrorHandlerService.handleError(
        processingError,
        testContext,
        testCorrelationId
      );
      
      expect(result.success).toBe(true);
      expect(result.action).toBe(RecoveryAction.FALLBACK);
      expect(result.fallbackData).toBeDefined();
    });
  });

  describe('retry logic', () => {
    it('should increment retry count on retryable errors', async () => {
      const networkError = new Error('Network timeout');
      
      // First attempt
      await uploadErrorHandlerService.handleError(networkError, testContext);
      expect(uploadErrorHandlerService.getRetryCount(testContractId)).toBe(1);
      
      // Second attempt
      await uploadErrorHandlerService.handleError(networkError, testContext);
      expect(uploadErrorHandlerService.getRetryCount(testContractId)).toBe(2);
    });

    it('should stop retrying after max attempts', async () => {
      const networkError = new Error('Network timeout');
      
      // Exhaust retry attempts
      for (let i = 0; i < 3; i++) {
        await uploadErrorHandlerService.handleError(networkError, testContext);
      }
      
      // Next attempt should not retry
      const result = await uploadErrorHandlerService.handleError(networkError, testContext);
      
      expect(result.action).toBe(RecoveryAction.MANUAL_INTERVENTION);
    });

    it('should calculate exponential backoff delay', async () => {
      const networkError = new Error('Network timeout');
      
      const result1 = await uploadErrorHandlerService.handleError(networkError, testContext);
      const result2 = await uploadErrorHandlerService.handleError(networkError, testContext);
      
      expect(result2.retryAfter).toBeGreaterThan(result1.retryAfter!);
    });

    it('should reset retry count', () => {
      uploadErrorHandlerService['retryAttempts'].set(testContractId, 5);
      
      uploadErrorHandlerService.resetRetryCount(testContractId);
      
      expect(uploadErrorHandlerService.getRetryCount(testContractId)).toBe(0);
    });
  });

  describe('error classification', () => {
    it('should classify file validation errors correctly', async () => {
      const fileError = new Error('Invalid file size exceeds limit');
      
      const result = await uploadErrorHandlerService.handleError(fileError, testContext);
      
      expect(result.action).toBe(RecoveryAction.ABORT);
      expect(result.message).toContain('file size');
    });

    it('should classify network errors correctly', async () => {
      const networkError = new Error('ECONNRESET: Connection reset by peer');
      
      const result = await uploadErrorHandlerService.handleError(networkError, testContext);
      
      expect(result.action).toBe(RecoveryAction.RETRY);
    });

    it('should classify security errors correctly', async () => {
      const securityError = new Error('Suspicious content detected');
      
      const result = await uploadErrorHandlerService.handleError(securityError, testContext);
      
      expect(result.action).toBe(RecoveryAction.ABORT);
    });
  });

  describe('validation guidance', () => {
    it('should provide specific guidance for file type errors', async () => {
      const fileTypeError = new Error('Unsupported file format detected');
      
      const result = await uploadErrorHandlerService.handleError(fileTypeError, testContext);
      
      expect(result.message).toContain('supported file format');
      expect(result.message).toContain('PDF, DOC, DOCX');
    });

    it('should provide specific guidance for file size errors', async () => {
      const fileSizeError = new Error('File size too large for processing');
      
      const result = await uploadErrorHandlerService.handleError(fileSizeError, testContext);
      
      expect(result.message).toContain('250MB');
      expect(result.message).toContain('compress');
    });

    it('should provide specific guidance for filename errors', async () => {
      const filenameError = new Error('Invalid filename characters detected');
      
      const result = await uploadErrorHandlerService.handleError(filenameError, testContext);
      
      expect(result.message).toContain('invalid characters');
      expect(result.message).toContain('letters, numbers');
    });

    it('should provide specific guidance for corrupted files', async () => {
      const corruptedError = new Error('File checksum validation failed');
      
      const result = await uploadErrorHandlerService.handleError(corruptedError, testContext);
      
      expect(result.message).toContain('corrupted');
      expect(result.message).toContain('try again');
    });
  });

  describe('fallback data generation', () => {
    it('should generate appropriate fallback data', async () => {
      const processingError = new Error('LLM processing failed');
      
      const result = await uploadErrorHandlerService.handleError(processingError, testContext);
      
      expect(result.fallbackData).toBeDefined();
      expect(result.fallbackData.processingMethod).toBe('fallback');
      expect(result.fallbackData.confidence).toBe(0.5);
      expect(result.fallbackData.context.fallbackUsed).toBe(true);
    });
  });

  describe('user message creation', () => {
    it('should create user-friendly messages', () => {
      const mockError = {
        code: 'VALIDATION_ERROR',
        message: 'File validation failed',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        recoverable: false,
        retryable: false,
        context: {},
        timestamp: new Date()
      };
      
      const mockRecovery = {
        success: false,
        action: RecoveryAction.ABORT,
        message: 'Please upload a supported file format.'
      };
      
      const userMessage = uploadErrorHandlerService.createUserMessage(mockError, mockRecovery);
      
      expect(userMessage).toContain('⚠️');
      expect(userMessage).toContain('Please upload a supported file format.');
    });

    it('should include retry timing in messages', () => {
      const mockError = {
        code: 'NETWORK_ERROR',
        message: 'Network timeout',
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        retryable: true,
        context: {},
        timestamp: new Date()
      };
      
      const mockRecovery = {
        success: false,
        action: RecoveryAction.RETRY,
        message: 'Retrying in 5 seconds...',
        retryAfter: 5000
      };
      
      const userMessage = uploadErrorHandlerService.createUserMessage(mockError, mockRecovery);
      
      expect(userMessage).toContain('5 seconds');
    });
  });

  describe('technical details creation', () => {
    it('should create comprehensive technical details', () => {
      const mockError = {
        code: 'PROCESSING_ERROR',
        message: 'Processing failed',
        category: ErrorCategory.PROCESSING,
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        retryable: true,
        context: testContext,
        timestamp: new Date(),
        correlationId: testCorrelationId
      };
      
      const details = uploadErrorHandlerService.createTechnicalDetails(mockError, testContext);
      
      expect(details.errorCode).toBe('PROCESSING_ERROR');
      expect(details.category).toBe(ErrorCategory.PROCESSING);
      expect(details.severity).toBe(ErrorSeverity.MEDIUM);
      expect(details.correlationId).toBe(testCorrelationId);
      expect(details.context).toEqual(testContext);
    });
  });
});