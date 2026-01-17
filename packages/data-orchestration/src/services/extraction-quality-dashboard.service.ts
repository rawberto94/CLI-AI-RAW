/**
 * Extraction Quality Dashboard Service
 * 
 * Provides analytics and insights for AI extraction quality:
 * - Accuracy trends over time
 * - Per-field performance metrics
 * - Model comparison analytics
 * - Quality scoring and grading
 * 
 * @version 1.0.0
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('quality-dashboard');

// =============================================================================
// TYPES
// =============================================================================

export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type TimePeriod = 'hour' | 'day' | 'week' | 'month' | 'quarter';

export interface ExtractionRecord {
  id: string;
  contractId: string;
  tenantId: string;
  artifactType: string;
  timestamp: Date;
  model: string;
  durationMs: number;
  fieldsExtracted: number;
  fieldsCorrect: number;
  fieldsCorrected: number;
  averageConfidence: number;
  tokensUsed: number;
  cost: number;
  fieldMetrics: FieldMetric[];
}

export interface FieldMetric {
  fieldName: string;
  extracted: boolean;
  correct: boolean;
  confidence: number;
  corrected: boolean;
  originalValue?: unknown;
  correctedValue?: unknown;
}

export interface QualityScore {
  overall: number; // 0-100
  grade: QualityGrade;
  accuracy: number;
  completeness: number;
  confidence: number;
  efficiency: number;
  trend: 'improving' | 'stable' | 'declining';
  trendPercent: number;
}

export interface FieldAnalytics {
  fieldName: string;
  extractionRate: number;
  accuracy: number;
  averageConfidence: number;
  correctionRate: number;
  commonErrors: Array<{ type: string; count: number }>;
  recommendedAction?: string;
}

export interface TrendDataPoint {
  timestamp: Date;
  value: number;
  count: number;
}

export interface QualityDashboard {
  tenantId: string;
  period: TimePeriod;
  generatedAt: Date;
  summary: {
    totalExtractions: number;
    successRate: number;
    averageAccuracy: number;
    averageConfidence: number;
    totalCost: number;
    qualityScore: QualityScore;
  };
  byArtifactType: Record<string, {
    count: number;
    accuracy: number;
    avgDuration: number;
    qualityGrade: QualityGrade;
  }>;
  byModel: Record<string, {
    count: number;
    accuracy: number;
    avgCost: number;
    avgLatency: number;
  }>;
  fieldAnalytics: FieldAnalytics[];
  trends: {
    accuracy: TrendDataPoint[];
    volume: TrendDataPoint[];
    cost: TrendDataPoint[];
    confidence: TrendDataPoint[];
  };
  alerts: QualityAlert[];
  recommendations: string[];
}

export interface QualityAlert {
  id: string;
  type: 'accuracy_drop' | 'high_correction_rate' | 'confidence_mismatch' | 'cost_spike' | 'field_degradation';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  affectedItems: string[];
  detectedAt: Date;
  resolved: boolean;
}

// =============================================================================
// QUALITY DASHBOARD SERVICE
// =============================================================================

export class ExtractionQualityDashboardService {
  private static instance: ExtractionQualityDashboardService;
  private records: Map<string, ExtractionRecord[]> = new Map();
  private alerts: Map<string, QualityAlert[]> = new Map();
  private readonly GRADE_THRESHOLDS = {
    A: 90,
    B: 80,
    C: 70,
    D: 60,
    F: 0,
  };

  private constructor() {}

  static getInstance(): ExtractionQualityDashboardService {
    if (!ExtractionQualityDashboardService.instance) {
      ExtractionQualityDashboardService.instance = new ExtractionQualityDashboardService();
    }
    return ExtractionQualityDashboardService.instance;
  }

  // ===========================================================================
  // DATA COLLECTION
  // ===========================================================================

  recordExtraction(record: ExtractionRecord): void {
    const key = record.tenantId;
    const existing = this.records.get(key) || [];
    existing.push(record);

    // Keep last 100k records per tenant
    if (existing.length > 100000) {
      existing.shift();
    }

    this.records.set(key, existing);
    this.checkForAlerts(record);
  }

  recordCorrection(
    tenantId: string,
    extractionId: string,
    field: string,
    originalValue: unknown,
    correctedValue: unknown
  ): void {
    const records = this.records.get(tenantId) || [];
    const record = records.find(r => r.id === extractionId);
    
    if (record) {
      const fieldMetric = record.fieldMetrics.find(f => f.fieldName === field);
      if (fieldMetric) {
        fieldMetric.corrected = true;
        fieldMetric.correct = false;
        fieldMetric.originalValue = originalValue;
        fieldMetric.correctedValue = correctedValue;
        record.fieldsCorrected++;
        record.fieldsCorrect--;
      }
    }
  }

  // ===========================================================================
  // DASHBOARD GENERATION
  // ===========================================================================

  generateDashboard(
    tenantId: string,
    period: TimePeriod = 'week'
  ): QualityDashboard {
    const records = this.getRecordsForPeriod(tenantId, period);
    
    const summary = this.calculateSummary(records);
    const byArtifactType = this.analyzeByArtifactType(records);
    const byModel = this.analyzeByModel(records);
    const fieldAnalytics = this.analyzeFields(records);
    const trends = this.calculateTrends(tenantId, period);
    const alerts = this.alerts.get(tenantId) || [];
    const recommendations = this.generateRecommendations(summary, fieldAnalytics, byModel);

    return {
      tenantId,
      period,
      generatedAt: new Date(),
      summary,
      byArtifactType,
      byModel,
      fieldAnalytics,
      trends,
      alerts: alerts.filter(a => !a.resolved),
      recommendations,
    };
  }

  private getRecordsForPeriod(tenantId: string, period: TimePeriod): ExtractionRecord[] {
    const records = this.records.get(tenantId) || [];
    const cutoff = this.getPeriodCutoff(period);
    return records.filter(r => r.timestamp >= cutoff);
  }

  private getPeriodCutoff(period: TimePeriod): Date {
    const now = new Date();
    switch (period) {
      case 'hour':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'quarter':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }
  }

  private calculateSummary(records: ExtractionRecord[]): QualityDashboard['summary'] {
    if (records.length === 0) {
      return {
        totalExtractions: 0,
        successRate: 0,
        averageAccuracy: 0,
        averageConfidence: 0,
        totalCost: 0,
        qualityScore: {
          overall: 0,
          grade: 'F',
          accuracy: 0,
          completeness: 0,
          confidence: 0,
          efficiency: 0,
          trend: 'stable',
          trendPercent: 0,
        },
      };
    }

    const totalExtractions = records.length;
    const successfulExtractions = records.filter(r => r.fieldsExtracted > 0).length;
    const successRate = successfulExtractions / totalExtractions;

    const totalFieldsExtracted = records.reduce((sum, r) => sum + r.fieldsExtracted, 0);
    const totalFieldsCorrect = records.reduce((sum, r) => sum + r.fieldsCorrect, 0);
    const averageAccuracy = totalFieldsExtracted > 0 ? totalFieldsCorrect / totalFieldsExtracted : 0;

    const averageConfidence = records.reduce((sum, r) => sum + r.averageConfidence, 0) / records.length;
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);

    // Calculate quality score
    const accuracy = averageAccuracy * 100;
    const completeness = successRate * 100;
    const confidence = averageConfidence * 100;
    const avgDuration = records.reduce((sum, r) => sum + r.durationMs, 0) / records.length;
    const efficiency = Math.max(0, 100 - (avgDuration / 100)); // Penalize slow extractions

    const overall = (accuracy * 0.4 + completeness * 0.25 + confidence * 0.2 + efficiency * 0.15);
    const grade = this.getGrade(overall);

    return {
      totalExtractions,
      successRate,
      averageAccuracy,
      averageConfidence,
      totalCost,
      qualityScore: {
        overall,
        grade,
        accuracy,
        completeness,
        confidence,
        efficiency,
        trend: 'stable', // Will be updated with trend analysis
        trendPercent: 0,
      },
    };
  }

  private analyzeByArtifactType(records: ExtractionRecord[]): QualityDashboard['byArtifactType'] {
    const byType: Record<string, ExtractionRecord[]> = {};
    for (const record of records) {
      if (!byType[record.artifactType]) {
        byType[record.artifactType] = [];
      }
      byType[record.artifactType].push(record);
    }

    const result: QualityDashboard['byArtifactType'] = {};
    for (const [type, typeRecords] of Object.entries(byType)) {
      const totalCorrect = typeRecords.reduce((sum, r) => sum + r.fieldsCorrect, 0);
      const totalExtracted = typeRecords.reduce((sum, r) => sum + r.fieldsExtracted, 0);
      const accuracy = totalExtracted > 0 ? totalCorrect / totalExtracted : 0;
      const avgDuration = typeRecords.reduce((sum, r) => sum + r.durationMs, 0) / typeRecords.length;

      result[type] = {
        count: typeRecords.length,
        accuracy,
        avgDuration,
        qualityGrade: this.getGrade(accuracy * 100),
      };
    }

    return result;
  }

  private analyzeByModel(records: ExtractionRecord[]): QualityDashboard['byModel'] {
    const byModel: Record<string, ExtractionRecord[]> = {};
    for (const record of records) {
      if (!byModel[record.model]) {
        byModel[record.model] = [];
      }
      byModel[record.model].push(record);
    }

    const result: QualityDashboard['byModel'] = {};
    for (const [model, modelRecords] of Object.entries(byModel)) {
      const totalCorrect = modelRecords.reduce((sum, r) => sum + r.fieldsCorrect, 0);
      const totalExtracted = modelRecords.reduce((sum, r) => sum + r.fieldsExtracted, 0);

      result[model] = {
        count: modelRecords.length,
        accuracy: totalExtracted > 0 ? totalCorrect / totalExtracted : 0,
        avgCost: modelRecords.reduce((sum, r) => sum + r.cost, 0) / modelRecords.length,
        avgLatency: modelRecords.reduce((sum, r) => sum + r.durationMs, 0) / modelRecords.length,
      };
    }

    return result;
  }

  private analyzeFields(records: ExtractionRecord[]): FieldAnalytics[] {
    const fieldStats: Record<string, {
      totalExtractions: number;
      successfulExtractions: number;
      correctExtractions: number;
      corrections: number;
      confidenceSum: number;
      errors: Map<string, number>;
    }> = {};

    for (const record of records) {
      for (const field of record.fieldMetrics) {
        if (!fieldStats[field.fieldName]) {
          fieldStats[field.fieldName] = {
            totalExtractions: 0,
            successfulExtractions: 0,
            correctExtractions: 0,
            corrections: 0,
            confidenceSum: 0,
            errors: new Map(),
          };
        }

        const stats = fieldStats[field.fieldName];
        stats.totalExtractions++;
        if (field.extracted) stats.successfulExtractions++;
        if (field.correct) stats.correctExtractions++;
        if (field.corrected) stats.corrections++;
        stats.confidenceSum += field.confidence;

        // Track error types
        if (!field.correct && field.extracted) {
          const errorType = this.categorizeError(field);
          stats.errors.set(errorType, (stats.errors.get(errorType) || 0) + 1);
        }
      }
    }

    return Object.entries(fieldStats).map(([fieldName, stats]) => {
      const extractionRate = stats.totalExtractions > 0 
        ? stats.successfulExtractions / stats.totalExtractions 
        : 0;
      const accuracy = stats.successfulExtractions > 0 
        ? stats.correctExtractions / stats.successfulExtractions 
        : 0;
      const correctionRate = stats.successfulExtractions > 0 
        ? stats.corrections / stats.successfulExtractions 
        : 0;

      const commonErrors = Array.from(stats.errors.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        fieldName,
        extractionRate,
        accuracy,
        averageConfidence: stats.totalExtractions > 0 ? stats.confidenceSum / stats.totalExtractions : 0,
        correctionRate,
        commonErrors,
        recommendedAction: this.getFieldRecommendation(accuracy, correctionRate, extractionRate),
      };
    }).sort((a, b) => a.accuracy - b.accuracy); // Worst performing first
  }

  private calculateTrends(tenantId: string, period: TimePeriod): QualityDashboard['trends'] {
    const records = this.records.get(tenantId) || [];
    const bucketSize = this.getBucketSize(period);
    const bucketCount = this.getBucketCount(period);
    
    const now = Date.now();
    const accuracy: TrendDataPoint[] = [];
    const volume: TrendDataPoint[] = [];
    const cost: TrendDataPoint[] = [];
    const confidence: TrendDataPoint[] = [];

    for (let i = bucketCount - 1; i >= 0; i--) {
      const bucketStart = now - (i + 1) * bucketSize;
      const bucketEnd = now - i * bucketSize;
      
      const bucketRecords = records.filter(
        r => r.timestamp.getTime() >= bucketStart && r.timestamp.getTime() < bucketEnd
      );

      const timestamp = new Date(bucketEnd);

      if (bucketRecords.length > 0) {
        const totalCorrect = bucketRecords.reduce((sum, r) => sum + r.fieldsCorrect, 0);
        const totalExtracted = bucketRecords.reduce((sum, r) => sum + r.fieldsExtracted, 0);
        
        accuracy.push({
          timestamp,
          value: totalExtracted > 0 ? totalCorrect / totalExtracted : 0,
          count: bucketRecords.length,
        });
        volume.push({
          timestamp,
          value: bucketRecords.length,
          count: bucketRecords.length,
        });
        cost.push({
          timestamp,
          value: bucketRecords.reduce((sum, r) => sum + r.cost, 0),
          count: bucketRecords.length,
        });
        confidence.push({
          timestamp,
          value: bucketRecords.reduce((sum, r) => sum + r.averageConfidence, 0) / bucketRecords.length,
          count: bucketRecords.length,
        });
      } else {
        accuracy.push({ timestamp, value: 0, count: 0 });
        volume.push({ timestamp, value: 0, count: 0 });
        cost.push({ timestamp, value: 0, count: 0 });
        confidence.push({ timestamp, value: 0, count: 0 });
      }
    }

    return { accuracy, volume, cost, confidence };
  }

  private getBucketSize(period: TimePeriod): number {
    switch (period) {
      case 'hour': return 5 * 60 * 1000; // 5 minutes
      case 'day': return 60 * 60 * 1000; // 1 hour
      case 'week': return 24 * 60 * 60 * 1000; // 1 day
      case 'month': return 24 * 60 * 60 * 1000; // 1 day
      case 'quarter': return 7 * 24 * 60 * 60 * 1000; // 1 week
    }
  }

  private getBucketCount(period: TimePeriod): number {
    switch (period) {
      case 'hour': return 12;
      case 'day': return 24;
      case 'week': return 7;
      case 'month': return 30;
      case 'quarter': return 13;
    }
  }

  // ===========================================================================
  // ALERTS
  // ===========================================================================

  private checkForAlerts(record: ExtractionRecord): void {
    const alerts = this.alerts.get(record.tenantId) || [];

    // Check for low accuracy
    const accuracy = record.fieldsExtracted > 0 
      ? record.fieldsCorrect / record.fieldsExtracted 
      : 0;
    
    if (accuracy < 0.7 && record.fieldsExtracted >= 3) {
      alerts.push({
        id: `alert_${Date.now()}`,
        type: 'accuracy_drop',
        severity: accuracy < 0.5 ? 'critical' : 'warning',
        message: `Low extraction accuracy (${(accuracy * 100).toFixed(1)}%) for contract ${record.contractId}`,
        affectedItems: [record.contractId],
        detectedAt: new Date(),
        resolved: false,
      });
    }

    // Check for high correction rate
    const correctionRate = record.fieldsExtracted > 0 
      ? record.fieldsCorrected / record.fieldsExtracted 
      : 0;
    
    if (correctionRate > 0.3) {
      alerts.push({
        id: `alert_${Date.now()}`,
        type: 'high_correction_rate',
        severity: 'warning',
        message: `High correction rate (${(correctionRate * 100).toFixed(1)}%) for artifact type ${record.artifactType}`,
        affectedItems: [record.artifactType],
        detectedAt: new Date(),
        resolved: false,
      });
    }

    // Keep last 1000 alerts
    if (alerts.length > 1000) {
      alerts.shift();
    }

    this.alerts.set(record.tenantId, alerts);
  }

  resolveAlert(tenantId: string, alertId: string): boolean {
    const alerts = this.alerts.get(tenantId) || [];
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  // ===========================================================================
  // RECOMMENDATIONS
  // ===========================================================================

  private generateRecommendations(
    summary: QualityDashboard['summary'],
    fieldAnalytics: FieldAnalytics[],
    byModel: QualityDashboard['byModel']
  ): string[] {
    const recommendations: string[] = [];

    // Accuracy recommendations
    if (summary.averageAccuracy < 0.8) {
      recommendations.push('Consider adding more training examples for frequently corrected fields');
    }

    // Field-specific recommendations
    const lowAccuracyFields = fieldAnalytics.filter(f => f.accuracy < 0.7);
    if (lowAccuracyFields.length > 0) {
      const fields = lowAccuracyFields.slice(0, 3).map(f => f.fieldName).join(', ');
      recommendations.push(`Fields with low accuracy need attention: ${fields}`);
    }

    // Confidence calibration
    if (Math.abs(summary.averageConfidence - summary.averageAccuracy) > 0.1) {
      if (summary.averageConfidence > summary.averageAccuracy) {
        recommendations.push('AI is overconfident. Consider enabling confidence calibration.');
      } else {
        recommendations.push('AI is underconfident. Review prompt instructions.');
      }
    }

    // Model recommendations
    const modelEntries = Object.entries(byModel);
    if (modelEntries.length > 1) {
      const bestModel = modelEntries.reduce((best, current) => 
        current[1].accuracy > best[1].accuracy ? current : best
      );
      const worstModel = modelEntries.reduce((worst, current) =>
        current[1].accuracy < worst[1].accuracy ? current : worst
      );
      
      if (bestModel[1].accuracy - worstModel[1].accuracy > 0.1) {
        recommendations.push(`Model ${bestModel[0]} significantly outperforms ${worstModel[0]}. Consider routing more tasks to ${bestModel[0]}.`);
      }
    }

    // Cost recommendations
    if (summary.totalCost > 100) {
      recommendations.push('Consider using caching for repeated similar contracts to reduce costs');
    }

    if (recommendations.length === 0) {
      recommendations.push('Extraction quality is good! Continue monitoring for any changes.');
    }

    return recommendations;
  }

  private getFieldRecommendation(accuracy: number, correctionRate: number, extractionRate: number): string | undefined {
    if (extractionRate < 0.5) {
      return 'Field is frequently missing. Review if field exists in contract templates.';
    }
    if (accuracy < 0.5) {
      return 'Accuracy is critically low. Consider rewriting extraction prompt.';
    }
    if (correctionRate > 0.3) {
      return 'High correction rate. Add more examples to prompt.';
    }
    if (accuracy < 0.7) {
      return 'Below average accuracy. Review common error patterns.';
    }
    return undefined;
  }

  private categorizeError(field: FieldMetric): string {
    if (!field.extracted) return 'missing';
    if (field.originalValue === null || field.originalValue === undefined) return 'null_value';
    if (typeof field.originalValue === 'string' && field.originalValue.trim() === '') return 'empty_value';
    return 'incorrect_value';
  }

  private getGrade(score: number): QualityGrade {
    if (score >= this.GRADE_THRESHOLDS.A) return 'A';
    if (score >= this.GRADE_THRESHOLDS.B) return 'B';
    if (score >= this.GRADE_THRESHOLDS.C) return 'C';
    if (score >= this.GRADE_THRESHOLDS.D) return 'D';
    return 'F';
  }

  // ===========================================================================
  // EXPORT
  // ===========================================================================

  exportToCsv(tenantId: string, period: TimePeriod = 'month'): string {
    const records = this.getRecordsForPeriod(tenantId, period);
    
    const headers = ['ID', 'ContractID', 'ArtifactType', 'Timestamp', 'Model', 'Duration(ms)', 'FieldsExtracted', 'FieldsCorrect', 'Accuracy', 'Confidence', 'Cost'];
    const rows = records.map(r => [
      r.id,
      r.contractId,
      r.artifactType,
      r.timestamp.toISOString(),
      r.model,
      r.durationMs,
      r.fieldsExtracted,
      r.fieldsCorrect,
      r.fieldsExtracted > 0 ? (r.fieldsCorrect / r.fieldsExtracted).toFixed(4) : '0',
      r.averageConfidence.toFixed(4),
      r.cost.toFixed(4),
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const extractionQualityDashboardService = ExtractionQualityDashboardService.getInstance();
