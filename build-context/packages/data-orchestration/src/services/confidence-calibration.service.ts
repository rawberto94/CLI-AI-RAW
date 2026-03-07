/**
 * Confidence Calibration Service
 * 
 * Calibrates AI confidence scores based on actual accuracy:
 * - Tracks predicted vs actual correctness
 * - Generates calibration curves
 * - Adjusts confidence scores for reliability
 * - Provides confidence intervals
 * 
 * @version 1.0.0
 */

import { createLogger } from '../utils/logger';
import { cacheAdaptor } from '../dal/cache.adaptor';

const logger = createLogger('confidence-calibration');

// =============================================================================
// TYPES
// =============================================================================

export interface CalibrationBucket {
  confidenceRange: { min: number; max: number };
  predictions: number;
  correct: number;
  actualAccuracy: number;
  calibrationError: number; // Difference between predicted and actual
}

export interface CalibrationCurve {
  artifactType: string;
  tenantId: string;
  buckets: CalibrationBucket[];
  expectedCalibrationError: number; // ECE - lower is better
  maxCalibrationError: number; // MCE
  overconfidenceScore: number; // How much AI overestimates
  underconfidenceScore: number; // How much AI underestimates
  sampleSize: number;
  lastUpdated: Date;
}

export interface CalibrationDataPoint {
  predictedConfidence: number;
  wasCorrect: boolean;
  fieldName?: string;
  artifactType: string;
  tenantId: string;
  timestamp: Date;
}

export interface CalibratedConfidence {
  original: number;
  calibrated: number;
  confidenceInterval: { low: number; high: number };
  reliability: 'high' | 'medium' | 'low';
  explanation: string;
}

// =============================================================================
// CONFIDENCE CALIBRATION SERVICE
// =============================================================================

export class ConfidenceCalibrationService {
  private static instance: ConfidenceCalibrationService;
  private dataPoints: Map<string, CalibrationDataPoint[]> = new Map();
  private calibrationCurves: Map<string, CalibrationCurve> = new Map();
  private readonly BUCKET_COUNT = 10;
  private readonly MIN_SAMPLES_FOR_CALIBRATION = 50;

  private constructor() {
    this.loadCalibrationData();
  }

  static getInstance(): ConfidenceCalibrationService {
    if (!ConfidenceCalibrationService.instance) {
      ConfidenceCalibrationService.instance = new ConfidenceCalibrationService();
    }
    return ConfidenceCalibrationService.instance;
  }

  // ===========================================================================
  // DATA COLLECTION
  // ===========================================================================

  async recordPrediction(
    artifactType: string,
    tenantId: string,
    predictedConfidence: number,
    wasCorrect: boolean,
    fieldName?: string
  ): Promise<void> {
    const key = `${tenantId}:${artifactType}`;
    const dataPoint: CalibrationDataPoint = {
      predictedConfidence: Math.max(0, Math.min(1, predictedConfidence)),
      wasCorrect,
      fieldName,
      artifactType,
      tenantId,
      timestamp: new Date(),
    };

    const existing = this.dataPoints.get(key) || [];
    existing.push(dataPoint);

    // Keep last 10000 data points
    if (existing.length > 10000) {
      existing.shift();
    }

    this.dataPoints.set(key, existing);

    // Recalculate calibration curve periodically
    if (existing.length % 100 === 0) {
      await this.recalculateCalibration(artifactType, tenantId);
    }
  }

  async recordBatchPredictions(
    predictions: Array<{
      artifactType: string;
      tenantId: string;
      predictedConfidence: number;
      wasCorrect: boolean;
      fieldName?: string;
    }>
  ): Promise<void> {
    for (const pred of predictions) {
      await this.recordPrediction(
        pred.artifactType,
        pred.tenantId,
        pred.predictedConfidence,
        pred.wasCorrect,
        pred.fieldName
      );
    }
  }

  // ===========================================================================
  // CALIBRATION CALCULATION
  // ===========================================================================

