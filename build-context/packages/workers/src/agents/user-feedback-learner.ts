import pino from 'pino';
import clientsDb from 'clients-db';

const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
const prisma = getClient();

const logger = pino({ name: 'user-feedback-learner' });

/**
 * Feedback types
 */
export enum FeedbackType {
  ARTIFACT_EDIT = 'artifact_edit',
  ARTIFACT_REGENERATION = 'artifact_regeneration',
  QUALITY_RATING = 'quality_rating',
  ERROR_REPORT = 'error_report',
  POSITIVE_FEEDBACK = 'positive_feedback',
}

export interface UserFeedback {
  feedbackType: FeedbackType;
  artifactType: string;
  originalData: Record<string, any>;
  editedData?: Record<string, any>;
  rating?: number; // 1-5
  comment?: string;
  timestamp: Date;
  userId: string;
  tenantId: string;
}

export interface LearningInsight {
  artifactType: string;
  insight: string;
  confidence: number;
  sampleSize: number;
  recommendation: string;
}

export interface QualityAdjustment {
  artifactType: string;
  previousThresholds: {
    overall: number;
    completeness: number;
    accuracy: number;
  };
  adjustedThresholds: {
    overall: number;
    completeness: number;
    accuracy: number;
  };
  reason: string;
}

/**
 * User Feedback Learning System
 * Learns from user edits and adjusts quality thresholds
 */
export class UserFeedbackLearner {
  /**
   * Process user feedback
   */
  async processFeedback(feedback: UserFeedback): Promise<void> {
    logger.info({
      feedbackType: feedback.feedbackType,
      artifactType: feedback.artifactType,
      tenantId: feedback.tenantId,
    }, '📥 Processing user feedback');

    // Store feedback
    await this.storeFeedback(feedback);

    // Analyze patterns
    const insights = await this.analyzeFeedbackPatterns(feedback.tenantId, feedback.artifactType);

    // Adjust thresholds if needed
    if (insights.length > 0) {
      await this.adjustQualityThresholds(feedback.tenantId, feedback.artifactType, insights);
    }
  }

  /**
   * Analyze feedback patterns
   */
  private async analyzeFeedbackPatterns(
    tenantId: string,
    artifactType: string
  ): Promise<LearningInsight[]> {
    const insights: LearningInsight[] = [];

    // Get recent feedback for this artifact type
    const recentFeedback = await this.getRecentFeedback(tenantId, artifactType, 30); // Last 30 days

    if (recentFeedback.length < 5) {
      // Not enough data
      return insights;
    }

    // Analyze edit patterns
    const editCount = recentFeedback.filter(f => f.feedbackType === FeedbackType.ARTIFACT_EDIT).length;
    const editRate = editCount / recentFeedback.length;

    if (editRate > 0.5) {
      insights.push({
        artifactType,
        insight: `High edit rate (${(editRate * 100).toFixed(0)}%) suggests quality issues`,
        confidence: Math.min(0.95, editRate + 0.2),
        sampleSize: recentFeedback.length,
        recommendation: 'Increase quality thresholds or improve prompts',
      });
    }

    // Analyze common edit fields
    const editedFields = new Map<string, number>();
    for (const feedback of recentFeedback) {
      if (feedback.feedbackType === FeedbackType.ARTIFACT_EDIT && feedback.editedData) {
        const changedFields = this.getChangedFields(feedback.originalData, feedback.editedData);
        for (const field of changedFields) {
          editedFields.set(field, (editedFields.get(field) || 0) + 1);
        }
      }
    }

    // Find frequently edited fields
    for (const [field, count] of editedFields.entries()) {
      if (count > recentFeedback.length * 0.3) {
        insights.push({
          artifactType,
          insight: `Field "${field}" edited in ${count}/${recentFeedback.length} cases`,
          confidence: count / recentFeedback.length,
          sampleSize: count,
          recommendation: `Improve extraction/generation logic for "${field}"`,
        });
      }
    }

    // Analyze ratings
    const ratings = recentFeedback
      .filter(f => f.feedbackType === FeedbackType.QUALITY_RATING && f.rating)
      .map(f => f.rating!);

    if (ratings.length >= 5) {
      const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

      if (avgRating < 3) {
        insights.push({
          artifactType,
          insight: `Low average rating (${avgRating.toFixed(1)}/5)`,
          confidence: 0.8,
          sampleSize: ratings.length,
          recommendation: 'Review and improve artifact generation quality',
        });
      }
    }

    logger.info({
      artifactType,
      tenantId,
      insightCount: insights.length,
      sampleSize: recentFeedback.length,
    }, '🔍 Feedback patterns analyzed');

    return insights;
  }

