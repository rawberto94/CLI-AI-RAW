/**
 * Human Validation & Editing System
 * Provides interfaces for human review, validation, and editing of extracted contract data
 */

import { EventEmitter } from 'events';

export interface ValidationRequest {
  id: string;
  documentId: string;
  tenantId: string;
  workerId: string;
  extractedData: any;
  confidence: number;
  requiresValidation: boolean;
  validationType: 'accuracy' | 'completeness' | 'interpretation' | 'all';
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedTo?: string;
  dueDate?: Date;
  createdAt: Date;
  status: 'pending' | 'in-review' | 'approved' | 'rejected' | 'edited';
}

export interface ValidationResult {
  validationRequestId: string;
  reviewerId: string;
  action: 'approve' | 'reject' | 'edit';
  accuracy: number; // 0-1 scale
  completeness: number; // 0-1 scale
  editedData?: any;
  feedback: string;
  corrections: FieldCorrection[];
  confidence: number;
  reviewTime: number;
  reviewedAt: Date;
}

export interface FieldCorrection {
  fieldPath: string;
  originalValue: any;
  correctedValue: any;
  reason: string;
  confidence: number;
}

export interface EditSession {
  sessionId: string;
  documentId: string;
  userId: string;
  workerId: string;
  originalData: any;
  currentData: any;
  changes: FieldChange[];
  status: 'active' | 'saved' | 'cancelled';
  startedAt: Date;
  lastModified: Date;
  autoSaveEnabled: boolean;
}

export interface FieldChange {
  timestamp: Date;
  fieldPath: string;
  oldValue: any;
  newValue: any;
  changeType: 'create' | 'update' | 'delete';
  reason?: string;
}

export interface ValidationMetrics {
  documentId: string;
  overallAccuracy: number;
  workerAccuracyBreakdown: WorkerAccuracy[];
  commonErrors: ErrorPattern[];
  reviewTimeMetrics: ReviewTimeMetric[];
  confidenceCalibration: ConfidenceCalibration;
  improvementSuggestions: ImprovementSuggestion[];
}

export interface WorkerAccuracy {
  workerId: string;
  accuracy: number;
  sampleSize: number;
  commonErrors: string[];
  confidenceReliability: number;
}

export interface ErrorPattern {
  pattern: string;
  frequency: number;
  workersAffected: string[];
  suggestedFix: string;
}

export interface ReviewTimeMetric {
  workerId: string;
  averageReviewTime: number;
  complexityFactor: number;
  reviewerExperience: string;
}

export interface ConfidenceCalibration {
  overconfident: boolean;
  underconfident: boolean;
  calibrationScore: number;
  recommendations: string[];
}

export interface ImprovementSuggestion {
  category: 'data-quality' | 'workflow' | 'training' | 'automation';
  suggestion: string;
  expectedImpact: 'high' | 'medium' | 'low';
  implementationEffort: 'low' | 'medium' | 'high';
}

export class HumanValidationSystem extends EventEmitter {
  private validationRequests: Map<string, ValidationRequest> = new Map();
  private editSessions: Map<string, EditSession> = new Map();
  private validationResults: Map<string, ValidationResult> = new Map();
  private validationMetrics: Map<string, ValidationMetrics> = new Map();

  constructor() {
    super();
    this.setupValidationThresholds();
  }

  /**
   * Evaluate if extraction requires human validation
   */
  evaluateValidationNeed(
    documentId: string,
    workerId: string,
    extractedData: any,
    confidence: number,
    metadata?: any
  ): ValidationRequest | null {
    const requiresValidation = this.determineValidationNeed(workerId, confidence, extractedData, metadata);
    
    if (!requiresValidation.needed) {
      return null;
    }

    const validationRequest: ValidationRequest = {
      id: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      documentId,
      tenantId: metadata?.tenantId || 'default',
      workerId,
      extractedData,
      confidence,
      requiresValidation: true,
      validationType: requiresValidation.type,
      priority: requiresValidation.priority,
      assignedTo: this.assignReviewer(workerId, requiresValidation.priority),
      dueDate: this.calculateDueDate(requiresValidation.priority),
      createdAt: new Date(),
      status: 'pending'
    };

    this.validationRequests.set(validationRequest.id, validationRequest);
    this.emit('validationRequired', validationRequest);

    return validationRequest;
  }