  async recalculateCalibration(
    artifactType: string,
    tenantId: string
  ): Promise<CalibrationCurve | null> {
    const key = `${tenantId}:${artifactType}`;
    const dataPoints = this.dataPoints.get(key) || [];

    if (dataPoints.length < this.MIN_SAMPLES_FOR_CALIBRATION) {
      logger.debug({ 
        artifactType, 
        tenantId, 
        samples: dataPoints.length 
      }, 'Not enough samples for calibration');
      return null;
    }

    // Create buckets
    const buckets: CalibrationBucket[] = [];
    const bucketSize = 1 / this.BUCKET_COUNT;

    for (let i = 0; i < this.BUCKET_COUNT; i++) {
      const min = i * bucketSize;
      const max = (i + 1) * bucketSize;
      
      const inBucket = dataPoints.filter(
        dp => dp.predictedConfidence >= min && dp.predictedConfidence < max
      );

      const predictions = inBucket.length;
      const correct = inBucket.filter(dp => dp.wasCorrect).length;
      const actualAccuracy = predictions > 0 ? correct / predictions : 0;
      const midpoint = (min + max) / 2;
      const calibrationError = actualAccuracy - midpoint;

      buckets.push({
        confidenceRange: { min, max },
        predictions,
        correct,
        actualAccuracy,
        calibrationError,
      });
    }

    // Calculate Expected Calibration Error (ECE)
    const ece = buckets.reduce((sum, bucket) => {
      const weight = bucket.predictions / dataPoints.length;
      return sum + weight * Math.abs(bucket.calibrationError);
    }, 0);

    // Calculate Maximum Calibration Error (MCE)
    const mce = Math.max(...buckets.map(b => Math.abs(b.calibrationError)));

    // Calculate over/underconfidence
    const overconfidenceBuckets = buckets.filter(b => b.calibrationError < 0);
    const underconfidenceBuckets = buckets.filter(b => b.calibrationError > 0);

    const overconfidenceScore = overconfidenceBuckets.reduce((sum, b) => 
      sum + Math.abs(b.calibrationError) * (b.predictions / dataPoints.length), 0);
    const underconfidenceScore = underconfidenceBuckets.reduce((sum, b) => 
      sum + b.calibrationError * (b.predictions / dataPoints.length), 0);

    const curve: CalibrationCurve = {
      artifactType,
      tenantId,
      buckets,
      expectedCalibrationError: ece,
      maxCalibrationError: mce,
      overconfidenceScore,
      underconfidenceScore,
      sampleSize: dataPoints.length,
      lastUpdated: new Date(),
    };

    this.calibrationCurves.set(key, curve);
    await this.persistCalibrationCurve(key, curve);

    logger.info({
      artifactType,
      tenantId,
      ece: ece.toFixed(3),
      mce: mce.toFixed(3),
      samples: dataPoints.length,
    }, 'Recalculated calibration curve');

    return curve;
  }

  // ===========================================================================
  // CONFIDENCE CALIBRATION
  // ===========================================================================

