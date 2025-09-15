/**
 * Comprehensive Accuracy Monitoring and Metrics System
 * Tracks extraction accuracy, confidence levels, validation patterns, and provides
 * analytics for continuous improvement of AI models
 */

import { EventEmitter } from 'events';

export interface AccuracyMetrics {
  workerId: string;
  contractId: string;
  tenantId: string;
  extractionAccuracy: number;
  confidenceScore: number;
  validationResults: ValidationResult[];
  extractionTime: number;
  modelVersion: string;
  timestamp: Date;
  fieldAccuracies: FieldAccuracy[];
  errorPatterns: ErrorPattern[];
}

export interface ValidationResult {
  fieldName: string;
  extractedValue: any;
  validatedValue: any;
  isAccurate: boolean;
  confidenceScore: number;
  errorType?: 'false_positive' | 'false_negative' | 'incorrect_value' | 'formatting_error';
  correctionTime: number;
  validatorId: string;
  validationMethod: 'human' | 'automated' | 'cross_validation';
}

export interface FieldAccuracy {
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'boolean' | 'array' | 'object';
  accuracy: number;
  confidence: number;
  extractionCount: number;
  errorCount: number;
  commonErrors: string[];
  improvementSuggestions: string[];
}

export interface ErrorPattern {
  pattern: string;
  frequency: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedFields: string[];
  rootCause: string;
  recommendedFix: string;
  firstObserved: Date;
  lastObserved: Date;
}

export interface AccuracyTrend {
  workerId: string;
  period: string; // 'daily' | 'weekly' | 'monthly'
  dataPoints: AccuracyDataPoint[];
  trendDirection: 'improving' | 'declining' | 'stable';
  improvementRate: number;
  actionRequired: boolean;
}

export interface AccuracyDataPoint {
  timestamp: Date;
  accuracy: number;
  confidence: number;
  volume: number;
  errorRate: number;
}

export interface ModelPerformanceAnalysis {
  workerId: string;
  modelVersion: string;
  analysisWindow: string;
  overallAccuracy: number;
  fieldBreakdown: FieldAccuracy[];
  performanceByDocumentType: Record<string, number>;
  performanceByComplexity: Record<string, number>;
  comparisonToPrevious: {
    accuracyChange: number;
    confidenceChange: number;
    speedChange: number;
  };
  recommendations: ModelRecommendation[];
}

export interface ModelRecommendation {
  type: 'training_data' | 'prompt_optimization' | 'model_upgrade' | 'preprocessing';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedImprovement: number;
  implementationEffort: 'low' | 'medium' | 'high';
  timeline: string;
  costBenefit: string;
}

export interface AccuracyAlert {
  id: string;
  type: 'accuracy_drop' | 'confidence_low' | 'error_spike' | 'performance_degradation';
  severity: 'warning' | 'critical';
  workerId: string;
  description: string;
  threshold: number;
  currentValue: number;
  triggerTime: Date;
  affectedContracts: string[];
  recommendedActions: string[];
  acknowledged: boolean;
  resolvedAt?: Date;
}

export interface AccuracyReport {
  reportId: string;
  tenantId: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  generatedAt: Date;
  period: { start: Date; end: Date };
  summary: AccuracySummary;
  workerPerformance: WorkerPerformance[];
  trends: AccuracyTrend[];
  alerts: AccuracyAlert[];
  recommendations: ModelRecommendation[];
  actionItems: string[];
}

export interface AccuracySummary {
  overallAccuracy: number;
  averageConfidence: number;
  totalExtractions: number;
  totalValidations: number;
  errorRate: number;
  improvementFromPrevious: number;
  topPerformingWorkers: string[];
  areasForImprovement: string[];
}

export interface WorkerPerformance {
  workerId: string;
  accuracy: number;
  confidence: number;
  extractionCount: number;
  averageProcessingTime: number;
  errorPatterns: ErrorPattern[];
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  improvementNeeded: boolean;
}

export class AccuracyMonitoringSystem extends EventEmitter {
  private metrics: Map<string, AccuracyMetrics[]> = new Map();
  private alerts: Map<string, AccuracyAlert> = new Map();
  private thresholds: AccuracyThresholds;

