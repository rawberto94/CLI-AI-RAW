/**
 * Extraction Analytics Service
 * 
 * Tracks and analyzes metadata extraction performance:
 * - Success rates by field type
 * - Confidence distributions
 * - Common extraction errors
 * - Processing time metrics
 * - User correction patterns
 */

import { prisma } from "@/lib/prisma";
import type { MetadataFieldType, MetadataFieldDefinition } from "@/lib/services/metadata-schema.service";

// Local type alias for compatibility
type FieldType = MetadataFieldType;

// Extracted field result
interface ExtractedField {
  fieldKey: string;
  value: any;
  confidence: number;
  fieldType?: FieldType;
}

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionEvent {
  id: string;
  contractId: string;
  tenantId: string;
  timestamp: Date;
  eventType: ExtractionEventType;
  fieldKey?: string;
  fieldType?: FieldType;
  confidence?: number;
  originalValue?: any;
  correctedValue?: any;
  processingTimeMs?: number;
  modelUsed?: string;
  success: boolean;
  errorMessage?: string;
}

export type ExtractionEventType = 
  | "extraction_started"
  | "extraction_completed"
  | "extraction_failed"
  | "field_extracted"
  | "field_auto_applied"
  | "field_corrected"
  | "field_rejected"
  | "validation_issue";

export interface FieldTypeMetrics {
  fieldType: FieldType;
  totalExtractions: number;
  successfulExtractions: number;
  autoApplied: number;
  corrected: number;
  rejected: number;
  averageConfidence: number;
  accuracyRate: number;
  correctionRate: number;
}

export interface TenantAnalytics {
  tenantId: string;
  period: { start: Date; end: Date };
  totalExtractions: number;
  successfulExtractions: number;
  failedExtractions: number;
  averageProcessingTime: number;
  averageConfidence: number;
  fieldMetrics: FieldTypeMetrics[];
  topErrors: Array<{ error: string; count: number }>;
  dailyTrend: Array<{
    date: string;
    extractions: number;
    successRate: number;
    avgConfidence: number;
  }>;
}

export interface GlobalAnalytics {
  period: { start: Date; end: Date };
  totalTenants: number;
  totalExtractions: number;
  successRate: number;
  averageConfidence: number;
  modelPerformance: Array<{
    model: string;
    extractions: number;
    successRate: number;
    avgProcessingTime: number;
  }>;
  fieldTypeRanking: FieldTypeMetrics[];
}

// ============================================================================
// ANALYTICS SERVICE
// ============================================================================

export class ExtractionAnalyticsService {
  private events: ExtractionEvent[] = [];
  private maxEventsInMemory = 10000;

  // --------------------------------------------------------------------------
  // Event Recording
  // --------------------------------------------------------------------------

  /**
   * Record an extraction event
   */
  async recordEvent(event: Omit<ExtractionEvent, "id" | "timestamp">): Promise<void> {
    const fullEvent: ExtractionEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);

    // Trim if too many events in memory
    if (this.events.length > this.maxEventsInMemory) {
      this.events = this.events.slice(-this.maxEventsInMemory);
    }