  calibrateConfidence(
    rawConfidence: number,
    artifactType: string,
    tenantId: string = 'default'
  ): CalibratedConfidence {
    const key = `${tenantId}:${artifactType}`;
    const curve = this.calibrationCurves.get(key);

    if (!curve || curve.sampleSize < this.MIN_SAMPLES_FOR_CALIBRATION) {
      // No calibration data, return original with wide interval
      return {
        original: rawConfidence,
        calibrated: rawConfidence,
        confidenceInterval: {
          low: Math.max(0, rawConfidence - 0.2),
          high: Math.min(1, rawConfidence + 0.2),
        },
        reliability: 'low',
        explanation: 'Insufficient calibration data. Confidence is uncalibrated.',
      };
    }

    // Find the bucket for this confidence
    const bucket = curve.buckets.find(
      b => rawConfidence >= b.confidenceRange.min && rawConfidence < b.confidenceRange.max
    ) || curve.buckets[curve.buckets.length - 1];

    // Calibrated confidence is the actual accuracy of this bucket
    const calibrated = bucket.actualAccuracy;

    // Calculate confidence interval based on sample size
    const n = bucket.predictions;
    const marginOfError = n > 0 ? 1.96 * Math.sqrt((calibrated * (1 - calibrated)) / n) : 0.5;

    // Determine reliability
    let reliability: 'high' | 'medium' | 'low';
    if (curve.expectedCalibrationError < 0.05 && n >= 100) {
      reliability = 'high';
    } else if (curve.expectedCalibrationError < 0.1 && n >= 30) {
      reliability = 'medium';
    } else {
      reliability = 'low';
    }

    // Generate explanation
    let explanation: string;
    if (calibrated > rawConfidence + 0.1) {
      explanation = `AI is underconfident. Actual accuracy (${(calibrated * 100).toFixed(0)}%) is higher than predicted (${(rawConfidence * 100).toFixed(0)}%).`;
    } else if (calibrated < rawConfidence - 0.1) {
      explanation = `AI is overconfident. Actual accuracy (${(calibrated * 100).toFixed(0)}%) is lower than predicted (${(rawConfidence * 100).toFixed(0)}%).`;
    } else {
      explanation = `Confidence is well-calibrated. Predicted and actual accuracy align closely.`;
    }

    return {
      original: rawConfidence,
      calibrated,
      confidenceInterval: {
        low: Math.max(0, calibrated - marginOfError),
        high: Math.min(1, calibrated + marginOfError),
      },
      reliability,
      explanation,
    };
  }

  // ===========================================================================
  // FIELD-LEVEL CALIBRATION
  // ===========================================================================

  async getFieldCalibration(
    artifactType: string,
    tenantId: string = 'default'
  ): Promise<Record<string, CalibrationCurve>> {
    const key = `${tenantId}:${artifactType}`;
    const dataPoints = this.dataPoints.get(key) || [];

    // Group by field
    const byField = new Map<string, CalibrationDataPoint[]>();
    for (const dp of dataPoints) {
      if (dp.fieldName) {
        const existing = byField.get(dp.fieldName) || [];
        existing.push(dp);
        byField.set(dp.fieldName, existing);
      }
    }

    const result: Record<string, CalibrationCurve> = {};

    for (const [fieldName, points] of byField) {
      if (points.length < 30) continue;

      const buckets: CalibrationBucket[] = [];
      const bucketSize = 1 / this.BUCKET_COUNT;

      for (let i = 0; i < this.BUCKET_COUNT; i++) {
        const min = i * bucketSize;
        const max = (i + 1) * bucketSize;
        
        const inBucket = points.filter(
          dp => dp.predictedConfidence >= min && dp.predictedConfidence < max
        );

        const predictions = inBucket.length;
        const correct = inBucket.filter(dp => dp.wasCorrect).length;
        const actualAccuracy = predictions > 0 ? correct / predictions : 0;
        const midpoint = (min + max) / 2;

        buckets.push({
          confidenceRange: { min, max },
          predictions,
          correct,
          actualAccuracy,
          calibrationError: actualAccuracy - midpoint,
        });
      }

      const ece = buckets.reduce((sum, bucket) => {
        const weight = bucket.predictions / points.length;
        return sum + weight * Math.abs(bucket.calibrationError);
      }, 0);

      result[fieldName] = {
        artifactType,
        tenantId,
        buckets,
        expectedCalibrationError: ece,
        maxCalibrationError: Math.max(...buckets.map(b => Math.abs(b.calibrationError))),
        overconfidenceScore: 0,
        underconfidenceScore: 0,
        sampleSize: points.length,
        lastUpdated: new Date(),
      };
    }

    return result;
  }

  // ===========================================================================
  // DIAGNOSTICS
  // ===========================================================================

