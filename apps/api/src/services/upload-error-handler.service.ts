/**
 * Upload Error Handler Service
 * Provides comprehensive error handling and recovery for upload operations
 */

import pino from 'pino';
import { circuitBreakerManager } from './circuit-breaker.service';
import { progressTrackingService, ProcessingStage } from './progress-tracking.service';

const logger = pino({ name: 'upload-error-handler' });

export interface UploadError {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  retryable: boolean;
  context: Record<string, any>;
  timestamp: Date;
  correlationId?: string;
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  NETWORK = 'network',
  STORAGE = 'storage',
  PROCESSING = 'processing',
  SECURITY = 'security',
  QUOTA = 'quota',
  SYSTEM = 'system'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface RecoveryResult {
  success: boolean;
  action: RecoveryAction;
  message: string;
  retryAfter?: number;
  fallbackData?: any;
  circuitBreakerUsed?: boolean;
  progressUpdated?: boolean;
}

export enum RecoveryAction {
  RETRY = 'retry',
  RETRY_WITH_BACKOFF = 'retry_with_backoff',
  FALLBACK = 'fallback',
  CIRCUIT_BREAKER_OPEN = 'circuit_breaker_open',
  MANUAL_INTERVENTION = 'manual_intervention',
  ABORT = 'abort'
}

export class UploadErrorHandlerService {
  private readonly defaultRetryPolicy: RetryPolicy = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      'NETWORK_TIMEOUT',
      'STORAGE_UNAVAILABLE',
      'TEMPORARY_PROCESSING_ERROR',
      'RATE_LIMIT_EXCEEDED',
      'SERVICE_UNAVAILABLE'
    ]
  };

  private retryAttempts = new Map<string, number>();
  private retryTimestamps = new Map<string, Date[]>();
  private errorHistory = new Map<string, UploadError[]>();

  /**
   * Handle upload errors with classification and recovery
   */
  async handleError(
    error: Error | UploadError,
    context: Record<string, any>,
    correlationId?: string
  ): Promise<RecoveryResult> {
    const uploadError = this.classifyError(error, context, correlationId);
    const contractId = context.contractId || context.docId || 'unknown';
    
    // Store error in history
    this.addToErrorHistory(contractId, uploadError);
    
    logger.error({
      error: uploadError,
      context,
      correlationId
    }, 'Upload error occurred');

    // Update progress tracking with error
    await this.updateProgressWithError(contractId, context.tenantId, uploadError);

    // Check circuit breaker status
    const circuitBreakerResult = await this.checkCircuitBreaker(uploadError, context);
    if (circuitBreakerResult) {
      return circuitBreakerResult;
    }

    // Determine recovery strategy
    const recoveryResult = await this.determineRecoveryStrategy(uploadError, context);
    
    // Execute recovery action
    await this.executeRecoveryAction(recoveryResult, uploadError, context);
    
    // Log recovery action
    logger.info({
      correlationId,
      action: recoveryResult.action,
      success: recoveryResult.success,
      retryAfter: recoveryResult.retryAfter,
      circuitBreakerUsed: recoveryResult.circuitBreakerUsed
    }, 'Recovery strategy determined');

    return recoveryResult;
  }

  /**
   * Classify error into structured format
   */
  private classifyError(
    error: Error | UploadError,
    context: Record<string, any>,
    correlationId?: string
  ): UploadError {
    // If already classified, return as-is
    if (this.isUploadError(error)) {
      return error;
    }

    const message = error.message || 'Unknown error';
    let category = ErrorCategory.SYSTEM;
    let severity = ErrorSeverity.MEDIUM;
    let code = 'UNKNOWN_ERROR';
    let recoverable = true;
    let retryable = false;

    // Classify based on error message and type
    if (message.includes('file') || message.includes('validation')) {
      category = ErrorCategory.VALIDATION;
      severity = ErrorSeverity.LOW;
      code = 'VALIDATION_ERROR';
      recoverable = true;
      retryable = false;
    } else if (message.includes('network') || message.includes('timeout') || message.includes('ECONNRESET')) {
      category = ErrorCategory.NETWORK;
      severity = ErrorSeverity.MEDIUM;
      code = 'NETWORK_ERROR';
      recoverable = true;
      retryable = true;
    } else if (message.includes('storage') || message.includes('S3') || message.includes('bucket')) {
      category = ErrorCategory.STORAGE;
      severity = ErrorSeverity.HIGH;
      code = 'STORAGE_ERROR';
      recoverable = true;
      retryable = true;
    } else if (message.includes('quota') || message.includes('limit') || message.includes('exceeded')) {
      category = ErrorCategory.QUOTA;
      severity = ErrorSeverity.HIGH;
      code = 'QUOTA_EXCEEDED';
      recoverable = false;
      retryable = false;
    } else if (message.includes('security') || message.includes('malware') || message.includes('suspicious')) {
      category = ErrorCategory.SECURITY;
      severity = ErrorSeverity.CRITICAL;
      code = 'SECURITY_VIOLATION';
      recoverable = false;
      retryable = false;
    } else if (message.includes('processing') || message.includes('analysis')) {
      category = ErrorCategory.PROCESSING;
      severity = ErrorSeverity.MEDIUM;
      code = 'PROCESSING_ERROR';
      recoverable = true;
      retryable = true;
    }

    return {
      code,
      message,
      category,
      severity,
      recoverable,
      retryable,
      context,
      timestamp: new Date(),
      correlationId
    };
  }

  /**
   * Determine recovery strategy based on error
   */
  private async determineRecoveryStrategy(
    error: UploadError,
    context: Record<string, any>
  ): Promise<RecoveryResult> {
    const contractId = context.contractId || context.docId || 'unknown';
    const currentRetries = this.retryAttempts.get(contractId) || 0;

    // Security violations - immediate abort
    if (error.category === ErrorCategory.SECURITY) {
      return {
        success: false,
        action: RecoveryAction.ABORT,
        message: 'Security violation detected. Upload aborted for safety.',
      };
    }

    // Quota exceeded - manual intervention required
    if (error.category === ErrorCategory.QUOTA) {
      return {
        success: false,
        action: RecoveryAction.MANUAL_INTERVENTION,
        message: 'Quota exceeded. Please contact administrator or upgrade plan.',
      };
    }

    // Validation errors - provide guidance
    if (error.category === ErrorCategory.VALIDATION) {
      return {
        success: false,
        action: RecoveryAction.ABORT,
        message: this.getValidationGuidance(error),
      };
    }

    // Retryable errors
    if (error.retryable && currentRetries < this.defaultRetryPolicy.maxRetries) {
      const retryDelay = this.calculateRetryDelay(currentRetries);
      this.retryAttempts.set(contractId, currentRetries + 1);
      
      return {
        success: false,
        action: RecoveryAction.RETRY,
        message: `Temporary error. Retrying in ${Math.round(retryDelay / 1000)} seconds... (Attempt ${currentRetries + 1}/${this.defaultRetryPolicy.maxRetries})`,
        retryAfter: retryDelay
      };
    }

    // Fallback for processing errors
    if (error.category === ErrorCategory.PROCESSING && error.recoverable) {
      return {
        success: true,
        action: RecoveryAction.FALLBACK,
        message: 'Using fallback processing method due to processing error.',
        fallbackData: this.generateFallbackData(context)
      };
    }

    // Default to manual intervention for unrecoverable errors
    return {
      success: false,
      action: RecoveryAction.MANUAL_INTERVENTION,
      message: 'Manual intervention required. Please contact support with the error details.',
    };
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const delay = this.defaultRetryPolicy.baseDelayMs * 
      Math.pow(this.defaultRetryPolicy.backoffMultiplier, retryCount);
    
    return Math.min(delay, this.defaultRetryPolicy.maxDelayMs);
  }

  /**
   * Get validation guidance based on error
   */
  private getValidationGuidance(error: UploadError): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('file type') || message.includes('format')) {
      return 'Please upload a supported file format: PDF, DOC, DOCX, TXT, or RTF.';
    }
    
    if (message.includes('size') || message.includes('large')) {
      return 'File size exceeds the maximum limit of 250MB. Please compress or split the file.';
    }
    
    if (message.includes('filename') || message.includes('characters')) {
      return 'Filename contains invalid characters. Please use only letters, numbers, spaces, hyphens, and underscores.';
    }
    
    if (message.includes('corrupted') || message.includes('checksum')) {
      return 'File appears to be corrupted. Please try uploading the file again.';
    }
    
    return 'File validation failed. Please check the file and try again.';
  }

  /**
   * Generate fallback data for processing errors
   */
  private generateFallbackData(context: Record<string, any>): any {
    return {
      processingMethod: 'fallback',
      confidence: 0.5,
      message: 'Processed using fallback method due to primary processing failure',
      timestamp: new Date(),
      context: {
        originalError: true,
        fallbackUsed: true
      }
    };
  }

  /**
   * Check if error is already classified
   */
  private isUploadError(error: any): error is UploadError {
    return error && 
           typeof error.code === 'string' &&
           typeof error.category === 'string' &&
           typeof error.severity === 'string';
  }

  /**
   * Reset retry count for a contract
   */
  resetRetryCount(contractId: string): void {
    this.retryAttempts.delete(contractId);
  }

  /**
   * Get retry count for a contract
   */
  getRetryCount(contractId: string): number {
    return this.retryAttempts.get(contractId) || 0;
  }

  /**
   * Create user-friendly error message
   */
  createUserMessage(error: UploadError, recoveryResult: RecoveryResult): string {
    let message = '';
    
    switch (error.severity) {
      case ErrorSeverity.LOW:
        message = '⚠️ ';
        break;
      case ErrorSeverity.MEDIUM:
        message = '⚠️ ';
        break;
      case ErrorSeverity.HIGH:
        message = '❌ ';
        break;
      case ErrorSeverity.CRITICAL:
        message = '🚨 ';
        break;
    }
    
    message += recoveryResult.message;
    
    if (recoveryResult.action === RecoveryAction.RETRY && recoveryResult.retryAfter) {
      message += ` Please wait ${Math.round(recoveryResult.retryAfter / 1000)} seconds before the next attempt.`;
    }
    
    return message;
  }

  /**
   * Create technical error details for logging
   */
  createTechnicalDetails(error: UploadError, context: Record<string, any>): Record<string, any> {
    return {
      errorCode: error.code,
      category: error.category,
      severity: error.severity,
      recoverable: error.recoverable,
      retryable: error.retryable,
      timestamp: error.timestamp,
      correlationId: error.correlationId,
      context,
      stackTrace: error.message,
      retryCount: this.getRetryCount(context.contractId || context.docId || 'unknown')
    };
  }

  /**
   * Add error to history for pattern analysis
   */
  private addToErrorHistory(contractId: string, error: UploadError): void {
    if (!this.errorHistory.has(contractId)) {
      this.errorHistory.set(contractId, []);
    }
    
    const history = this.errorHistory.get(contractId)!;
    history.push(error);
    
    // Keep only last 10 errors
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * Update progress tracking with error information
   */
  private async updateProgressWithError(
    contractId: string, 
    tenantId: string, 
    error: UploadError
  ): Promise<void> {
    try {
      if (tenantId && contractId !== 'unknown') {
        const stage = this.mapErrorToStage(error);
        progressTrackingService.addError(
          contractId,
          stage,
          error.message,
          error.recoverable,
          this.getRetryCount(contractId)
        );
      }
    } catch (err) {
      logger.warn({ err, contractId }, 'Failed to update progress with error');
    }
  }

  /**
   * Map error to processing stage
   */
  private mapErrorToStage(error: UploadError): ProcessingStage {
    switch (error.category) {
      case ErrorCategory.VALIDATION:
        return ProcessingStage.UPLOAD_VALIDATION;
      case ErrorCategory.STORAGE:
        return ProcessingStage.FILE_EXTRACTION;
      case ErrorCategory.PROCESSING:
        return ProcessingStage.CONTENT_ANALYSIS;
      default:
        return ProcessingStage.UPLOAD_VALIDATION;
    }
  }

  /**
   * Check circuit breaker status for service calls
   */
  private async checkCircuitBreaker(
    error: UploadError, 
    context: Record<string, any>
  ): Promise<RecoveryResult | null> {
    const serviceName = this.getServiceName(error, context);
    if (!serviceName) return null;

    try {
      // Test circuit breaker status
      await circuitBreakerManager.execute(serviceName, async () => {
        // Just a health check, don't actually do anything
        return Promise.resolve();
      });
      
      return null; // Circuit breaker is closed, continue normal processing
    } catch (circuitError) {
      logger.warn({ 
        serviceName, 
        error: circuitError.message 
      }, 'Circuit breaker is open');
      
      return {
        success: false,
        action: RecoveryAction.CIRCUIT_BREAKER_OPEN,
        message: `Service ${serviceName} is temporarily unavailable. Please try again later.`,
        retryAfter: 60000, // 1 minute
        circuitBreakerUsed: true
      };
    }
  }

  /**
   * Get service name for circuit breaker
   */
  private getServiceName(error: UploadError, context: Record<string, any>): string | null {
    if (error.category === ErrorCategory.STORAGE) {
      return 'storage-service';
    }
    if (error.category === ErrorCategory.PROCESSING) {
      return 'processing-service';
    }
    if (error.category === ErrorCategory.NETWORK) {
      return context.operation || 'network-service';
    }
    return null;
  }

  /**
   * Execute recovery action
   */
  private async executeRecoveryAction(
    recoveryResult: RecoveryResult,
    error: UploadError,
    context: Record<string, any>
  ): Promise<void> {
    const contractId = context.contractId || context.docId || 'unknown';

    switch (recoveryResult.action) {
      case RecoveryAction.RETRY:
      case RecoveryAction.RETRY_WITH_BACKOFF:
        this.scheduleRetry(contractId, recoveryResult.retryAfter || 1000);
        break;
        
      case RecoveryAction.FALLBACK:
        await this.activateFallbackMode(contractId, context);
        break;
        
      case RecoveryAction.ABORT:
        await this.abortProcessing(contractId, context, error);
        break;
        
      case RecoveryAction.MANUAL_INTERVENTION:
        await this.requestManualIntervention(contractId, context, error);
        break;
    }
  }

  /**
   * Schedule retry with exponential backoff
   */
  private scheduleRetry(contractId: string, delay: number): void {
    const timestamps = this.retryTimestamps.get(contractId) || [];
    timestamps.push(new Date());
    this.retryTimestamps.set(contractId, timestamps);
    
    logger.info({ 
      contractId, 
      delay, 
      retryCount: this.getRetryCount(contractId) 
    }, 'Retry scheduled');
  }

  /**
   * Activate fallback processing mode
   */
  private async activateFallbackMode(contractId: string, context: Record<string, any>): Promise<void> {
    try {
      if (context.tenantId && contractId !== 'unknown') {
        progressTrackingService.updateProgress(
          contractId,
          ProcessingStage.CONTENT_ANALYSIS,
          50,
          'Activating fallback processing mode...',
          { fallbackMode: true }
        );
      }
      
      logger.info({ contractId }, 'Fallback mode activated');
    } catch (err) {
      logger.warn({ err, contractId }, 'Failed to activate fallback mode');
    }
  }

  /**
   * Abort processing and clean up
   */
  private async abortProcessing(
    contractId: string, 
    context: Record<string, any>, 
    error: UploadError
  ): Promise<void> {
    try {
      if (context.tenantId && contractId !== 'unknown') {
        progressTrackingService.addError(
          contractId,
          ProcessingStage.FAILED,
          `Processing aborted: ${error.message}`,
          false
        );
      }
      
      // Clean up resources
      this.resetRetryCount(contractId);
      this.errorHistory.delete(contractId);
      this.retryTimestamps.delete(contractId);
      
      logger.info({ contractId, reason: error.message }, 'Processing aborted');
    } catch (err) {
      logger.warn({ err, contractId }, 'Failed to abort processing cleanly');
    }
  }

  /**
   * Request manual intervention
   */
  private async requestManualIntervention(
    contractId: string, 
    context: Record<string, any>, 
    error: UploadError
  ): Promise<void> {
    try {
      if (context.tenantId && contractId !== 'unknown') {
        progressTrackingService.updateProgress(
          contractId,
          ProcessingStage.FAILED,
          0,
          'Manual intervention required. Please contact support.',
          { 
            requiresIntervention: true,
            errorCode: error.code,
            severity: error.severity
          }
        );
      }
      
      // In production, this would trigger alerts to support team
      logger.error({ 
        contractId, 
        error: error.code, 
        severity: error.severity 
      }, 'Manual intervention requested');
      
    } catch (err) {
      logger.warn({ err, contractId }, 'Failed to request manual intervention');
    }
  }

  /**
   * Analyze error patterns for a contract
   */
  getErrorPattern(contractId: string): {
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    recentErrors: UploadError[];
    isRepeatingPattern: boolean;
  } {
    const history = this.errorHistory.get(contractId) || [];
    const errorsByCategory: Record<string, number> = {};
    
    history.forEach(error => {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
    });
    
    // Check for repeating patterns (same error type in last 3 attempts)
    const recentErrors = history.slice(-3);
    const isRepeatingPattern = recentErrors.length >= 3 && 
      recentErrors.every(error => error.code === recentErrors[0].code);
    
    return {
      totalErrors: history.length,
      errorsByCategory,
      recentErrors: history.slice(-5), // Last 5 errors
      isRepeatingPattern
    };
  }

  /**
   * Get retry statistics for a contract
   */
  getRetryStats(contractId: string): {
    retryCount: number;
    retryTimestamps: Date[];
    averageRetryInterval: number;
    lastRetryTime?: Date;
  } {
    const timestamps = this.retryTimestamps.get(contractId) || [];
    const retryCount = this.getRetryCount(contractId);
    
    let averageRetryInterval = 0;
    if (timestamps.length > 1) {
      const intervals = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i].getTime() - timestamps[i - 1].getTime());
      }
      averageRetryInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    }
    
    return {
      retryCount,
      retryTimestamps: timestamps,
      averageRetryInterval,
      lastRetryTime: timestamps[timestamps.length - 1]
    };
  }

  /**
   * Clean up old retry attempts and error history
   */
  cleanup(maxAgeHours: number = 24): void {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let cleaned = 0;
    
    // Clean up retry attempts
    const retrySize = this.retryAttempts.size;
    this.retryAttempts.clear();
    
    // Clean up retry timestamps
    for (const [contractId, timestamps] of this.retryTimestamps.entries()) {
      const recentTimestamps = timestamps.filter(ts => ts > cutoff);
      if (recentTimestamps.length === 0) {
        this.retryTimestamps.delete(contractId);
        cleaned++;
      } else {
        this.retryTimestamps.set(contractId, recentTimestamps);
      }
    }
    
    // Clean up error history
    for (const [contractId, errors] of this.errorHistory.entries()) {
      const recentErrors = errors.filter(error => error.timestamp > cutoff);
      if (recentErrors.length === 0) {
        this.errorHistory.delete(contractId);
        cleaned++;
      } else {
        this.errorHistory.set(contractId, recentErrors);
      }
    }
    
    if (retrySize > 0 || cleaned > 0) {
      logger.info({ 
        retryAttempts: retrySize, 
        cleanedContracts: cleaned, 
        maxAgeHours 
      }, 'Cleaned up error handling data');
    }
  }
}

export const uploadErrorHandlerService = new UploadErrorHandlerService();

// Clean up old retry attempts every hour
setInterval(() => {
  uploadErrorHandlerService.cleanup();
}, 60 * 60 * 1000);