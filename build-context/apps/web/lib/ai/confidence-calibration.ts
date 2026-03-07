/**
 * Confidence Calibration Service
 * 
 * Learns from human feedback to improve extraction accuracy over time.
 * Features:
 * - Tracks extraction accuracy per field type
 * - Adjusts confidence thresholds based on historical data
 * - Provides field-specific extraction improvements
 * - Learns from corrections to improve future extractions
 */

// ============================================================================
// Types
// ============================================================================

export interface ExtractionFeedback {
  contractId: string;
  tenantId: string;
  fieldName: string;
  fieldType: string;
  extractedValue: any;
  correctedValue?: any;
  aiConfidence: number;
  wasCorrect: boolean;
  correctionType: 'accepted' | 'modified' | 'rejected';
  timestamp: Date;
  source?: string;
}

export interface FieldAccuracyStats {
  fieldName: string;
  fieldType: string;
  totalExtractions: number;
  correctExtractions: number;
  modifiedExtractions: number;
  rejectedExtractions: number;
  accuracyRate: number;
  avgConfidence: number;
  avgConfidenceWhenCorrect: number;
  avgConfidenceWhenWrong: number;
  calibrationFactor: number;
  lastUpdated: Date;
}

export interface CalibrationConfig {
  minSamplesForCalibration: number;
  confidenceAdjustmentRate: number;
  maxCalibrationFactor: number;
  minCalibrationFactor: number;
  decayRate: number; // How quickly old data loses influence
}

export interface ConfidenceAdjustment {
  fieldName: string;
  originalConfidence: number;
  calibratedConfidence: number;
  adjustmentReason: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: CalibrationConfig = {
  minSamplesForCalibration: 10,
  confidenceAdjustmentRate: 0.1,
  maxCalibrationFactor: 1.5,
  minCalibrationFactor: 0.5,
  decayRate: 0.95, // 5% decay per month
};

// ============================================================================
// Confidence Calibration Service
// ============================================================================

export class ConfidenceCalibrationService {
  private config: CalibrationConfig;
  private feedbackHistory: Map<string, ExtractionFeedback[]> = new Map();
  private fieldStats: Map<string, FieldAccuracyStats> = new Map();