  /**
   * Adjust quality thresholds based on insights
   */
  private async adjustQualityThresholds(
    tenantId: string,
    artifactType: string,
    insights: LearningInsight[]
  ): Promise<QualityAdjustment | null> {
    // Get current thresholds
    const currentThresholds = await this.getCurrentThresholds(tenantId, artifactType);

    // Determine adjustments
    let adjustOverall = 0;
    let adjustCompleteness = 0;
    let adjustAccuracy = 0;

    for (const insight of insights) {
      if (insight.confidence > 0.7) {
        // High confidence insights warrant larger adjustments
        if (insight.insight.includes('edit rate')) {
          adjustAccuracy += 0.05;
          adjustOverall += 0.03;
        }

        if (insight.insight.includes('rating')) {
          adjustOverall += 0.05;
          adjustAccuracy += 0.05;
          adjustCompleteness += 0.03;
        }

        if (insight.insight.includes('Field')) {
          adjustCompleteness += 0.03;
        }
      }
    }

    // Cap adjustments
    adjustOverall = Math.min(0.1, adjustOverall);
    adjustCompleteness = Math.min(0.1, adjustCompleteness);
    adjustAccuracy = Math.min(0.1, adjustAccuracy);

    if (adjustOverall === 0 && adjustCompleteness === 0 && adjustAccuracy === 0) {
      return null; // No adjustments needed
    }

    const adjustedThresholds = {
      overall: Math.min(0.95, currentThresholds.overall + adjustOverall),
      completeness: Math.min(0.95, currentThresholds.completeness + adjustCompleteness),
      accuracy: Math.min(0.95, currentThresholds.accuracy + adjustAccuracy),
    };

    // Store adjustment
    const adjustment: QualityAdjustment = {
      artifactType,
      previousThresholds: currentThresholds,
      adjustedThresholds,
      reason: insights.map(i => i.insight).join('; '),
    };

    await this.storeThresholdAdjustment(tenantId, adjustment);

    logger.info({
      artifactType,
      tenantId,
      previousOverall: currentThresholds.overall.toFixed(2),
      adjustedOverall: adjustedThresholds.overall.toFixed(2),
    }, '📊 Quality thresholds adjusted based on user feedback');

    return adjustment;
  }

  /**
   * Get changed fields between original and edited data
   */
  private getChangedFields(original: Record<string, any>, edited: Record<string, any>): string[] {
    const changed: string[] = [];

    for (const key of Object.keys(edited)) {
      if (JSON.stringify(original[key]) !== JSON.stringify(edited[key])) {
        changed.push(key);
      }
    }

    return changed;
  }

  /**
   * Store feedback in database
   */
  private async storeFeedback(feedback: UserFeedback): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO user_feedback_log (
          tenant_id,
          user_id,
          feedback_type,
          artifact_type,
          original_data,
          edited_data,
          rating,
          comment,
          timestamp
        ) VALUES (
          ${feedback.tenantId},
          ${feedback.userId},
          ${feedback.feedbackType},
          ${feedback.artifactType},
          ${JSON.stringify(feedback.originalData)}::jsonb,
          ${feedback.editedData ? JSON.stringify(feedback.editedData) : null}::jsonb,
          ${feedback.rating || null},
          ${feedback.comment || null},
          ${feedback.timestamp}
        )
        ON CONFLICT DO NOTHING
      `;
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to store feedback (table may not exist)');
    }
  }

  /**
   * Get recent feedback
   */
  private async getRecentFeedback(
    tenantId: string,
    artifactType: string,
    days: number
  ): Promise<UserFeedback[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const results = await prisma.$queryRaw<any[]>`
        SELECT *
        FROM user_feedback_log
        WHERE tenant_id = ${tenantId}
          AND artifact_type = ${artifactType}
          AND timestamp > ${cutoffDate}
        ORDER BY timestamp DESC
      `;

      return results.map((r: Record<string, unknown>) => ({
        feedbackType: r.feedback_type,
        artifactType: r.artifact_type,
        originalData: r.original_data,
        editedData: r.edited_data,
        rating: r.rating,
        comment: r.comment,
        timestamp: r.timestamp,
        userId: r.user_id,
        tenantId: r.tenant_id,
      }));
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get feedback');
      return [];
    }
  }

  /**
   * Get current quality thresholds
   */
  private async getCurrentThresholds(tenantId: string, artifactType: string): Promise<{
    overall: number;
    completeness: number;
    accuracy: number;
  }> {
    try {
      const result = await prisma.$queryRaw<any[]>`
        SELECT thresholds
        FROM quality_thresholds
        WHERE tenant_id = ${tenantId}
          AND artifact_type = ${artifactType}
        ORDER BY updated_at DESC
        LIMIT 1
      `;

      if (result.length > 0 && result[0].thresholds) {
        return result[0].thresholds;
      }
    } catch (error) {
      // Table may not exist, use defaults
    }

    // Default thresholds
    return {
      overall: 0.7,
      completeness: 0.6,
      accuracy: 0.7,
    };
  }

  /**
   * Store threshold adjustment
   */
  private async storeThresholdAdjustment(tenantId: string, adjustment: QualityAdjustment): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO quality_thresholds (
          tenant_id,
          artifact_type,
          thresholds,
          previous_thresholds,
          adjustment_reason,
          updated_at
        ) VALUES (
          ${tenantId},
          ${adjustment.artifactType},
          ${JSON.stringify(adjustment.adjustedThresholds)}::jsonb,
          ${JSON.stringify(adjustment.previousThresholds)}::jsonb,
          ${adjustment.reason},
          ${new Date()}
        )
        ON CONFLICT (tenant_id, artifact_type)
        DO UPDATE SET
          thresholds = ${JSON.stringify(adjustment.adjustedThresholds)}::jsonb,
          previous_thresholds = ${JSON.stringify(adjustment.previousThresholds)}::jsonb,
          adjustment_reason = ${adjustment.reason},
          updated_at = ${new Date()}
      `;
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to store threshold adjustment');
    }
  }
}

/**
 * Get singleton learner instance
 */
let learnerInstance: UserFeedbackLearner | null = null;

export function getUserFeedbackLearner(): UserFeedbackLearner {
  if (!learnerInstance) {
    learnerInstance = new UserFeedbackLearner();
  }
  return learnerInstance;
}