  constructor(thresholds?: Partial<AccuracyThresholds>) {
    super();
    this.thresholds = {
      minAccuracy: 0.85,
      minConfidence: 0.7,
      maxErrorRate: 0.15,
      alertAccuracyDrop: 0.1,
      criticalAccuracy: 0.7,
      ...thresholds
    };
  }

  /**
   * Record accuracy metrics for a worker extraction
   */
  async recordExtractionMetrics(
    workerId: string,
    contractId: string,
    tenantId: string,
    extractionData: {
      extractedFields: Record<string, any>;
      confidenceScores: Record<string, number>;
      extractionTime: number;
      modelVersion: string;
    }
  ): Promise<void> {
    const timestamp = new Date();
    const overallConfidence = this.calculateOverallConfidence(extractionData.confidenceScores);
    
    // Create preliminary metrics (accuracy will be updated after validation)
    const metrics: AccuracyMetrics = {
      workerId,
      contractId,
      tenantId,
      extractionAccuracy: 0, // Will be updated after validation
      confidenceScore: overallConfidence,
      validationResults: [],
      extractionTime: extractionData.extractionTime,
      modelVersion: extractionData.modelVersion,
      timestamp,
      fieldAccuracies: this.initializeFieldAccuracies(extractionData.extractedFields),
      errorPatterns: []
    };

    // Store metrics
    const key = `${workerId}:${contractId}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(metrics);

    // Trigger real-time confidence monitoring
    await this.monitorConfidenceLevel(workerId, overallConfidence);
    
    this.emit('extractionRecorded', {
      workerId,
      contractId,
      tenantId,
      confidence: overallConfidence,
      timestamp
    });
  }

  /**
   * Update metrics with validation results
   */
  async updateValidationResults(
    workerId: string,
    contractId: string,
    validationResults: ValidationResult[]
  ): Promise<void> {
    const key = `${workerId}:${contractId}`;
    const metricsArray = this.metrics.get(key);
    
    if (!metricsArray || metricsArray.length === 0) {
      console.warn(`No metrics found for ${key}`);
      return;
    }

    // Update the most recent metrics entry
    const latestMetrics = metricsArray[metricsArray.length - 1];
    latestMetrics.validationResults = validationResults;
    latestMetrics.extractionAccuracy = this.calculateExtractionAccuracy(validationResults);
    latestMetrics.fieldAccuracies = this.updateFieldAccuracies(
      latestMetrics.fieldAccuracies,
      validationResults
    );
    latestMetrics.errorPatterns = this.identifyErrorPatterns(validationResults);

    // Trigger accuracy monitoring
    await this.monitorAccuracyLevel(workerId, latestMetrics.extractionAccuracy);
    
    // Update error pattern tracking
    await this.updateErrorPatternTracking(workerId, latestMetrics.errorPatterns);

    this.emit('validationUpdated', {
      workerId,
      contractId,
      accuracy: latestMetrics.extractionAccuracy,
      validationCount: validationResults.length
    });
  }

  /**
   * Generate comprehensive accuracy report
   */
  async generateAccuracyReport(
    tenantId: string,
    reportType: AccuracyReport['reportType'],
    customPeriod?: { start: Date; end: Date }
  ): Promise<AccuracyReport> {
    const period = customPeriod || this.getReportPeriod(reportType);
    const reportId = `accuracy_${reportType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Collect metrics for the period
    const periodMetrics = this.getMetricsForPeriod(tenantId, period);
    
    // Calculate summary statistics
    const summary = this.calculateAccuracySummary(periodMetrics);
    
    // Analyze worker performance
    const workerPerformance = this.analyzeWorkerPerformance(periodMetrics);
    
    // Calculate trends
    const trends = await this.calculateAccuracyTrends(tenantId, period);
    
    // Get alerts for the period
    const alerts = this.getAlertsForPeriod(tenantId, period);
    
    // Generate recommendations
    const recommendations = await this.generateModelRecommendations(periodMetrics);
    
    // Create action items
    const actionItems = this.generateActionItems(summary, workerPerformance, alerts);

    const report: AccuracyReport = {
      reportId,
      tenantId,
      reportType,
      generatedAt: new Date(),
      period,
      summary,
      workerPerformance,
      trends,
      alerts,
      recommendations,
      actionItems
    };

    this.emit('reportGenerated', { reportId, tenantId, reportType });

    return report;
  }

  /**
   * Get real-time accuracy metrics for a worker
   */
  async getWorkerAccuracyMetrics(
    workerId: string,
    timeWindow: number = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
  ): Promise<WorkerAccuracyMetrics> {
    const cutoffTime = new Date(Date.now() - timeWindow);
    const allMetrics = Array.from(this.metrics.values()).flat();
    
    const workerMetrics = allMetrics.filter(
      m => m.workerId === workerId && m.timestamp >= cutoffTime
    );

    if (workerMetrics.length === 0) {
      return {
        workerId,
        timeWindow: '24h',
        accuracy: 0,
        confidence: 0,
        extractionCount: 0,
        errorRate: 0,
        averageProcessingTime: 0,
        recentTrend: 'stable',
        alertsCount: 0
      };
    }

    const accuracy = workerMetrics.reduce((sum, m) => sum + m.extractionAccuracy, 0) / workerMetrics.length;
    const confidence = workerMetrics.reduce((sum, m) => sum + m.confidenceScore, 0) / workerMetrics.length;
    const extractionCount = workerMetrics.length;
    const errorRate = 1 - accuracy;
    const averageProcessingTime = workerMetrics.reduce((sum, m) => sum + m.extractionTime, 0) / workerMetrics.length;
    
    // Calculate recent trend
    const recentTrend = this.calculateRecentTrend(workerMetrics);
    
    // Count active alerts
    const alertsCount = Array.from(this.alerts.values()).filter(
      a => a.workerId === workerId && !a.acknowledged
    ).length;

    return {
      workerId,
      timeWindow: '24h',
      accuracy,
      confidence,
      extractionCount,
      errorRate,
      averageProcessingTime,
      recentTrend,
      alertsCount
    };
  }

  /**
   * Trigger accuracy alert if thresholds are breached
   */
  private async monitorAccuracyLevel(workerId: string, accuracy: number): Promise<void> {
    if (accuracy < this.thresholds.criticalAccuracy) {
      await this.createAlert({
        type: 'accuracy_drop',
        severity: 'critical',
        workerId,
        description: `Critical accuracy drop detected: ${(accuracy * 100).toFixed(1)}%`,
        threshold: this.thresholds.criticalAccuracy,
        currentValue: accuracy,
        affectedContracts: [],
        recommendedActions: [
          'Review recent extractions for patterns',
          'Check model configuration',
          'Increase human validation frequency',
          'Consider model retraining'
        ]
      });
    } else if (accuracy < this.thresholds.minAccuracy) {
      await this.createAlert({
        type: 'accuracy_drop',
        severity: 'warning',
        workerId,
        description: `Accuracy below threshold: ${(accuracy * 100).toFixed(1)}%`,
        threshold: this.thresholds.minAccuracy,
        currentValue: accuracy,
        affectedContracts: [],
        recommendedActions: [
          'Monitor next few extractions closely',
          'Review extraction patterns',
          'Consider additional training data'
        ]
      });
    }
  }

  /**
   * Monitor confidence levels in real-time
   */
  private async monitorConfidenceLevel(workerId: string, confidence: number): Promise<void> {
    if (confidence < this.thresholds.minConfidence) {
      await this.createAlert({
        type: 'confidence_low',
        severity: 'warning',
        workerId,
        description: `Low confidence extraction: ${(confidence * 100).toFixed(1)}%`,
        threshold: this.thresholds.minConfidence,
        currentValue: confidence,
        affectedContracts: [],
        recommendedActions: [
          'Flag for human review',
          'Check document quality',
          'Review extraction parameters'
        ]
      });
    }
  }

  /**
   * Create and store accuracy alert
   */
  private async createAlert(alertData: Omit<AccuracyAlert, 'id' | 'triggerTime' | 'acknowledged'>): Promise<void> {
    const alert: AccuracyAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      triggerTime: new Date(),
      acknowledged: false,
      ...alertData
    };

    this.alerts.set(alert.id, alert);
    this.emit('alertTriggered', alert);
  }