  constructor(config: Partial<CalibrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // Record Feedback
  // --------------------------------------------------------------------------

  /**
   * Record human feedback on an extraction
   */
  async recordFeedback(feedback: ExtractionFeedback): Promise<void> {
    const key = this.getFieldKey(feedback.tenantId, feedback.fieldName);
    
    if (!this.feedbackHistory.has(key)) {
      this.feedbackHistory.set(key, []);
    }
    
    this.feedbackHistory.get(key)!.push(feedback);
    
    // Update stats
    await this.updateFieldStats(feedback.tenantId, feedback.fieldName, feedback.fieldType);
    
    // Persist to database
    await this.persistFeedback(feedback);
  }

  /**
   * Record a batch of feedback at once
   */
  async recordBatchFeedback(feedbackList: ExtractionFeedback[]): Promise<void> {
    for (const feedback of feedbackList) {
      await this.recordFeedback(feedback);
    }
  }

  // --------------------------------------------------------------------------
  // Calibrate Confidence
  // --------------------------------------------------------------------------

  /**
   * Calibrate a confidence score based on historical accuracy
   */
  calibrateConfidence(
    tenantId: string,
    fieldName: string,
    originalConfidence: number
  ): ConfidenceAdjustment {
    const stats = this.getFieldStats(tenantId, fieldName);
    
    if (!stats || stats.totalExtractions < this.config.minSamplesForCalibration) {
      return {
        fieldName,
        originalConfidence,
        calibratedConfidence: originalConfidence,
        adjustmentReason: 'Insufficient samples for calibration',
      };
    }

    // Calculate calibration factor
    const calibrationFactor = this.calculateCalibrationFactor(stats);
    const calibratedConfidence = Math.min(1, Math.max(0, originalConfidence * calibrationFactor));

    let reason = '';
    if (calibrationFactor > 1) {
      reason = `AI tends to underestimate for this field (accuracy: ${(stats.accuracyRate * 100).toFixed(1)}%)`;
    } else if (calibrationFactor < 1) {
      reason = `AI tends to overestimate for this field (accuracy: ${(stats.accuracyRate * 100).toFixed(1)}%)`;
    } else {
      reason = 'AI confidence is well-calibrated';
    }

    return {
      fieldName,
      originalConfidence,
      calibratedConfidence,
      adjustmentReason: reason,
    };
  }

  /**
   * Calibrate multiple fields at once
   */
  calibrateMultipleFields(
    tenantId: string,
    fields: Array<{ fieldName: string; confidence: number }>
  ): ConfidenceAdjustment[] {
    return fields.map(f => this.calibrateConfidence(tenantId, f.fieldName, f.confidence));
  }

  // --------------------------------------------------------------------------
  // Calculate Calibration Factor
  // --------------------------------------------------------------------------

  private calculateCalibrationFactor(stats: FieldAccuracyStats): number {
    const { 
      accuracyRate, 
      avgConfidenceWhenCorrect, 
      avgConfidenceWhenWrong,
      totalExtractions 
    } = stats;

    // If accuracy is good and confidence aligned with correctness, no adjustment needed
    if (accuracyRate >= 0.9 && avgConfidenceWhenCorrect > avgConfidenceWhenWrong) {
      return 1.0;
    }

    // Calculate expected vs actual accuracy ratio
    // If AI is 80% confident but only 60% accurate, factor = 0.6/0.8 = 0.75
    const avgConfidence = (avgConfidenceWhenCorrect * accuracyRate + 
                          avgConfidenceWhenWrong * (1 - accuracyRate));
    
    let factor = accuracyRate / avgConfidence;

    // Apply bounds
    factor = Math.min(this.config.maxCalibrationFactor, factor);
    factor = Math.max(this.config.minCalibrationFactor, factor);

    // Smooth the adjustment based on sample size
    const sampleWeight = Math.min(1, totalExtractions / (this.config.minSamplesForCalibration * 5));
    factor = 1 + (factor - 1) * sampleWeight;

    return factor;
  }

  // --------------------------------------------------------------------------
  // Get Recommendations
  // --------------------------------------------------------------------------

  /**
   * Get recommendations for improving extraction for a field
   */
  getExtractionRecommendations(
    tenantId: string,
    fieldName: string
  ): string[] {
    const stats = this.getFieldStats(tenantId, fieldName);
    const recommendations: string[] = [];

    if (!stats) {
      recommendations.push('Start collecting extraction feedback to enable recommendations');
      return recommendations;
    }

    if (stats.totalExtractions < this.config.minSamplesForCalibration) {
      recommendations.push(`Need ${this.config.minSamplesForCalibration - stats.totalExtractions} more samples for accurate recommendations`);
    }

    if (stats.accuracyRate < 0.7) {
      recommendations.push('Consider adding a more specific AI extraction hint');
      recommendations.push('Review field type - it may not match the data being extracted');
      recommendations.push('Consider marking this field for manual review');
    }

    if (stats.rejectedExtractions / stats.totalExtractions > 0.3) {
      recommendations.push('High rejection rate - field may not exist in most contracts');
      recommendations.push('Consider making this field optional');
    }

    if (stats.modifiedExtractions / stats.totalExtractions > 0.5) {
      recommendations.push('Frequent modifications - AI is close but not accurate');
      recommendations.push('Improve extraction hint with common patterns found in corrections');
    }

    if (stats.avgConfidenceWhenWrong > 0.8) {
      recommendations.push('AI is overconfident on wrong extractions - lower auto-approve threshold');
    }

    if (stats.avgConfidenceWhenCorrect < 0.6) {
      recommendations.push('AI is underconfident on correct extractions - may need simpler extraction prompt');
    }

    return recommendations;
  }

  /**
   * Get suggested confidence threshold for a field
   */
  getSuggestedThreshold(tenantId: string, fieldName: string): number {
    const stats = this.getFieldStats(tenantId, fieldName);
    
    if (!stats || stats.totalExtractions < this.config.minSamplesForCalibration) {
      return 0.7; // Default threshold
    }

    // Find the confidence level that maximizes accuracy
    // This would require storing individual data points
    // For now, use a simple heuristic
    
    if (stats.avgConfidenceWhenWrong > 0) {
      // Set threshold between wrong and correct average confidences
      return (stats.avgConfidenceWhenCorrect + stats.avgConfidenceWhenWrong) / 2;
    }

    return stats.avgConfidenceWhenCorrect * 0.9;
  }

  // --------------------------------------------------------------------------
  // Field Statistics
  // --------------------------------------------------------------------------

  private getFieldKey(tenantId: string, fieldName: string): string {
    return `${tenantId}:${fieldName}`;
  }

  /**
   * Get statistics for a field
   */
  getFieldStats(tenantId: string, fieldName: string): FieldAccuracyStats | null {
    return this.fieldStats.get(this.getFieldKey(tenantId, fieldName)) || null;
  }

  /**
   * Get all field statistics for a tenant
   */
  getAllFieldStats(tenantId: string): FieldAccuracyStats[] {
    const stats: FieldAccuracyStats[] = [];
    for (const [key, value] of this.fieldStats) {
      if (key.startsWith(`${tenantId}:`)) {
        stats.push(value);
      }
    }
    return stats;
  }

  /**
   * Update field statistics from feedback
   */
  private async updateFieldStats(
    tenantId: string,
    fieldName: string,
    fieldType: string
  ): Promise<void> {
    const key = this.getFieldKey(tenantId, fieldName);
    const history = this.feedbackHistory.get(key) || [];
    
    if (history.length === 0) return;

    // Calculate stats
    const now = new Date();
    let totalWeight = 0;
    let correctWeight = 0;
    let modifiedCount = 0;
    let rejectedCount = 0;
    let totalConfidence = 0;
    let correctConfidence = 0;
    let wrongConfidence = 0;
    let correctCount = 0;
    let wrongCount = 0;

    for (const feedback of history) {
      // Apply time decay
      const ageMonths = (now.getTime() - feedback.timestamp.getTime()) / (30 * 24 * 60 * 60 * 1000);
      const weight = Math.pow(this.config.decayRate, ageMonths);
      
      totalWeight += weight;
      totalConfidence += feedback.aiConfidence * weight;
      
      if (feedback.wasCorrect) {
        correctWeight += weight;
        correctConfidence += feedback.aiConfidence * weight;
        correctCount++;
      } else {
        wrongConfidence += feedback.aiConfidence * weight;
        wrongCount++;
      }
      
      if (feedback.correctionType === 'modified') modifiedCount++;
      if (feedback.correctionType === 'rejected') rejectedCount++;
    }

    const stats: FieldAccuracyStats = {
      fieldName,
      fieldType,
      totalExtractions: history.length,
      correctExtractions: history.filter(f => f.wasCorrect).length,
      modifiedExtractions: modifiedCount,
      rejectedExtractions: rejectedCount,
      accuracyRate: totalWeight > 0 ? correctWeight / totalWeight : 0,
      avgConfidence: totalWeight > 0 ? totalConfidence / totalWeight : 0,
      avgConfidenceWhenCorrect: correctCount > 0 ? correctConfidence / correctCount : 0,
      avgConfidenceWhenWrong: wrongCount > 0 ? wrongConfidence / wrongCount : 0,
      calibrationFactor: 1.0,
      lastUpdated: now,
    };

    // Calculate calibration factor
    stats.calibrationFactor = this.calculateCalibrationFactor(stats);

    this.fieldStats.set(key, stats);
  }

  // --------------------------------------------------------------------------
  // Learn from Corrections
  // --------------------------------------------------------------------------

  /**
   * Extract patterns from corrections to improve future extraction hints
   */
  async learnFromCorrections(
    tenantId: string,
    fieldName: string
  ): Promise<{ patterns: string[]; suggestedHint: string } | null> {
    const key = this.getFieldKey(tenantId, fieldName);
    const history = this.feedbackHistory.get(key) || [];
    
    // Get corrections (modified values)
    const corrections = history
      .filter(f => f.correctionType === 'modified' && f.correctedValue)
      .slice(-50); // Last 50 corrections

    if (corrections.length < 5) {
      return null;
    }

    // Analyze patterns in corrected values
    const patterns: string[] = [];
    const correctedValues = corrections.map(c => String(c.correctedValue));

    // Find common prefixes/suffixes
    const commonPrefix = this.findCommonPrefix(correctedValues);
    if (commonPrefix && commonPrefix.length > 2) {
      patterns.push(`Values often start with: "${commonPrefix}"`);
    }

    // Find common formats
    const hasDateFormat = correctedValues.every(v => /\d{4}-\d{2}-\d{2}/.test(v));
    if (hasDateFormat) {
      patterns.push('Values follow ISO date format (YYYY-MM-DD)');
    }

    const hasCurrencyFormat = correctedValues.every(v => /^\$?[\d,]+(\.\d{2})?$/.test(v));
    if (hasCurrencyFormat) {
      patterns.push('Values are currency amounts');
    }

    // Generate suggested hint
    let suggestedHint = `Look for ${fieldName}`;
    if (patterns.length > 0) {
      suggestedHint += `. ${patterns.join('. ')}`;
    }

    return { patterns, suggestedHint };
  }

  private findCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    const first = strings[0];
    if (strings.length === 1) return first ?? '';

    let prefix = first ?? '';
    for (let i = 1; i < strings.length; i++) {
      const current = strings[i] ?? '';
      while (current.indexOf(prefix) !== 0) {
        prefix = prefix.slice(0, -1);
        if (prefix === '') return '';
      }
    }
    return prefix;
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  private async persistFeedback(feedback: ExtractionFeedback): Promise<void> {
    try {
      const { prisma } = await import('@/lib/prisma');
      
      // Store in extraction_feedback table (create if needed)
      await prisma.$executeRaw`
        INSERT INTO extraction_feedback (
          contract_id,
          tenant_id,
          field_name,
          field_type,
          extracted_value,
          corrected_value,
          ai_confidence,
          was_correct,
          correction_type,
          created_at
        ) VALUES (
          ${feedback.contractId},
          ${feedback.tenantId},
          ${feedback.fieldName},
          ${feedback.fieldType},
          ${JSON.stringify(feedback.extractedValue)},
          ${feedback.correctedValue ? JSON.stringify(feedback.correctedValue) : null},
          ${feedback.aiConfidence},
          ${feedback.wasCorrect},
          ${feedback.correctionType},
          ${feedback.timestamp}
        )
      `.catch(() => {
        // Table might not exist yet - that's OK
      });
    } catch {
      // Silently fail - persistence is optional
    }
  }

  /**
   * Load historical feedback from database
   */
  async loadHistoricalFeedback(tenantId: string): Promise<void> {
    try {
      const { prisma } = await import('@/lib/prisma');

      type ExtractionFeedbackRow = {
        contract_id: string;
        tenant_id: string;
        field_name: string;
        field_type: string | null;
        extracted_value: string | null;
        corrected_value: string | null;
        ai_confidence: number | null;
        was_correct: boolean | null;
        correction_type: string | null;
        created_at: Date | string;
      };
      
      const results = await prisma.$queryRaw<ExtractionFeedbackRow[]>`
        SELECT * FROM extraction_feedback 
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
        LIMIT 1000
      `.catch(() => [] as ExtractionFeedbackRow[]);

      for (const row of results) {
        const correctionType: ExtractionFeedback['correctionType'] =
          row.correction_type === 'accepted' ||
          row.correction_type === 'modified' ||
          row.correction_type === 'rejected'
            ? row.correction_type
            : row.was_correct
              ? 'accepted'
              : row.corrected_value != null
                ? 'modified'
                : 'rejected';

        const feedback: ExtractionFeedback = {
          contractId: row.contract_id,
          tenantId: row.tenant_id,
          fieldName: row.field_name,
          fieldType: row.field_type ?? 'text',
          extractedValue: row.extracted_value,
          correctedValue: row.corrected_value,
          aiConfidence: row.ai_confidence ?? 0,
          wasCorrect: row.was_correct ?? false,
          correctionType,
          timestamp: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
        };

        const key = this.getFieldKey(tenantId, feedback.fieldName);
        if (!this.feedbackHistory.has(key)) {
          this.feedbackHistory.set(key, []);
        }
        this.feedbackHistory.get(key)!.push(feedback);
      }

      // Recalculate all stats
      const fieldNames = new Set(results.map((r) => r.field_name));
      for (const fieldName of fieldNames) {
        const fieldTypeRaw = results.find((r) => r.field_name === fieldName)?.field_type;
        const fieldType = typeof fieldTypeRaw === 'string' ? fieldTypeRaw : 'text';
        await this.updateFieldStats(tenantId, fieldName, fieldType);
      }
    } catch {
      // Failed to load historical feedback
    }
  }

  // --------------------------------------------------------------------------
  // Export/Import
  // --------------------------------------------------------------------------

  /**
   * Export calibration data for backup/transfer
   */
  exportCalibrationData(tenantId: string): {
    stats: FieldAccuracyStats[];
    feedback: ExtractionFeedback[];
  } {
    const stats = this.getAllFieldStats(tenantId);
    const feedback: ExtractionFeedback[] = [];
    
    for (const [key, history] of this.feedbackHistory) {
      if (key.startsWith(`${tenantId}:`)) {
        feedback.push(...history);
      }
    }

    return { stats, feedback };
  }

  /**
   * Import calibration data
   */
  async importCalibrationData(
    tenantId: string,
    data: { stats: FieldAccuracyStats[]; feedback: ExtractionFeedback[] }
  ): Promise<void> {
    for (const feedback of data.feedback) {
      await this.recordFeedback({
        ...feedback,
        tenantId, // Override tenant ID
      });
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let calibrationInstance: ConfidenceCalibrationService | null = null;

export function getCalibrationService(config?: Partial<CalibrationConfig>): ConfidenceCalibrationService {
  if (!calibrationInstance) {
    calibrationInstance = new ConfidenceCalibrationService(config);
  }
  return calibrationInstance;
}

/**
 * Record feedback on an extraction
 */
export async function recordExtractionFeedback(
  feedback: ExtractionFeedback
): Promise<void> {
  const service = getCalibrationService();
  return service.recordFeedback(feedback);
}

/**
 * Calibrate a confidence score
 */
export function calibrateConfidence(
  tenantId: string,
  fieldName: string,
  originalConfidence: number
): ConfidenceAdjustment {
  const service = getCalibrationService();
  return service.calibrateConfidence(tenantId, fieldName, originalConfidence);
}

// ============================================================================
// RAG Confidence Calculation (for chat responses)
// ============================================================================

/**
 * Calculate dynamic confidence for RAG-powered chat responses
 * Based on retrieval quality, source diversity, and response alignment
 */
export function calculateDynamicConfidence(
  ragResults: Array<{ score?: number; matchType?: string; sources?: string[] }>,
  response: string,
  query: string
): { confidence: number; explanation: string; tier: 'high' | 'medium' | 'low' | 'uncertain' } {
  if (ragResults.length === 0) {
    return {
      confidence: 0.3,
      explanation: 'No relevant documents found',
      tier: 'uncertain',
    };
  }

  // 1. Retrieval Quality Score (40%)
  const topScores = ragResults.slice(0, 5).map(r => r.score || 0);
  const avgScore = topScores.reduce((a, b) => a + b, 0) / topScores.length;
  const retrievalScore = avgScore;

  // 2. Coverage Score (20%)
  const highQualityCount = ragResults.filter(r => (r.score || 0) > 0.5).length;
  const coverageScore = highQualityCount >= 3 ? 1.0 : highQualityCount / 3;

  // 3. Source Diversity Score (20%)
  const matchTypes = new Set(ragResults.map(r => r.matchType).filter(Boolean));
  const hasHybrid = matchTypes.has('hybrid');
  const diversityScore = hasHybrid ? 1.0 : matchTypes.size >= 2 ? 0.7 : 0.4;

  // 4. Response Alignment Score (20%)
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);
  const responseTerms = new Set(response.toLowerCase().split(/\s+/));
  const matchCount = queryTerms.filter(t => responseTerms.has(t)).length;
  const alignmentScore = matchCount / Math.max(queryTerms.length, 1);

  // Weighted combination
  const confidence = (
    retrievalScore * 0.4 +
    coverageScore * 0.2 +
    diversityScore * 0.2 +
    alignmentScore * 0.2
  );

  // Determine tier
  let tier: 'high' | 'medium' | 'low' | 'uncertain';
  if (confidence >= 0.75) tier = 'high';
  else if (confidence >= 0.55) tier = 'medium';
  else if (confidence >= 0.35) tier = 'low';
  else tier = 'uncertain';

  // Generate explanation
  const issues: string[] = [];
  if (retrievalScore < 0.5) issues.push('low retrieval quality');
  if (coverageScore < 0.5) issues.push('limited coverage');
  if (diversityScore < 0.5) issues.push('low source diversity');

  const explanation = issues.length > 0
    ? `${tier.charAt(0).toUpperCase() + tier.slice(1)} confidence: ${issues.join(', ')}.`
    : 'High confidence response based on strong retrieval quality.';

  return {
    confidence: Math.round(confidence * 100) / 100,
    explanation,
    tier,
  };
}