    // Persist to database asynchronously
    this.persistEvent(fullEvent).catch(console.error);
  }

  /**
   * Record extraction start
   */
  async recordExtractionStart(contractId: string, tenantId: string): Promise<string> {
    const eventId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.recordEvent({
      contractId,
      tenantId,
      eventType: "extraction_started",
      success: true,
    });

    return eventId;
  }

  /**
   * Record extraction completion
   */
  async recordExtractionComplete(
    contractId: string,
    tenantId: string,
    fields: ExtractedField[],
    processingTimeMs: number,
    modelUsed: string
  ): Promise<void> {
    // Record overall completion
    await this.recordEvent({
      contractId,
      tenantId,
      eventType: "extraction_completed",
      processingTimeMs,
      modelUsed,
      success: true,
    });

    // Record individual field extractions
    for (const field of fields) {
      await this.recordEvent({
        contractId,
        tenantId,
        eventType: "field_extracted",
        fieldKey: field.fieldKey,
        fieldType: field.fieldType,
        confidence: field.confidence ?? undefined,
        modelUsed,
        success: field.value !== null,
      });
    }
  }

  /**
   * Record extraction failure
   */
  async recordExtractionFailed(
    contractId: string,
    tenantId: string,
    errorMessage: string,
    processingTimeMs?: number
  ): Promise<void> {
    await this.recordEvent({
      contractId,
      tenantId,
      eventType: "extraction_failed",
      processingTimeMs,
      success: false,
      errorMessage,
    });
  }

  /**
   * Record when a field is auto-applied
   */
  async recordFieldAutoApplied(
    contractId: string,
    tenantId: string,
    fieldKey: string,
    fieldType: FieldType,
    value: any,
    confidence: number
  ): Promise<void> {
    await this.recordEvent({
      contractId,
      tenantId,
      eventType: "field_auto_applied",
      fieldKey,
      fieldType,
      confidence,
      originalValue: value,
      success: true,
    });
  }

  /**
   * Record when a user corrects a field
   */
  async recordFieldCorrected(
    contractId: string,
    tenantId: string,
    fieldKey: string,
    fieldType: FieldType,
    originalValue: any,
    correctedValue: any,
    originalConfidence?: number
  ): Promise<void> {
    await this.recordEvent({
      contractId,
      tenantId,
      eventType: "field_corrected",
      fieldKey,
      fieldType,
      confidence: originalConfidence,
      originalValue,
      correctedValue,
      success: true,
    });
  }

  /**
   * Record when a user rejects a field extraction
   */
  async recordFieldRejected(
    contractId: string,
    tenantId: string,
    fieldKey: string,
    fieldType: FieldType,
    rejectedValue: any,
    originalConfidence?: number
  ): Promise<void> {
    await this.recordEvent({
      contractId,
      tenantId,
      eventType: "field_rejected",
      fieldKey,
      fieldType,
      confidence: originalConfidence,
      originalValue: rejectedValue,
      success: false,
    });
  }

  // --------------------------------------------------------------------------
  // Analytics Queries
  // --------------------------------------------------------------------------

  /**
   * Get analytics for a specific tenant
   */
  async getTenantAnalytics(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TenantAnalytics> {
    const start = startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    const end = endDate ?? new Date();

    // Filter events for this tenant and date range
    const tenantEvents = this.events.filter(
      e => e.tenantId === tenantId && 
           e.timestamp >= start && 
           e.timestamp <= end
    );

    // Calculate basic metrics
    const extractions = tenantEvents.filter(e => e.eventType === "extraction_completed");
    const failures = tenantEvents.filter(e => e.eventType === "extraction_failed");
    const fieldEvents = tenantEvents.filter(e => e.eventType === "field_extracted");

    const processingTimes = extractions
      .map(e => e.processingTimeMs)
      .filter((t): t is number => t !== undefined);

    const confidences = fieldEvents
      .map(e => e.confidence)
      .filter((c): c is number => c !== undefined);

    // Field type breakdown
    const fieldMetrics = this.calculateFieldMetrics(tenantEvents);

    // Error analysis
    const topErrors = this.calculateTopErrors(tenantEvents);

    // Daily trend
    const dailyTrend = this.calculateDailyTrend(tenantEvents);

    return {
      tenantId,
      period: { start, end },
      totalExtractions: extractions.length + failures.length,
      successfulExtractions: extractions.length,
      failedExtractions: failures.length,
      averageProcessingTime: processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0,
      averageConfidence: confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0,
      fieldMetrics,
      topErrors,
      dailyTrend,
    };
  }

  /**
   * Get global analytics across all tenants
   */
  async getGlobalAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<GlobalAnalytics> {
    const start = startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ?? new Date();

    const periodEvents = this.events.filter(
      e => e.timestamp >= start && e.timestamp <= end
    );

    const tenants = new Set(periodEvents.map(e => e.tenantId));
    const extractions = periodEvents.filter(e => e.eventType === "extraction_completed");
    const failures = periodEvents.filter(e => e.eventType === "extraction_failed");
    
    const totalExtractions = extractions.length + failures.length;
    const successRate = totalExtractions > 0 
      ? extractions.length / totalExtractions 
      : 0;

    const confidences = periodEvents
      .filter(e => e.eventType === "field_extracted")
      .map(e => e.confidence)
      .filter((c): c is number => c !== undefined);

    // Model performance
    const modelStats = new Map<string, { 
      extractions: number; 
      successes: number;
      totalTime: number;
    }>();

    for (const event of periodEvents) {
      if (event.modelUsed && (event.eventType === "extraction_completed" || event.eventType === "extraction_failed")) {
        const stats = modelStats.get(event.modelUsed) ?? { 
          extractions: 0, 
          successes: 0, 
          totalTime: 0 
        };
        stats.extractions++;
        if (event.success) stats.successes++;
        if (event.processingTimeMs) stats.totalTime += event.processingTimeMs;
        modelStats.set(event.modelUsed, stats);
      }
    }

    const modelPerformance = Array.from(modelStats.entries()).map(([model, stats]) => ({
      model,
      extractions: stats.extractions,
      successRate: stats.extractions > 0 ? stats.successes / stats.extractions : 0,
      avgProcessingTime: stats.extractions > 0 ? stats.totalTime / stats.extractions : 0,
    }));

    return {
      period: { start, end },
      totalTenants: tenants.size,
      totalExtractions,
      successRate,
      averageConfidence: confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0,
      modelPerformance,
      fieldTypeRanking: this.calculateFieldMetrics(periodEvents),
    };
  }

  /**
   * Get improvement recommendations based on analytics
   */
  async getRecommendations(tenantId: string): Promise<string[]> {
    const analytics = await this.getTenantAnalytics(tenantId);
    const recommendations: string[] = [];

    // Low overall confidence
    if (analytics.averageConfidence < 0.6) {
      recommendations.push(
        "Consider providing more context in contract documents or simplifying field definitions"
      );
    }

    // High correction rate fields
    for (const metric of analytics.fieldMetrics) {
      if (metric.correctionRate > 0.3 && metric.totalExtractions > 10) {
        recommendations.push(
          `Field type "${metric.fieldType}" has a ${Math.round(metric.correctionRate * 100)}% correction rate. ` +
          `Consider refining extraction prompts or adding more training data.`
        );
      }
    }

    // Specific field type issues
    const lowAccuracyFields = analytics.fieldMetrics
      .filter(m => m.accuracyRate < 0.7 && m.totalExtractions > 5)
      .sort((a, b) => a.accuracyRate - b.accuracyRate);

    if (lowAccuracyFields.length > 0) {
      const fieldNames = lowAccuracyFields.slice(0, 3).map(f => f.fieldType).join(", ");
      recommendations.push(
        `Focus on improving extraction for: ${fieldNames}`
      );
    }

    // Slow processing
    if (analytics.averageProcessingTime > 30000) {
      recommendations.push(
        "Average processing time is high. Consider using faster models for initial extraction " +
        "or reducing the number of fields extracted in a single pass."
      );
    }

    return recommendations;
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private calculateFieldMetrics(events: ExtractionEvent[]): FieldTypeMetrics[] {
    const metrics = new Map<FieldType, {
      total: number;
      successful: number;
      autoApplied: number;
      corrected: number;
      rejected: number;
      confidenceSum: number;
      confidenceCount: number;
    }>();

    for (const event of events) {
      if (!event.fieldType) continue;

      const current = metrics.get(event.fieldType) ?? {
        total: 0,
        successful: 0,
        autoApplied: 0,
        corrected: 0,
        rejected: 0,
        confidenceSum: 0,
        confidenceCount: 0,
      };

      switch (event.eventType) {
        case "field_extracted":
          current.total++;
          if (event.success) current.successful++;
          if (event.confidence !== undefined) {
            current.confidenceSum += event.confidence;
            current.confidenceCount++;
          }
          break;
        case "field_auto_applied":
          current.autoApplied++;
          break;
        case "field_corrected":
          current.corrected++;
          break;
        case "field_rejected":
          current.rejected++;
          break;
      }

      metrics.set(event.fieldType, current);
    }

    return Array.from(metrics.entries()).map(([fieldType, stats]) => ({
      fieldType,
      totalExtractions: stats.total,
      successfulExtractions: stats.successful,
      autoApplied: stats.autoApplied,
      corrected: stats.corrected,
      rejected: stats.rejected,
      averageConfidence: stats.confidenceCount > 0 
        ? stats.confidenceSum / stats.confidenceCount 
        : 0,
      accuracyRate: stats.autoApplied + stats.corrected > 0
        ? stats.autoApplied / (stats.autoApplied + stats.corrected)
        : 1,
      correctionRate: stats.autoApplied + stats.corrected > 0
        ? stats.corrected / (stats.autoApplied + stats.corrected)
        : 0,
    }));
  }

  private calculateTopErrors(events: ExtractionEvent[]): Array<{ error: string; count: number }> {
    const errorCounts = new Map<string, number>();

    for (const event of events) {
      if (event.errorMessage) {
        const count = errorCounts.get(event.errorMessage) ?? 0;
        errorCounts.set(event.errorMessage, count + 1);
      }
    }

    return Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculateDailyTrend(events: ExtractionEvent[]): Array<{
    date: string;
    extractions: number;
    successRate: number;
    avgConfidence: number;
  }> {
    const daily = new Map<string, {
      total: number;
      successful: number;
      confidenceSum: number;
      confidenceCount: number;
    }>();

    for (const event of events) {
      if (event.eventType === "extraction_completed" || event.eventType === "extraction_failed") {
        const date = event.timestamp.toISOString().split("T")[0] ?? '';
        const stats = daily.get(date) ?? {
          total: 0,
          successful: 0,
          confidenceSum: 0,
          confidenceCount: 0,
        };

        stats.total++;
        if (event.success) stats.successful++;
        
        daily.set(date, stats);
      }

      if (event.eventType === "field_extracted" && event.confidence !== undefined) {
        const date = event.timestamp.toISOString().split("T")[0] ?? '';
        const stats = daily.get(date);
        if (stats) {
          stats.confidenceSum += event.confidence;
          stats.confidenceCount++;
        }
      }
    }

    return Array.from(daily.entries())
      .map(([date, stats]) => ({
        date,
        extractions: stats.total,
        successRate: stats.total > 0 ? stats.successful / stats.total : 0,
        avgConfidence: stats.confidenceCount > 0 
          ? stats.confidenceSum / stats.confidenceCount 
          : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private async persistEvent(event: ExtractionEvent): Promise<void> {
    // Store in database for long-term analytics
    try {
      // This would persist to a dedicated analytics table
      // For now, just log
      console.debug(`📊 Analytics event: ${event.eventType}`, {
        contractId: event.contractId,
        fieldKey: event.fieldKey,
        success: event.success,
      });
    } catch (error) {
      console.error("Failed to persist analytics event:", error);
    }
  }

  // --------------------------------------------------------------------------
  // Real-time Insights
  // --------------------------------------------------------------------------

  /**
   * Get real-time extraction performance insights
   */
  async getRealTimeInsights(tenantId: string): Promise<{
    currentPerformance: {
      successRate: number;
      avgConfidence: number;
      avgProcessingTime: number;
    };
    trends: {
      successRateTrend: 'improving' | 'stable' | 'declining';
      confidenceTrend: 'improving' | 'stable' | 'declining';
      processingTimeTrend: 'improving' | 'stable' | 'declining';
    };
    recommendations: string[];
    alerts: Array<{
      type: 'warning' | 'error' | 'info';
      message: string;
      fieldType?: string;
    }>;
  }> {
    const recentEvents = this.events
      .filter(e => e.tenantId === tenantId)
      .slice(-100);

    const last24h = this.events
      .filter(e => 
        e.tenantId === tenantId && 
        e.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );

    const previous24h = this.events
      .filter(e => 
        e.tenantId === tenantId && 
        e.timestamp > new Date(Date.now() - 48 * 60 * 60 * 1000) &&
        e.timestamp <= new Date(Date.now() - 24 * 60 * 60 * 1000)
      );

    // Calculate current performance
    const successCount = recentEvents.filter(e => e.success).length;
    const avgConfidence = this.calculateAverage(
      recentEvents.filter(e => e.confidence !== undefined).map(e => e.confidence!)
    );
    const avgProcessingTime = this.calculateAverage(
      recentEvents.filter(e => e.processingTimeMs !== undefined).map(e => e.processingTimeMs!)
    );

    // Calculate trends
    const last24hSuccess = last24h.filter(e => e.success).length / Math.max(last24h.length, 1);
    const prev24hSuccess = previous24h.filter(e => e.success).length / Math.max(previous24h.length, 1);

    const last24hConfidence = this.calculateAverage(
      last24h.filter(e => e.confidence !== undefined).map(e => e.confidence!)
    );
    const prev24hConfidence = this.calculateAverage(
      previous24h.filter(e => e.confidence !== undefined).map(e => e.confidence!)
    );

    const last24hTime = this.calculateAverage(
      last24h.filter(e => e.processingTimeMs !== undefined).map(e => e.processingTimeMs!)
    );
    const prev24hTime = this.calculateAverage(
      previous24h.filter(e => e.processingTimeMs !== undefined).map(e => e.processingTimeMs!)
    );

    const determineTrend = (current: number, previous: number, threshold = 0.05): 'improving' | 'stable' | 'declining' => {
      const diff = current - previous;
      if (Math.abs(diff) < threshold) return 'stable';
      return diff > 0 ? 'improving' : 'declining';
    };

    // Generate recommendations
    const recommendations: string[] = [];
    const alerts: Array<{ type: 'warning' | 'error' | 'info'; message: string; fieldType?: string }> = [];

    // Analyze field-type performance
    const fieldTypeStats = this.groupByFieldType(recentEvents);
    
    for (const [fieldType, stats] of Object.entries(fieldTypeStats)) {
      if (stats.successRate < 0.7) {
        alerts.push({
          type: 'warning',
          message: `${fieldType} fields have low success rate (${(stats.successRate * 100).toFixed(0)}%)`,
          fieldType,
        });
        recommendations.push(`Review AI prompts for ${fieldType} fields to improve accuracy`);
      }

      if (stats.avgConfidence < 0.6) {
        recommendations.push(`Consider adding more context for ${fieldType} field extraction`);
      }
    }

    // Check for high correction rates
    const correctionEvents = recentEvents.filter(e => e.eventType === 'field_corrected');
    if (correctionEvents.length > recentEvents.length * 0.3) {
      alerts.push({
        type: 'info',
        message: 'High manual correction rate detected - consider retraining extraction patterns',
      });
      recommendations.push('Review frequently corrected fields and update extraction hints');
    }

    // Check for processing time issues
    if (avgProcessingTime > 5000) {
      alerts.push({
        type: 'warning',
        message: 'Average processing time exceeds 5 seconds',
      });
      recommendations.push('Consider using batch extraction or reducing document chunk size');
    }

    return {
      currentPerformance: {
        successRate: successCount / Math.max(recentEvents.length, 1),
        avgConfidence,
        avgProcessingTime,
      },
      trends: {
        successRateTrend: determineTrend(last24hSuccess, prev24hSuccess),
        confidenceTrend: determineTrend(last24hConfidence, prev24hConfidence),
        processingTimeTrend: determineTrend(prev24hTime, last24hTime), // Lower is better for time
      },
      recommendations,
      alerts,
    };
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private groupByFieldType(events: ExtractionEvent[]): Record<string, {
    count: number;
    successRate: number;
    avgConfidence: number;
  }> {
    const grouped: Record<string, {
      total: number;
      successful: number;
      confidenceSum: number;
      confidenceCount: number;
    }> = {};

    for (const event of events) {
      if (!event.fieldType) continue;

      if (!grouped[event.fieldType]) {
        grouped[event.fieldType] = {
          total: 0,
          successful: 0,
          confidenceSum: 0,
          confidenceCount: 0,
        };
      }

      const fieldTypeGroup = grouped[event.fieldType];
      if (fieldTypeGroup) {
        fieldTypeGroup.total++;
        if (event.success) fieldTypeGroup.successful++;
        if (event.confidence !== undefined) {
          fieldTypeGroup.confidenceSum += event.confidence;
          fieldTypeGroup.confidenceCount++;
        }
      }
    }

    const result: Record<string, { count: number; successRate: number; avgConfidence: number }> = {};
    
    for (const [fieldType, stats] of Object.entries(grouped)) {
      result[fieldType] = {
        count: stats.total,
        successRate: stats.total > 0 ? stats.successful / stats.total : 0,
        avgConfidence: stats.confidenceCount > 0 
          ? stats.confidenceSum / stats.confidenceCount 
          : 0,
      };
    }

    return result;
  }

  /**
   * Get extraction quality score for a tenant
   */
  getQualityScore(tenantId: string): {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    breakdown: {
      accuracy: number;
      confidence: number;
      efficiency: number;
      userSatisfaction: number;
    };
  } {
    const tenantEvents = this.events.filter(e => e.tenantId === tenantId);
    
    if (tenantEvents.length < 10) {
      return {
        score: 0,
        grade: 'F',
        breakdown: { accuracy: 0, confidence: 0, efficiency: 0, userSatisfaction: 0 },
      };
    }

    // Accuracy: success rate
    const accuracy = tenantEvents.filter(e => e.success).length / tenantEvents.length;

    // Confidence: average confidence when successful
    const successfulEvents = tenantEvents.filter(e => e.success && e.confidence !== undefined);
    const confidence = successfulEvents.length > 0
      ? successfulEvents.reduce((sum, e) => sum + e.confidence!, 0) / successfulEvents.length
      : 0;

    // Efficiency: based on processing time (faster is better)
    const eventsWithTime = tenantEvents.filter(e => e.processingTimeMs !== undefined);
    const avgTime = eventsWithTime.length > 0
      ? eventsWithTime.reduce((sum, e) => sum + e.processingTimeMs!, 0) / eventsWithTime.length
      : 3000;
    const efficiency = Math.max(0, 1 - (avgTime / 10000)); // 10s = 0 efficiency

    // User satisfaction: based on correction rate (lower is better)
    const correctionRate = tenantEvents.filter(e => e.eventType === 'field_corrected').length / tenantEvents.length;
    const userSatisfaction = 1 - Math.min(correctionRate, 1);

    // Calculate overall score
    const score = (accuracy * 0.4 + confidence * 0.3 + efficiency * 0.15 + userSatisfaction * 0.15) * 100;

    // Determine grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    return {
      score: Math.round(score),
      grade,
      breakdown: {
        accuracy: Math.round(accuracy * 100),
        confidence: Math.round(confidence * 100),
        efficiency: Math.round(efficiency * 100),
        userSatisfaction: Math.round(userSatisfaction * 100),
      },
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let analyticsInstance: ExtractionAnalyticsService | null = null;

export function getExtractionAnalytics(): ExtractionAnalyticsService {
  if (!analyticsInstance) {
    analyticsInstance = new ExtractionAnalyticsService();
  }
  return analyticsInstance;
}
