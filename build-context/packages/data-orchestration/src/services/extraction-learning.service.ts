/**
 * Extraction Learning Service
 * 
 * Provides continuous learning capabilities for the extraction system:
 * 1. Tracks extraction accuracy over time
 * 2. Learns from user corrections
 * 3. Identifies problematic fields and patterns
 * 4. Suggests extraction improvements
 * 5. Calculates calibrated confidence scores
 * 6. Provides performance analytics
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('extraction-learning');

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionFeedback {
  contractId: string;
  fieldName: string;
  extractedValue: any;
  correctedValue?: any;
  wasCorrect: boolean;
  extractionSource: string;
  extractionConfidence: number;
  timestamp: Date;
  contractType?: string;
  documentLength?: number;
  userId?: string;
}

export interface FieldPerformanceStats {
  fieldName: string;
  totalExtractions: number;
  correctExtractions: number;
  accuracy: number;
  averageConfidence: number;
  confidenceCalibration: number; // how well confidence predicts accuracy
  commonErrors: Array<{
    pattern: string;
    count: number;
    example: { extracted: any; correct: any };
  }>;
  bySource: Record<string, { count: number; accuracy: number }>;
  byContractType: Record<string, { count: number; accuracy: number }>;
  trend: 'improving' | 'stable' | 'declining';
}

export interface LearningInsight {
  type: 'pattern' | 'suggestion' | 'warning' | 'improvement';
  fieldName: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestedAction?: string;
}

export interface CalibratedConfidence {
  originalConfidence: number;
  calibratedConfidence: number;
  adjustmentReason: string;
  historicalAccuracy: number;
}

export interface ExtractionSession {
  sessionId: string;
  contractId: string;
  startTime: Date;
  endTime?: Date;
  fieldsExtracted: number;
  fieldsCorrect: number;
  fieldsCorrected: number;
  averageConfidence: number;
  contractType?: string;
}

// ============================================================================
// EXTRACTION LEARNING SERVICE
// ============================================================================

export class ExtractionLearningService {
  private static instance: ExtractionLearningService;
  
  // In-memory storage (in production, this would be persisted)
  private feedbackHistory: ExtractionFeedback[] = [];
  private fieldStats: Map<string, FieldPerformanceStats> = new Map();
  private sessions: Map<string, ExtractionSession> = new Map();
  private confidenceCalibration: Map<string, { accuracy: number; sampleSize: number }[]> = new Map();

  private constructor() {
    logger.info('Extraction Learning Service initialized');
    this.initializeFieldStats();
  }

  static getInstance(): ExtractionLearningService {
    if (!ExtractionLearningService.instance) {
      ExtractionLearningService.instance = new ExtractionLearningService();
    }
    return ExtractionLearningService.instance;
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  private initializeFieldStats(): void {
    const defaultFields = [
      'effective_date', 'expiration_date', 'total_value', 'payment_terms',
      'termination_notice', 'liability_cap', 'auto_renewal', 'governing_law',
      'parties', 'term', 'sla_uptime', 'confidentiality_period'
    ];

    for (const field of defaultFields) {
      this.fieldStats.set(field, {
        fieldName: field,
        totalExtractions: 0,
        correctExtractions: 0,
        accuracy: 0,
        averageConfidence: 0,
        confidenceCalibration: 1.0,
        commonErrors: [],
        bySource: {},
        byContractType: {},
        trend: 'stable'
      });
    }
  }

  // ==========================================================================
  // RECORD FEEDBACK
  // ==========================================================================

  recordFeedback(feedback: ExtractionFeedback): void {
    this.feedbackHistory.push(feedback);
    this.updateFieldStats(feedback);
    this.updateConfidenceCalibration(feedback);
    
    logger.info(`Recorded feedback for ${feedback.fieldName}: ${feedback.wasCorrect ? 'correct' : 'incorrect'}`);
  }

  recordCorrection(
    contractId: string,
    fieldName: string,
    extractedValue: any,
    correctedValue: any,
    extractionSource: string,
    extractionConfidence: number,
    contractType?: string
  ): void {
    this.recordFeedback({
      contractId,
      fieldName,
      extractedValue,
      correctedValue,
      wasCorrect: false,
      extractionSource,
      extractionConfidence,
      timestamp: new Date(),
      contractType
    });

    // Track error pattern
    this.trackErrorPattern(fieldName, extractedValue, correctedValue);
  }

  recordConfirmation(
    contractId: string,
    fieldName: string,
    extractedValue: any,
    extractionSource: string,
    extractionConfidence: number,
    contractType?: string
  ): void {
    this.recordFeedback({
      contractId,
      fieldName,
      extractedValue,
      wasCorrect: true,
      extractionSource,
      extractionConfidence,
      timestamp: new Date(),
      contractType
    });
  }

  // ==========================================================================
  // UPDATE STATS
  // ==========================================================================

  private updateFieldStats(feedback: ExtractionFeedback): void {
    let stats = this.fieldStats.get(feedback.fieldName);
    
    if (!stats) {
      stats = {
        fieldName: feedback.fieldName,
        totalExtractions: 0,
        correctExtractions: 0,
        accuracy: 0,
        averageConfidence: 0,
        confidenceCalibration: 1.0,
        commonErrors: [],
        bySource: {},
        byContractType: {},
        trend: 'stable'
      };
      this.fieldStats.set(feedback.fieldName, stats);
    }

    stats.totalExtractions++;
    if (feedback.wasCorrect) {
      stats.correctExtractions++;
    }
    stats.accuracy = stats.correctExtractions / stats.totalExtractions;
    
    // Update average confidence
    stats.averageConfidence = (
      (stats.averageConfidence * (stats.totalExtractions - 1)) + feedback.extractionConfidence
    ) / stats.totalExtractions;

    // Update by source
    if (!stats.bySource[feedback.extractionSource]) {
      stats.bySource[feedback.extractionSource] = { count: 0, accuracy: 0 };
    }
    const sourceStats = stats.bySource[feedback.extractionSource];
    const oldCorrect = sourceStats.accuracy * sourceStats.count;
    sourceStats.count++;
    sourceStats.accuracy = (oldCorrect + (feedback.wasCorrect ? 1 : 0)) / sourceStats.count;

    // Update by contract type
    if (feedback.contractType) {
      if (!stats.byContractType[feedback.contractType]) {
        stats.byContractType[feedback.contractType] = { count: 0, accuracy: 0 };
      }
      const typeStats = stats.byContractType[feedback.contractType];
      const oldTypeCorrect = typeStats.accuracy * typeStats.count;
      typeStats.count++;
      typeStats.accuracy = (oldTypeCorrect + (feedback.wasCorrect ? 1 : 0)) / typeStats.count;
    }

    // Update trend (based on last 50 extractions)
    this.updateTrend(stats);
  }

  private updateTrend(stats: FieldPerformanceStats): void {
    const recentFeedback = this.feedbackHistory
      .filter(f => f.fieldName === stats.fieldName)
      .slice(-50);

    if (recentFeedback.length < 20) {
      stats.trend = 'stable';
      return;
    }

    const firstHalf = recentFeedback.slice(0, 25);
    const secondHalf = recentFeedback.slice(-25);

    const firstAccuracy = firstHalf.filter(f => f.wasCorrect).length / firstHalf.length;
    const secondAccuracy = secondHalf.filter(f => f.wasCorrect).length / secondHalf.length;

    const diff = secondAccuracy - firstAccuracy;
    if (diff > 0.05) {
      stats.trend = 'improving';
    } else if (diff < -0.05) {
      stats.trend = 'declining';
    } else {
      stats.trend = 'stable';
    }
  }

  private trackErrorPattern(fieldName: string, extractedValue: any, correctedValue: any): void {
    const stats = this.fieldStats.get(fieldName);
    if (!stats) return;

    // Identify error pattern
    const pattern = this.identifyErrorPattern(extractedValue, correctedValue);
    
    const existing = stats.commonErrors.find(e => e.pattern === pattern);
    if (existing) {
      existing.count++;
    } else {
      stats.commonErrors.push({
        pattern,
        count: 1,
        example: { extracted: extractedValue, correct: correctedValue }
      });
    }

    // Keep only top 10 errors
    stats.commonErrors.sort((a, b) => b.count - a.count);
    stats.commonErrors = stats.commonErrors.slice(0, 10);
  }

  private identifyErrorPattern(extracted: any, correct: any): string {
    if (extracted === null || extracted === undefined) {
      return 'missing_extraction';
    }
    
    if (typeof extracted === 'string' && typeof correct === 'string') {
      if (extracted.toLowerCase() === correct.toLowerCase()) {
        return 'case_mismatch';
      }
      if (extracted.includes(correct) || correct.includes(extracted)) {
        return 'partial_match';
      }
      if (extracted.replace(/[^\w]/g, '') === correct.replace(/[^\w]/g, '')) {
        return 'formatting_difference';
      }
    }

    if (typeof extracted === 'number' && typeof correct === 'number') {
      const ratio = extracted / correct;
      if (ratio === 1000 || ratio === 0.001) {
        return 'unit_scale_error';
      }
      if (Math.abs(extracted - correct) < 0.01 * correct) {
        return 'rounding_error';
      }
    }

    return 'value_mismatch';
  }

  // ==========================================================================
  // CONFIDENCE CALIBRATION
  // ==========================================================================

  private updateConfidenceCalibration(feedback: ExtractionFeedback): void {
    const key = feedback.fieldName;
    let calibrationData = this.confidenceCalibration.get(key);
    
    if (!calibrationData) {
      calibrationData = [];
      this.confidenceCalibration.set(key, calibrationData);
    }

    // Bucket confidence into 10% ranges
    const bucketIndex = Math.floor(feedback.extractionConfidence * 10);
    const bucket = calibrationData[bucketIndex] || { accuracy: 0, sampleSize: 0 };
    
    const oldTotal = bucket.accuracy * bucket.sampleSize;
    bucket.sampleSize++;
    bucket.accuracy = (oldTotal + (feedback.wasCorrect ? 1 : 0)) / bucket.sampleSize;
    
    calibrationData[bucketIndex] = bucket;

    // Update field stats calibration
    const stats = this.fieldStats.get(feedback.fieldName);
    if (stats) {
      stats.confidenceCalibration = this.calculateCalibrationFactor(calibrationData);
    }
  }

  private calculateCalibrationFactor(calibrationData: { accuracy: number; sampleSize: number }[]): number {
    // Calculate how well confidence predicts accuracy
    let totalError = 0;
    let totalWeight = 0;

    for (let i = 0; i < 10; i++) {
      const bucket = calibrationData[i];
      if (bucket && bucket.sampleSize >= 5) {
        const expectedAccuracy = (i + 0.5) / 10;
        const actualAccuracy = bucket.accuracy;
        const error = Math.abs(expectedAccuracy - actualAccuracy);
        totalError += error * bucket.sampleSize;
        totalWeight += bucket.sampleSize;
      }
    }

    if (totalWeight === 0) return 1.0;
    const avgError = totalError / totalWeight;
    return 1 - avgError; // Higher is better calibrated
  }

  getCalibratedConfidence(
    fieldName: string,
    originalConfidence: number,
    extractionSource?: string,
    contractType?: string
  ): CalibratedConfidence {
    let calibratedConfidence = originalConfidence;
    let adjustmentReason = 'No adjustment needed';
    let historicalAccuracy = originalConfidence;

    const stats = this.fieldStats.get(fieldName);
    if (stats && stats.totalExtractions >= 10) {
      historicalAccuracy = stats.accuracy;

      // Adjust based on source performance
      if (extractionSource && stats.bySource[extractionSource]) {
        const sourceStats = stats.bySource[extractionSource];
        if (sourceStats.count >= 5) {
          const sourceAccuracy = sourceStats.accuracy;
          if (sourceAccuracy < originalConfidence - 0.1) {
            calibratedConfidence = (originalConfidence + sourceAccuracy) / 2;
            adjustmentReason = `Reduced based on ${extractionSource} historical accuracy (${Math.round(sourceAccuracy * 100)}%)`;
          } else if (sourceAccuracy > originalConfidence + 0.1) {
            calibratedConfidence = (originalConfidence + sourceAccuracy) / 2;
            adjustmentReason = `Increased based on ${extractionSource} historical accuracy (${Math.round(sourceAccuracy * 100)}%)`;
          }
        }
      }

      // Adjust based on contract type performance
      if (contractType && stats.byContractType[contractType]) {
        const typeStats = stats.byContractType[contractType];
        if (typeStats.count >= 5) {
          const typeAccuracy = typeStats.accuracy;
          if (typeAccuracy < calibratedConfidence - 0.1) {
            calibratedConfidence = (calibratedConfidence + typeAccuracy) / 2;
            adjustmentReason += `; adjusted for ${contractType} accuracy (${Math.round(typeAccuracy * 100)}%)`;
          }
        }
      }

      // Apply overall calibration
      if (stats.confidenceCalibration < 0.8) {
        calibratedConfidence *= stats.confidenceCalibration;
        adjustmentReason += '; calibration adjustment applied';
      }
    }

    return {
      originalConfidence,
      calibratedConfidence: Math.min(1, Math.max(0, calibratedConfidence)),
      adjustmentReason,
      historicalAccuracy
    };
  }

  // ==========================================================================
  // GET INSIGHTS
  // ==========================================================================

  getFieldPerformance(fieldName: string): FieldPerformanceStats | null {
    return this.fieldStats.get(fieldName) || null;
  }

  getAllFieldPerformance(): FieldPerformanceStats[] {
    return Array.from(this.fieldStats.values());
  }

  getInsights(): LearningInsight[] {
    const insights: LearningInsight[] = [];

    for (const stats of this.fieldStats.values()) {
      // Low accuracy warning
      if (stats.totalExtractions >= 20 && stats.accuracy < 0.7) {
        insights.push({
          type: 'warning',
          fieldName: stats.fieldName,
          message: `${stats.fieldName} has low accuracy (${Math.round(stats.accuracy * 100)}%)`,
          severity: stats.accuracy < 0.5 ? 'high' : 'medium',
          actionable: true,
          suggestedAction: 'Review extraction patterns and add more specific rules'
        });
      }

      // Declining trend warning
      if (stats.trend === 'declining') {
        insights.push({
          type: 'warning',
          fieldName: stats.fieldName,
          message: `${stats.fieldName} accuracy is declining`,
          severity: 'medium',
          actionable: true,
          suggestedAction: 'Analyze recent errors and update extraction logic'
        });
      }

      // Common error pattern
      if (stats.commonErrors.length > 0 && stats.commonErrors[0].count >= 5) {
        const topError = stats.commonErrors[0];
        insights.push({
          type: 'pattern',
          fieldName: stats.fieldName,
          message: `Common error pattern "${topError.pattern}" (${topError.count} occurrences)`,
          severity: 'medium',
          actionable: true,
          suggestedAction: this.getSuggestionForPattern(topError.pattern)
        });
      }

      // Good performance celebration
      if (stats.totalExtractions >= 50 && stats.accuracy >= 0.95) {
        insights.push({
          type: 'improvement',
          fieldName: stats.fieldName,
          message: `${stats.fieldName} is performing excellently (${Math.round(stats.accuracy * 100)}% accuracy)`,
          severity: 'low',
          actionable: false
        });
      }

      // Source performance insight
      for (const [source, sourceStats] of Object.entries(stats.bySource)) {
        if (sourceStats.count >= 10 && sourceStats.accuracy < stats.accuracy - 0.15) {
          insights.push({
            type: 'suggestion',
            fieldName: stats.fieldName,
            message: `${source} source underperforms for ${stats.fieldName} (${Math.round(sourceStats.accuracy * 100)}% vs ${Math.round(stats.accuracy * 100)}% overall)`,
            severity: 'low',
            actionable: true,
            suggestedAction: `Consider improving ${source} extraction or deprioritizing this source`
          });
        }
      }
    }

    // Sort by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return insights;
  }

  private getSuggestionForPattern(pattern: string): string {
    const suggestions: Record<string, string> = {
      'missing_extraction': 'Add more extraction patterns or lower detection thresholds',
      'case_mismatch': 'Normalize case during extraction',
      'partial_match': 'Improve boundary detection in patterns',
      'formatting_difference': 'Add format normalization post-processing',
      'unit_scale_error': 'Verify unit detection and conversion logic',
      'rounding_error': 'Review decimal handling in extraction',
      'value_mismatch': 'Review extraction patterns for this field type'
    };
    return suggestions[pattern] || 'Review extraction logic for this pattern';
  }

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  startSession(contractId: string, contractType?: string): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.sessions.set(sessionId, {
      sessionId,
      contractId,
      startTime: new Date(),
      fieldsExtracted: 0,
      fieldsCorrect: 0,
      fieldsCorrected: 0,
      averageConfidence: 0,
      contractType
    });

    return sessionId;
  }

  updateSession(
    sessionId: string,
    update: Partial<Pick<ExtractionSession, 'fieldsExtracted' | 'fieldsCorrect' | 'fieldsCorrected' | 'averageConfidence'>>
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, update);
    }
  }

  endSession(sessionId: string): ExtractionSession | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endTime = new Date();
      return session;
    }
    return null;
  }

  getSessionStats(sessionId: string): ExtractionSession | null {
    return this.sessions.get(sessionId) || null;
  }

  // ==========================================================================
  // ANALYTICS
  // ==========================================================================

  getOverallStats(): {
    totalExtractions: number;
    overallAccuracy: number;
    topPerformingFields: Array<{ field: string; accuracy: number }>;
    worstPerformingFields: Array<{ field: string; accuracy: number }>;
    bySource: Record<string, { count: number; accuracy: number }>;
    recentTrend: 'improving' | 'stable' | 'declining';
  } {
    const allStats = Array.from(this.fieldStats.values());
    
    const totalExtractions = allStats.reduce((sum, s) => sum + s.totalExtractions, 0);
    const totalCorrect = allStats.reduce((sum, s) => sum + s.correctExtractions, 0);
    const overallAccuracy = totalExtractions > 0 ? totalCorrect / totalExtractions : 0;

    // Aggregate by source
    const bySource: Record<string, { count: number; correct: number }> = {};
    for (const stats of allStats) {
      for (const [source, sourceStats] of Object.entries(stats.bySource)) {
        if (!bySource[source]) {
          bySource[source] = { count: 0, correct: 0 };
        }
        bySource[source].count += sourceStats.count;
        bySource[source].correct += sourceStats.accuracy * sourceStats.count;
      }
    }

    const bySourceResult: Record<string, { count: number; accuracy: number }> = {};
    for (const [source, data] of Object.entries(bySource)) {
      bySourceResult[source] = {
        count: data.count,
        accuracy: data.count > 0 ? data.correct / data.count : 0
      };
    }

    // Top and worst performing
    const fieldAccuracies = allStats
      .filter(s => s.totalExtractions >= 10)
      .map(s => ({ field: s.fieldName, accuracy: s.accuracy }))
      .sort((a, b) => b.accuracy - a.accuracy);

    // Recent trend
    const recentFeedback = this.feedbackHistory.slice(-100);
    let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
    
    if (recentFeedback.length >= 50) {
      const firstHalf = recentFeedback.slice(0, 50);
      const secondHalf = recentFeedback.slice(-50);
      const firstAcc = firstHalf.filter(f => f.wasCorrect).length / 50;
      const secondAcc = secondHalf.filter(f => f.wasCorrect).length / 50;
      const diff = secondAcc - firstAcc;
      
      if (diff > 0.05) recentTrend = 'improving';
      else if (diff < -0.05) recentTrend = 'declining';
    }

    return {
      totalExtractions,
      overallAccuracy,
      topPerformingFields: fieldAccuracies.slice(0, 5),
      worstPerformingFields: fieldAccuracies.slice(-5).reverse(),
      bySource: bySourceResult,
      recentTrend
    };
  }

  // ==========================================================================
  // EXPORT / IMPORT
  // ==========================================================================

  exportLearningData(): {
    feedbackHistory: ExtractionFeedback[];
    fieldStats: Record<string, FieldPerformanceStats>;
    confidenceCalibration: Record<string, { accuracy: number; sampleSize: number }[]>;
  } {
    return {
      feedbackHistory: this.feedbackHistory,
      fieldStats: Object.fromEntries(this.fieldStats),
      confidenceCalibration: Object.fromEntries(this.confidenceCalibration)
    };
  }

  importLearningData(data: {
    feedbackHistory: ExtractionFeedback[];
    fieldStats: Record<string, FieldPerformanceStats>;
    confidenceCalibration: Record<string, { accuracy: number; sampleSize: number }[]>;
  }): void {
    this.feedbackHistory = data.feedbackHistory;
    this.fieldStats = new Map(Object.entries(data.fieldStats));
    this.confidenceCalibration = new Map(Object.entries(data.confidenceCalibration));
    
    logger.info(`Imported ${this.feedbackHistory.length} feedback records`);
  }
}

// Export singleton
export const extractionLearning = ExtractionLearningService.getInstance();