  getCalibrationReport(
    artifactType: string,
    tenantId: string = 'default'
  ): {
    curve: CalibrationCurve | null;
    diagnosis: string;
    recommendations: string[];
    visualData: Array<{ predicted: number; actual: number; samples: number }>;
  } {
    const key = `${tenantId}:${artifactType}`;
    const curve = this.calibrationCurves.get(key);

    if (!curve) {
      return {
        curve: null,
        diagnosis: 'No calibration data available',
        recommendations: ['Run more extractions to collect calibration data'],
        visualData: [],
      };
    }

    const diagnosis = this.generateDiagnosis(curve);
    const recommendations = this.generateRecommendations(curve);
    const visualData = curve.buckets.map(b => ({
      predicted: (b.confidenceRange.min + b.confidenceRange.max) / 2,
      actual: b.actualAccuracy,
      samples: b.predictions,
    }));

    return { curve, diagnosis, recommendations, visualData };
  }

  private generateDiagnosis(curve: CalibrationCurve): string {
    const parts: string[] = [];

    if (curve.expectedCalibrationError < 0.05) {
      parts.push('Excellent calibration (ECE < 5%)');
    } else if (curve.expectedCalibrationError < 0.1) {
      parts.push('Good calibration (ECE < 10%)');
    } else if (curve.expectedCalibrationError < 0.2) {
      parts.push('Moderate calibration issues (ECE 10-20%)');
    } else {
      parts.push('Poor calibration (ECE > 20%)');
    }

    if (curve.overconfidenceScore > curve.underconfidenceScore * 1.5) {
      parts.push('AI tends to be overconfident');
    } else if (curve.underconfidenceScore > curve.overconfidenceScore * 1.5) {
      parts.push('AI tends to be underconfident');
    }

    return parts.join('. ');
  }

  private generateRecommendations(curve: CalibrationCurve): string[] {
    const recommendations: string[] = [];

    if (curve.expectedCalibrationError > 0.1) {
      recommendations.push('Consider applying Platt scaling or temperature scaling to confidence scores');
    }

    if (curve.overconfidenceScore > 0.1) {
      recommendations.push('Add more conservative instructions to prompts to reduce overconfidence');
      recommendations.push('Increase training examples for edge cases');
    }

    if (curve.underconfidenceScore > 0.1) {
      recommendations.push('AI may be too conservative - review prompt wording');
    }

    // Check for specific problematic buckets
    for (const bucket of curve.buckets) {
      if (bucket.predictions >= 30 && Math.abs(bucket.calibrationError) > 0.2) {
        const range = `${(bucket.confidenceRange.min * 100).toFixed(0)}-${(bucket.confidenceRange.max * 100).toFixed(0)}%`;
        if (bucket.calibrationError < 0) {
          recommendations.push(`Review extractions with confidence ${range} - actual accuracy is lower than predicted`);
        } else {
          recommendations.push(`Confidence ${range} range is underutilized - AI is overly conservative here`);
        }
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Calibration looks good - continue monitoring');
    }

    return recommendations;
  }

  // ===========================================================================
  // PERSISTENCE
  // ===========================================================================

  private async loadCalibrationData(): Promise<void> {
    logger.info('Confidence calibration service initialized');
  }

  private async persistCalibrationCurve(key: string, curve: CalibrationCurve): Promise<void> {
    await cacheAdaptor.set(`calibration:${key}`, curve, 86400 * 30);
  }

  // ===========================================================================
  // UTILITY
  // ===========================================================================

  getSampleCount(artifactType: string, tenantId: string = 'default'): number {
    const key = `${tenantId}:${artifactType}`;
    return (this.dataPoints.get(key) || []).length;
  }

  isCalibrated(artifactType: string, tenantId: string = 'default'): boolean {
    return this.getSampleCount(artifactType, tenantId) >= this.MIN_SAMPLES_FOR_CALIBRATION;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const confidenceCalibrationService = ConfidenceCalibrationService.getInstance();
