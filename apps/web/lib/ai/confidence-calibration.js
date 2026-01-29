"use strict";
/* eslint-disable @typescript-eslint/no-require-imports */
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfidenceCalibrationService = void 0;
exports.getCalibrationService = getCalibrationService;
exports.recordExtractionFeedback = recordExtractionFeedback;
exports.calibrateConfidence = calibrateConfidence;
// ============================================================================
// Default Configuration
// ============================================================================
const DEFAULT_CONFIG = {
    minSamplesForCalibration: 10,
    confidenceAdjustmentRate: 0.1,
    maxCalibrationFactor: 1.5,
    minCalibrationFactor: 0.5,
    decayRate: 0.95, // 5% decay per month
};
// ============================================================================
// Confidence Calibration Service
// ============================================================================
class ConfidenceCalibrationService {
    config;
    feedbackHistory = new Map();
    fieldStats = new Map();
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // --------------------------------------------------------------------------
    // Record Feedback
    // --------------------------------------------------------------------------
    /**
     * Record human feedback on an extraction
     */
    async recordFeedback(feedback) {
        const key = this.getFieldKey(feedback.tenantId, feedback.fieldName);
        if (!this.feedbackHistory.has(key)) {
            this.feedbackHistory.set(key, []);
        }
        this.feedbackHistory.get(key).push(feedback);
        // Update stats
        await this.updateFieldStats(feedback.tenantId, feedback.fieldName, feedback.fieldType);
        // Persist to database
        await this.persistFeedback(feedback);
        console.log(`📊 Recorded feedback for ${feedback.fieldName}: ${feedback.correctionType}`);
    }
    /**
     * Record a batch of feedback at once
     */
    async recordBatchFeedback(feedbackList) {
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
    calibrateConfidence(tenantId, fieldName, originalConfidence) {
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
        }
        else if (calibrationFactor < 1) {
            reason = `AI tends to overestimate for this field (accuracy: ${(stats.accuracyRate * 100).toFixed(1)}%)`;
        }
        else {
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
    calibrateMultipleFields(tenantId, fields) {
        return fields.map(f => this.calibrateConfidence(tenantId, f.fieldName, f.confidence));
    }
    // --------------------------------------------------------------------------
    // Calculate Calibration Factor
    // --------------------------------------------------------------------------
    calculateCalibrationFactor(stats) {
        const { accuracyRate, avgConfidenceWhenCorrect, avgConfidenceWhenWrong, totalExtractions } = stats;
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
    getExtractionRecommendations(tenantId, fieldName) {
        const stats = this.getFieldStats(tenantId, fieldName);
        const recommendations = [];
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
    getSuggestedThreshold(tenantId, fieldName) {
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
    getFieldKey(tenantId, fieldName) {
        return `${tenantId}:${fieldName}`;
    }
    /**
     * Get statistics for a field
     */
    getFieldStats(tenantId, fieldName) {
        return this.fieldStats.get(this.getFieldKey(tenantId, fieldName)) || null;
    }
    /**
     * Get all field statistics for a tenant
     */
    getAllFieldStats(tenantId) {
        const stats = [];
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
    async updateFieldStats(tenantId, fieldName, fieldType) {
        const key = this.getFieldKey(tenantId, fieldName);
        const history = this.feedbackHistory.get(key) || [];
        if (history.length === 0)
            return;
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
            }
            else {
                wrongConfidence += feedback.aiConfidence * weight;
                wrongCount++;
            }
            if (feedback.correctionType === 'modified')
                modifiedCount++;
            if (feedback.correctionType === 'rejected')
                rejectedCount++;
        }
        const stats = {
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
    async learnFromCorrections(tenantId, fieldName) {
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
        const patterns = [];
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
    findCommonPrefix(strings) {
        if (strings.length === 0)
            return '';
        const first = strings[0];
        if (strings.length === 1)
            return first ?? '';
        let prefix = first ?? '';
        for (let i = 1; i < strings.length; i++) {
            const current = strings[i] ?? '';
            while (current.indexOf(prefix) !== 0) {
                prefix = prefix.slice(0, -1);
                if (prefix === '')
                    return '';
            }
        }
        return prefix;
    }
    // --------------------------------------------------------------------------
    // Persistence
    // --------------------------------------------------------------------------
    async persistFeedback(feedback) {
        try {
            const { prisma } = await Promise.resolve().then(() => __importStar(require('@/lib/prisma')));
            // Store in extraction_feedback table (create if needed)
            await prisma.$executeRaw `
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
                console.log('Could not persist feedback - table may not exist');
            });
        }
        catch {
            // Silently fail - persistence is optional
        }
    }
    /**
     * Load historical feedback from database
     */
    async loadHistoricalFeedback(tenantId) {
        try {
            const { prisma } = await Promise.resolve().then(() => __importStar(require('@/lib/prisma')));
            const results = await prisma.$queryRaw `
        SELECT * FROM extraction_feedback 
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
        LIMIT 1000
      `.catch(() => []);
            for (const row of results) {
                const feedback = {
                    contractId: row.contract_id,
                    tenantId: row.tenant_id,
                    fieldName: row.field_name,
                    fieldType: row.field_type,
                    extractedValue: row.extracted_value,
                    correctedValue: row.corrected_value,
                    aiConfidence: row.ai_confidence,
                    wasCorrect: row.was_correct,
                    correctionType: row.correction_type,
                    timestamp: row.created_at,
                };
                const key = this.getFieldKey(tenantId, feedback.fieldName);
                if (!this.feedbackHistory.has(key)) {
                    this.feedbackHistory.set(key, []);
                }
                this.feedbackHistory.get(key).push(feedback);
            }
            // Recalculate all stats
            const fieldNames = new Set(results.map(r => r.field_name));
            for (const fieldName of fieldNames) {
                const fieldType = results.find(r => r.field_name === fieldName)?.field_type || 'text';
                await this.updateFieldStats(tenantId, fieldName, fieldType);
            }
            console.log(`📊 Loaded ${results.length} historical feedback records for tenant ${tenantId}`);
        }
        catch (error) {
            console.error('Error loading historical feedback:', error);
        }
    }
    // --------------------------------------------------------------------------
    // Export/Import
    // --------------------------------------------------------------------------
    /**
     * Export calibration data for backup/transfer
     */
    exportCalibrationData(tenantId) {
        const stats = this.getAllFieldStats(tenantId);
        const feedback = [];
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
    async importCalibrationData(tenantId, data) {
        for (const feedback of data.feedback) {
            await this.recordFeedback({
                ...feedback,
                tenantId, // Override tenant ID
            });
        }
    }
}
exports.ConfidenceCalibrationService = ConfidenceCalibrationService;
// ============================================================================
// Singleton Instance
// ============================================================================
let calibrationInstance = null;
function getCalibrationService(config) {
    if (!calibrationInstance) {
        calibrationInstance = new ConfidenceCalibrationService(config);
    }
    return calibrationInstance;
}
/**
 * Record feedback on an extraction
 */
async function recordExtractionFeedback(feedback) {
    const service = getCalibrationService();
    return service.recordFeedback(feedback);
}
/**
 * Calibrate a confidence score
 */
function calibrateConfidence(tenantId, fieldName, originalConfidence) {
    const service = getCalibrationService();
    return service.calibrateConfidence(tenantId, fieldName, originalConfidence);
}