  // Helper methods
  private calculateOverallConfidence(confidenceScores: Record<string, number>): number {
    const scores = Object.values(confidenceScores);
    return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  }

  private calculateExtractionAccuracy(validationResults: ValidationResult[]): number {
    if (validationResults.length === 0) return 0;
    const accurateCount = validationResults.filter(r => r.isAccurate).length;
    return accurateCount / validationResults.length;
  }

  private initializeFieldAccuracies(extractedFields: Record<string, any>): FieldAccuracy[] {
    return Object.entries(extractedFields).map(([fieldName, value]) => ({
      fieldName,
      fieldType: this.inferFieldType(value),
      accuracy: 0, // Will be updated after validation
      confidence: 0,
      extractionCount: 1,
      errorCount: 0,
      commonErrors: [],
      improvementSuggestions: []
    }));
  }

  private updateFieldAccuracies(
    currentAccuracies: FieldAccuracy[],
    validationResults: ValidationResult[]
  ): FieldAccuracy[] {
    const updatedAccuracies = [...currentAccuracies];
    
    validationResults.forEach(result => {
      const fieldAccuracy = updatedAccuracies.find(fa => fa.fieldName === result.fieldName);
      if (fieldAccuracy) {
        fieldAccuracy.extractionCount++;
        if (!result.isAccurate) {
          fieldAccuracy.errorCount++;
          if (result.errorType) {
            fieldAccuracy.commonErrors.push(result.errorType);
          }
        }
        fieldAccuracy.accuracy = 1 - (fieldAccuracy.errorCount / fieldAccuracy.extractionCount);
        fieldAccuracy.confidence = result.confidenceScore;
      }
    });

    return updatedAccuracies;
  }