  /**
   * Create editing session for human review
   */
  createEditSession(
    documentId: string,
    workerId: string,
    userId: string,
    extractedData: any
  ): EditSession {
    const sessionId = `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const editSession: EditSession = {
      sessionId,
      documentId,
      userId,
      workerId,
      originalData: JSON.parse(JSON.stringify(extractedData)),
      currentData: JSON.parse(JSON.stringify(extractedData)),
      changes: [],
      status: 'active',
      startedAt: new Date(),
      lastModified: new Date(),
      autoSaveEnabled: true
    };

    this.editSessions.set(sessionId, editSession);
    this.emit('editSessionStarted', editSession);

    return editSession;
  }

  /**
   * Update field in editing session
   */
  updateField(
    sessionId: string,
    fieldPath: string,
    newValue: any,
    reason?: string
  ): boolean {
    const session = this.editSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return false;
    }

    const oldValue = this.getNestedValue(session.currentData, fieldPath);
    
    // Apply the change
    this.setNestedValue(session.currentData, fieldPath, newValue);

    // Record the change
    const change: FieldChange = {
      timestamp: new Date(),
      fieldPath,
      oldValue,
      newValue,
      changeType: oldValue === undefined ? 'create' : 'update',
      reason
    };

    session.changes.push(change);
    session.lastModified = new Date();

    // Auto-save if enabled
    if (session.autoSaveEnabled) {
      this.autoSaveSession(session);
    }

    this.emit('fieldUpdated', { sessionId, change });
    return true;
  }

  /**
   * Submit validation result
   */
  submitValidationResult(
    validationRequestId: string,
    reviewerId: string,
    result: Omit<ValidationResult, 'validationRequestId' | 'reviewerId' | 'reviewedAt'>
  ): ValidationResult {
    const validationResult: ValidationResult = {
      validationRequestId,
      reviewerId,
      reviewedAt: new Date(),
      ...result
    };

    this.validationResults.set(validationRequestId, validationResult);

    // Update validation request status
    const request = this.validationRequests.get(validationRequestId);
    if (request) {
      request.status = result.action === 'approve' ? 'approved' : 
                     result.action === 'reject' ? 'rejected' : 'edited';
    }

    // Update validation metrics
    this.updateValidationMetrics(validationResult);

    this.emit('validationCompleted', validationResult);
    return validationResult;
  }

  /**
   * Get validation dashboard data
   */
  getValidationDashboard(tenantId: string): any {
    const requests = Array.from(this.validationRequests.values())
      .filter(r => r.tenantId === tenantId);

    const pendingRequests = requests.filter(r => r.status === 'pending');
    const inReviewRequests = requests.filter(r => r.status === 'in-review');
    const completedRequests = requests.filter(r => ['approved', 'rejected', 'edited'].includes(r.status));

    const criticalRequests = pendingRequests.filter(r => r.priority === 'critical');
    const overdueTasks = pendingRequests.filter(r => r.dueDate && r.dueDate < new Date());

    const workerAccuracy = this.calculateWorkerAccuracyStats(tenantId);
    const reviewTimeStats = this.calculateReviewTimeStats(tenantId);

    return {
      summary: {
        totalRequests: requests.length,
        pending: pendingRequests.length,
        inReview: inReviewRequests.length,
        completed: completedRequests.length,
        critical: criticalRequests.length,
        overdue: overdueTasks.length
      },
      workerAccuracy,
      reviewTimeStats,
      recentActivity: this.getRecentValidationActivity(tenantId),
      trends: this.getValidationTrends(tenantId)
    };
  }

  /**
   * Generate accuracy report for contract
   */
  generateAccuracyReport(documentId: string): ValidationMetrics {
    const documentValidations = Array.from(this.validationResults.values())
      .filter(r => {
        const request = this.validationRequests.get(r.validationRequestId);
        return request?.documentId === documentId;
      });

    const overallAccuracy = documentValidations.length > 0
      ? documentValidations.reduce((sum, v) => sum + v.accuracy, 0) / documentValidations.length
      : 0;

    const workerAccuracyBreakdown = this.calculateWorkerAccuracyBreakdown(documentValidations);
    const commonErrors = this.identifyCommonErrors(documentValidations);
    const reviewTimeMetrics = this.calculateReviewTimeMetrics(documentValidations);
    const confidenceCalibration = this.assessConfidenceCalibration(documentValidations);
    const improvementSuggestions = this.generateImprovementSuggestions(documentValidations);

    const metrics: ValidationMetrics = {
      documentId,
      overallAccuracy,
      workerAccuracyBreakdown,
      commonErrors,
      reviewTimeMetrics,
      confidenceCalibration,
      improvementSuggestions
    };

    this.validationMetrics.set(documentId, metrics);
    return metrics;
  }

  /**
   * Export validation data for analysis
   */
  exportValidationData(tenantId: string, format: 'json' | 'csv'): string {
    const requests = Array.from(this.validationRequests.values())
      .filter(r => r.tenantId === tenantId);
    
    const results = Array.from(this.validationResults.values())
      .filter(r => {
        const request = this.validationRequests.get(r.validationRequestId);
        return request?.tenantId === tenantId;
      });

    const exportData = {
      validationRequests: requests,
      validationResults: results,
      exportedAt: new Date(),
      summary: this.getValidationDashboard(tenantId)
    };

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else {
      return this.convertToCSV(exportData);
    }
  }

  async getPendingValidations(documentId: string, tenantId: string): Promise<ValidationRequest[]> {
    // Mock implementation
    return [];
  }

  async getCompletedValidations(documentId: string, tenantId: string): Promise<ValidationResult[]> {
    // Mock implementation
    return [];
  }

  async getValidationMetrics(documentId: string, tenantId: string): Promise<ValidationMetrics> {
    // Mock implementation
    return {
      documentId,
      overallAccuracy: 0,
      workerAccuracyBreakdown: [],
      commonErrors: [],
      reviewTimeMetrics: [],
      confidenceCalibration: {
        overconfident: false,
        underconfident: false,
        calibrationScore: 0,
        recommendations: [],
      },
      improvementSuggestions: [],
    };
  }

  // Private helper methods
  private determineValidationNeed(
    workerId: string,
    confidence: number,
    extractedData: any,
    metadata?: any
  ): { needed: boolean; type: ValidationRequest['validationType']; priority: ValidationRequest['priority'] } {
    // Critical workers always need validation for low confidence
    const criticalWorkers = ['financial', 'compliance', 'risk'];
    const isCriticalWorker = criticalWorkers.includes(workerId);

    // Low confidence threshold
    if (confidence < 0.7) {
      return {
        needed: true,
        type: 'accuracy',
        priority: isCriticalWorker ? 'critical' : 'high'
      };
    }

    // Medium confidence with complex data
    if (confidence < 0.85 && this.isComplexData(extractedData)) {
      return {
        needed: true,
        type: 'completeness',
        priority: 'medium'
      };
    }

    // High-value contracts always need review
    if (metadata?.contractValue && metadata.contractValue > 1000000) {
      return {
        needed: true,
        type: 'all',
        priority: 'high'
      };
    }

    // Critical workers with moderate confidence
    if (isCriticalWorker && confidence < 0.9) {
      return {
        needed: true,
        type: 'interpretation',
        priority: 'medium'
      };
    }

    return { needed: false, type: 'accuracy', priority: 'low' };
  }

  private isComplexData(data: any): boolean {
    if (typeof data !== 'object' || !data) return false;
    
    const complexity = JSON.stringify(data).length;
    const fieldCount = Object.keys(data).length;
    const hasNestedObjects = Object.values(data).some(v => typeof v === 'object' && v !== null);

    return complexity > 1000 || fieldCount > 10 || hasNestedObjects;
  }

  private assignReviewer(workerId: string, priority: ValidationRequest['priority']): string {
    // In production, this would use actual user assignment logic
    const reviewers = {
      financial: ['financial_expert_1', 'financial_expert_2'],
      legal: ['legal_expert_1', 'legal_expert_2'],
      compliance: ['compliance_expert_1'],
      default: ['general_reviewer_1', 'general_reviewer_2']
    };

    const workerReviewers = reviewers[workerId as keyof typeof reviewers] || reviewers.default;
    return workerReviewers[Math.floor(Math.random() * workerReviewers.length)];
  }

  private calculateDueDate(priority: ValidationRequest['priority']): Date {
    const now = new Date();
    const hours = {
      critical: 4,
      high: 24,
      medium: 72,
      low: 168
    };

    return new Date(now.getTime() + hours[priority] * 60 * 60 * 1000);
  }

  private setupValidationThresholds(): void {
    // Set up validation thresholds and rules
    console.log('Human validation system initialized');
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current)) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private autoSaveSession(session: EditSession): void {
    // Auto-save implementation
    console.log(`Auto-saving session ${session.sessionId}`);
  }

  private updateValidationMetrics(result: ValidationResult): void {
    // Update accuracy metrics based on validation result
    console.log(`Updating metrics for validation ${result.validationRequestId}`);
  }

  private calculateWorkerAccuracyStats(tenantId: string): WorkerAccuracy[] {
    // Calculate accuracy statistics by worker
    return [];
  }

  private calculateReviewTimeStats(tenantId: string): ReviewTimeMetric[] {
    // Calculate review time statistics
    return [];
  }

  private getRecentValidationActivity(tenantId: string): any[] {
    // Get recent validation activity
    return [];
  }

  private getValidationTrends(tenantId: string): any {
    // Calculate validation trends
    return {};
  }

  private calculateWorkerAccuracyBreakdown(validations: ValidationResult[]): WorkerAccuracy[] {
    // Calculate accuracy breakdown by worker
    return [];
  }

  private identifyCommonErrors(validations: ValidationResult[]): ErrorPattern[] {
    // Identify common error patterns
    return [];
  }

  private calculateReviewTimeMetrics(validations: ValidationResult[]): ReviewTimeMetric[] {
    // Calculate review time metrics
    return [];
  }

  private assessConfidenceCalibration(validations: ValidationResult[]): ConfidenceCalibration {
    // Assess confidence calibration
    return {
      overconfident: false,
      underconfident: false,
      calibrationScore: 0.8,
      recommendations: []
    };
  }

  private generateImprovementSuggestions(validations: ValidationResult[]): ImprovementSuggestion[] {
    // Generate improvement suggestions
    return [];
  }

  private convertToCSV(data: any): string {
    // Convert validation data to CSV format
    return 'CSV data would be generated here';
  }
}

export const humanValidationSystem = new HumanValidationSystem();