  private identifyErrorPatterns(validationResults: ValidationResult[]): ErrorPattern[] {
    const errorPatterns: ErrorPattern[] = [];
    const errors = validationResults.filter(r => !r.isAccurate);
    
    // Group errors by type
    const errorGroups = errors.reduce((groups, error) => {
      const key = error.errorType || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(error);
      return groups;
    }, {} as Record<string, ValidationResult[]>);

    // Create error patterns
    Object.entries(errorGroups).forEach(([errorType, errorList]) => {
      if (errorList.length > 1) { // Only patterns with multiple occurrences
        errorPatterns.push({
          pattern: errorType,
          frequency: errorList.length,
          severity: this.determineSeverity(errorList.length, validationResults.length),
          affectedFields: [...new Set(errorList.map(e => e.fieldName))],
          rootCause: this.analyzeRootCause(errorType, errorList),
          recommendedFix: this.generateRecommendedFix(errorType),
          firstObserved: new Date(),
          lastObserved: new Date()
        });
      }
    });

    return errorPatterns;
  }

  private inferFieldType(value: any): FieldAccuracy['fieldType'] {
    if (typeof value === 'string') return 'text';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object') return 'object';
    return 'text';
  }

  private determineSeverity(errorCount: number, totalCount: number): ErrorPattern['severity'] {
    const errorRate = errorCount / totalCount;
    if (errorRate > 0.5) return 'critical';
    if (errorRate > 0.3) return 'high';
    if (errorRate > 0.1) return 'medium';
    return 'low';
  }

  private analyzeRootCause(errorType: string, errors: ValidationResult[]): string {
    // Simplified root cause analysis
    const rootCauses: Record<string, string> = {
      'false_positive': 'Model extracting information that is not present',
      'false_negative': 'Model missing information that is present',
      'incorrect_value': 'Model extracting wrong value for correct field',
      'formatting_error': 'Model extracting correct value in wrong format'
    };
    return rootCauses[errorType] || 'Unknown root cause';
  }

  private generateRecommendedFix(errorType: string): string {
    const fixes: Record<string, string> = {
      'false_positive': 'Improve precision by adding negative examples to training data',
      'false_negative': 'Improve recall by adding more positive examples and adjusting extraction thresholds',
      'incorrect_value': 'Review extraction prompts and add field-specific validation rules',
      'formatting_error': 'Add post-processing validation and formatting rules'
    };
    return fixes[errorType] || 'Review and retrain model with focus on this error type';
  }

  // Additional helper methods for reports and trends would be implemented here
  private getReportPeriod(reportType: AccuracyReport['reportType']): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    const start = new Date(now);
    
    switch (reportType) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarterly':
        start.setMonth(start.getMonth() - 3);
        break;
    }
    
    return { start, end };
  }

  private getMetricsForPeriod(tenantId: string, period: { start: Date; end: Date }): AccuracyMetrics[] {
    return Array.from(this.metrics.values())
      .flat()
      .filter(m => 
        m.tenantId === tenantId &&
        m.timestamp >= period.start &&
        m.timestamp <= period.end
      );
  }

  private calculateAccuracySummary(metrics: AccuracyMetrics[]): AccuracySummary {
    if (metrics.length === 0) {
      return {
        overallAccuracy: 0,
        averageConfidence: 0,
        totalExtractions: 0,
        totalValidations: 0,
        errorRate: 0,
        improvementFromPrevious: 0,
        topPerformingWorkers: [],
        areasForImprovement: []
      };
    }

    const overallAccuracy = metrics.reduce((sum, m) => sum + m.extractionAccuracy, 0) / metrics.length;
    const averageConfidence = metrics.reduce((sum, m) => sum + m.confidenceScore, 0) / metrics.length;
    const totalExtractions = metrics.length;
    const totalValidations = metrics.reduce((sum, m) => sum + m.validationResults.length, 0);
    const errorRate = 1 - overallAccuracy;

    return {
      overallAccuracy,
      averageConfidence,
      totalExtractions,
      totalValidations,
      errorRate,
      improvementFromPrevious: 0, // Would calculate based on previous period
      topPerformingWorkers: this.getTopPerformingWorkers(metrics),
      areasForImprovement: this.getAreasForImprovement(metrics)
    };
  }

  private analyzeWorkerPerformance(metrics: AccuracyMetrics[]): WorkerPerformance[] {
    const workerGroups = metrics.reduce((groups, metric) => {
      if (!groups[metric.workerId]) groups[metric.workerId] = [];
      groups[metric.workerId].push(metric);
      return groups;
    }, {} as Record<string, AccuracyMetrics[]>);

    return Object.entries(workerGroups).map(([workerId, workerMetrics]) => {
      const accuracy = workerMetrics.reduce((sum, m) => sum + m.extractionAccuracy, 0) / workerMetrics.length;
      const confidence = workerMetrics.reduce((sum, m) => sum + m.confidenceScore, 0) / workerMetrics.length;
      const extractionCount = workerMetrics.length;
      const averageProcessingTime = workerMetrics.reduce((sum, m) => sum + m.extractionTime, 0) / workerMetrics.length;
      
      return {
        workerId,
        accuracy,
        confidence,
        extractionCount,
        averageProcessingTime,
        errorPatterns: this.aggregateErrorPatterns(workerMetrics),
        performanceGrade: this.calculatePerformanceGrade(accuracy),
        improvementNeeded: accuracy < this.thresholds.minAccuracy
      };
    });
  }

  private calculatePerformanceGrade(accuracy: number): WorkerPerformance['performanceGrade'] {
    if (accuracy >= 0.95) return 'A';
    if (accuracy >= 0.9) return 'B';
    if (accuracy >= 0.8) return 'C';
    if (accuracy >= 0.7) return 'D';
    return 'F';
  }

  private async calculateAccuracyTrends(tenantId: string, period: { start: Date; end: Date }): Promise<AccuracyTrend[]> {
    // Implementation would calculate trends over time
    return [];
  }

  private getAlertsForPeriod(tenantId: string, period: { start: Date; end: Date }): AccuracyAlert[] {
    return Array.from(this.alerts.values()).filter(alert =>
      alert.triggerTime >= period.start && alert.triggerTime <= period.end
    );
  }

  private async generateModelRecommendations(metrics: AccuracyMetrics[]): Promise<ModelRecommendation[]> {
    // Implementation would analyze patterns and generate specific recommendations
    return [];
  }

  private generateActionItems(
    summary: AccuracySummary,
    workerPerformance: WorkerPerformance[],
    alerts: AccuracyAlert[]
  ): string[] {
    const actionItems: string[] = [];
    
    if (summary.overallAccuracy < this.thresholds.minAccuracy) {
      actionItems.push('Investigate accuracy drop across all workers');
    }
    
    const poorPerformers = workerPerformance.filter(wp => wp.improvementNeeded);
    if (poorPerformers.length > 0) {
      actionItems.push(`Review and improve ${poorPerformers.length} underperforming workers`);
    }
    
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.acknowledged);
    if (criticalAlerts.length > 0) {
      actionItems.push(`Address ${criticalAlerts.length} critical accuracy alerts`);
    }
    
    return actionItems;
  }

  private getTopPerformingWorkers(metrics: AccuracyMetrics[]): string[] {
    const workerPerformance = this.analyzeWorkerPerformance(metrics);
    return workerPerformance
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 3)
      .map(wp => wp.workerId);
  }

  private getAreasForImprovement(metrics: AccuracyMetrics[]): string[] {
    // Analyze field accuracies to identify improvement areas
    const allFieldAccuracies = metrics.flatMap(m => m.fieldAccuracies);
    const fieldGroups = allFieldAccuracies.reduce((groups, fa) => {
      if (!groups[fa.fieldName]) groups[fa.fieldName] = [];
      groups[fa.fieldName].push(fa.accuracy);
      return groups;
    }, {} as Record<string, number[]>);

    return Object.entries(fieldGroups)
      .map(([fieldName, accuracies]) => ({
        fieldName,
        avgAccuracy: accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length
      }))
      .filter(field => field.avgAccuracy < this.thresholds.minAccuracy)
      .sort((a, b) => a.avgAccuracy - b.avgAccuracy)
      .slice(0, 5)
      .map(field => field.fieldName);
  }

  private aggregateErrorPatterns(metrics: AccuracyMetrics[]): ErrorPattern[] {
    // Aggregate error patterns across metrics
    const allPatterns = metrics.flatMap(m => m.errorPatterns);
    // Implementation would merge and aggregate patterns
    return allPatterns;
  }

  private calculateRecentTrend(metrics: AccuracyMetrics[]): 'improving' | 'declining' | 'stable' {
    if (metrics.length < 2) return 'stable';
    
    const sorted = metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const recent = sorted.slice(-Math.min(5, sorted.length));
    
    let improvingCount = 0;
    let decliningCount = 0;
    
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].extractionAccuracy > recent[i - 1].extractionAccuracy) {
        improvingCount++;
      } else if (recent[i].extractionAccuracy < recent[i - 1].extractionAccuracy) {
        decliningCount++;
      }
    }
    
    if (improvingCount > decliningCount) return 'improving';
    if (decliningCount > improvingCount) return 'declining';
    return 'stable';
  }

  private async updateErrorPatternTracking(workerId: string, errorPatterns: ErrorPattern[]): Promise<void> {
    // Implementation would update persistent error pattern tracking
    this.emit('errorPatternsUpdated', { workerId, patterns: errorPatterns });
  }
}

export interface AccuracyThresholds {
  minAccuracy: number;
  minConfidence: number;
  maxErrorRate: number;
  alertAccuracyDrop: number;
  criticalAccuracy: number;
}

export interface WorkerAccuracyMetrics {
  workerId: string;
  timeWindow: string;
  accuracy: number;
  confidence: number;
  extractionCount: number;
  errorRate: number;
  averageProcessingTime: number;
  recentTrend: 'improving' | 'declining' | 'stable';
  alertsCount: number;
}

export const accuracyMonitoringSystem = new AccuracyMonitoringSystem();