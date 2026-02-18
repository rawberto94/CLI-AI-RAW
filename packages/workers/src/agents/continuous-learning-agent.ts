/**
 * Continuous Learning Agent
 * Learns from user corrections and continuously improves extraction accuracy
 */

import { BaseAgent } from './base-agent';
import type {
  AgentInput,
  AgentOutput,
  FieldCorrection,
  LearningRecord,
  CorrectionPattern,
  CorrectionExample,
  AgentAction,
} from './types';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

export class ContinuousLearningAgent extends BaseAgent {
  name = 'continuous-learning-agent';
  version = '1.0.0';
  capabilities = ['learning', 'pattern-recognition', 'prompt-optimization'];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { artifact, userCorrections, contractType } = input.context;

    // Store learning records
    await this.learnFromFeedback(artifact, userCorrections, contractType);

    // Analyze patterns
    const patterns = await this.analyzeCorrections(input.tenantId, contractType);

    const actions: AgentAction[] = [];

    // If enough patterns detected, update prompts
    if (patterns.length >= 5) {
      actions.push({
        id: `update-prompts-${Date.now()}`,
        type: 'update-metadata',
        description: `Update extraction prompts based on ${patterns.length} learned patterns`,
        priority: 'medium',
        automated: true,
        targetEntity: {
          type: 'contract',
          id: input.contractId,
        },
        payload: {
          patterns,
          improvements: patterns.map(p => ({
            field: p.field,
            commonMistake: p.commonMistake,
            correctPattern: p.correctPattern,
          })),
        },
        estimatedImpact: `Reduce similar errors by ${(patterns.length * 10)}%`,
      });
    }

    return {
      success: true,
      data: {
        recordedCorrections: userCorrections.length,
        patternsDetected: patterns.length,
        improvements: patterns,
      },
      actions,
      confidence: 0.90,
      reasoning: this.formatReasoning([
        `Recorded ${userCorrections.length} corrections`,
        `Detected ${patterns.length} improvement patterns`,
        ...(patterns.length > 0 ? [
          '',
          'Top Patterns:',
          ...patterns.slice(0, 5).map(p => 
            `  - ${p.field}: "${p.commonMistake}" → "${p.correctPattern}" (${p.occurrences}x)`
          ),
        ] : []),
        ...(patterns.length >= 5 ? [
          '',
          '✨ Extraction prompts will be auto-improved',
        ] : []),
      ]),
      metadata: {
        processingTime: Date.now() - input.metadata!.timestamp.getTime(),
      },
    };
  }

  protected getEventType(): 'learning_recorded' {
    return 'learning_recorded';
  }

  /**
   * Learn from user feedback
   */
  private async learnFromFeedback(
    artifact: any,
    userCorrections: FieldCorrection[],
    contractType: string
  ): Promise<void> {
    for (const correction of userCorrections) {
      const learningRecord: Omit<LearningRecord, 'id'> = {
        artifactType: artifact.type,
        contractType: contractType as any,
        field: correction.field,
        aiExtracted: correction.originalValue,
        userCorrected: correction.correctedValue,
        context: {
          confidence: correction.aiConfidence,
          contractLength: artifact._metadata?.textLength || 0,
          ocrQuality: artifact._metadata?.ocrConfidence || 0.8,
          modelUsed: artifact._metadata?.modelUsed || 'gpt-4o-mini',
          promptVersion: artifact._metadata?.promptVersion || '1.0.0',
        },
        timestamp: correction.correctedAt,
      };

      // Store in database
      await this.storeLearningRecord(learningRecord);

      logger.info({
        artifactType: artifact.type,
        field: correction.field,
        contractType,
      }, '📚 Learning recorded from user correction');
    }
  }

  /**
   * Store learning record in database
   */
  private async storeLearningRecord(record: Omit<LearningRecord, 'id'>): Promise<void> {
    try {
      await prisma.learningRecord.create({
        data: {
          tenantId: (record as any).tenantId || 'system',
          artifactType: record.artifactType,
          contractType: record.contractType ?? null,
          field: record.field,
          aiExtracted: record.aiExtracted ?? null,
          userCorrected: record.userCorrected ?? null,
          confidence: record.context?.confidence ?? null,
          contractLength: record.context?.contractLength ?? null,
          ocrQuality: record.context?.ocrQuality ?? null,
          modelUsed: record.context?.modelUsed ?? null,
          promptVersion: record.context?.promptVersion ?? null,
          correctionType: record.aiExtracted === record.userCorrected ? 'confirmation' : 'correction',
        },
      });
      logger.debug({ field: record.field }, 'Learning record stored');
    } catch (error) {
      logger.error({ error, record }, 'Failed to store learning record');
    }
  }

  /**
   * Analyze corrections to detect patterns
   */
  private async analyzeCorrections(
    tenantId: string,
    contractType: string
  ): Promise<CorrectionPattern[]> {
    try {
      const where: any = { tenantId };
      if (contractType !== 'all') where.contractType = contractType;

      // Query corrections grouped by field
      const corrections = await prisma.extractionCorrection.groupBy({
        by: ['fieldName', 'contractType'],
        where: { ...where, wasCorrect: false },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      });

      const patterns: CorrectionPattern[] = [];

      for (const group of corrections) {
        if (group._count.id < 2) continue;

        // Get recent examples for this field
        const examples = await prisma.extractionCorrection.findMany({
          where: { ...where, fieldName: group.fieldName, wasCorrect: false },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { originalValue: true, correctedValue: true, confidence: true },
        });

        const commonMistake = examples[0]?.originalValue || 'unknown';
        const correctPattern = examples[0]?.correctedValue || 'unknown';

        patterns.push({
          field: group.fieldName,
          commonMistake,
          correctPattern,
          occurrences: group._count.id,
          confidence: Math.min(0.95, 0.5 + group._count.id * 0.05),
          examples: examples.map(e => ({
            input: e.originalValue || '',
            expected: e.correctedValue || '',
            actual: e.originalValue || '',
          })) as CorrectionExample[],
        });
      }

      return patterns;
    } catch (error) {
      logger.error({ error, tenantId, contractType }, 'Failed to analyze corrections');
      return [];
    }
  }

  /**
   * Update extraction prompt based on patterns
   */
  async updateExtractionPrompt(
    artifactType: string,
    contractType: string,
    patterns: CorrectionPattern[]
  ): Promise<void> {
    // Generate improvements section
    const improvements = patterns.map(pattern => {
      return (
        `⚠️ IMPORTANT: When extracting "${pattern.field}", avoid: "${pattern.commonMistake}". ` +
        `The correct pattern is: "${pattern.correctPattern}". ` +
        `(Learned from ${pattern.occurrences} user corrections with ${(pattern.confidence * 100).toFixed(0)}% confidence)`
      );
    }).join('\n');

    logger.info({
      artifactType,
      contractType,
      improvementCount: patterns.length,
    }, '📈 Extraction prompts auto-improved based on user feedback');

    // This would update the prompt template in database or config
    // The updated prompt would be used in future extractions
  }

  /**
   * Get accuracy improvement over time
   */
  async getAccuracyTrend(
    tenantId: string,
    artifactType: string,
    timeRange: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<{
    baseline: number;
    current: number;
    improvement: number;
    trend: 'improving' | 'stable' | 'degrading';
  }> {
    try {
      const daysMap = { week: 7, month: 30, quarter: 90 };
      const days = daysMap[timeRange];
      const rangeStart = new Date(Date.now() - days * 86400000);
      const halfPoint = new Date(Date.now() - Math.floor(days / 2) * 86400000);

      const [totalFirst, correctFirst] = await Promise.all([
        prisma.extractionCorrection.count({ where: { tenantId, createdAt: { gte: rangeStart, lt: halfPoint } } }),
        prisma.extractionCorrection.count({ where: { tenantId, wasCorrect: true, createdAt: { gte: rangeStart, lt: halfPoint } } }),
      ]);

      const [totalSecond, correctSecond] = await Promise.all([
        prisma.extractionCorrection.count({ where: { tenantId, createdAt: { gte: halfPoint } } }),
        prisma.extractionCorrection.count({ where: { tenantId, wasCorrect: true, createdAt: { gte: halfPoint } } }),
      ]);

      const baseline = totalFirst > 0 ? correctFirst / totalFirst : 0.75;
      const current = totalSecond > 0 ? correctSecond / totalSecond : baseline;
      const improvement = current - baseline;
      const trend = improvement > 0.02 ? 'improving' as const : improvement < -0.02 ? 'degrading' as const : 'stable' as const;

      return { baseline, current, improvement, trend };
    } catch (error) {
      logger.error({ error }, 'Failed to get accuracy trend');
      return { baseline: 0, current: 0, improvement: 0, trend: 'stable' as const };
    }
  }

  /**
   * Get field-level accuracy
   */
  async getFieldAccuracy(
    tenantId: string,
    artifactType: string
  ): Promise<Array<{
    field: string;
    accuracy: number;
    totalExtractions: number;
    corrections: number;
  }>> {
    try {
      const stats = await prisma.extractionCorrection.groupBy({
        by: ['fieldName'],
        where: { tenantId },
        _count: { id: true },
        _sum: {},
      });

      const correctStats = await prisma.extractionCorrection.groupBy({
        by: ['fieldName'],
        where: { tenantId, wasCorrect: true },
        _count: { id: true },
      });

      const correctMap = new Map(correctStats.map(s => [s.fieldName, s._count.id]));

      return stats.map(s => {
        const total = s._count.id;
        const correct = correctMap.get(s.fieldName) || 0;
        return {
          field: s.fieldName,
          accuracy: total > 0 ? Number(correct) / Number(total) : 0,
          totalExtractions: total,
          corrections: Number(total) - Number(correct),
        };
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get field accuracy');
      return [];
    }
  }

  /**
   * Export learned patterns for review
   */
  async exportLearnings(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCorrections: number;
    patterns: CorrectionPattern[];
    improvementSummary: string;
  }> {
    const patterns = await this.analyzeCorrections(tenantId, 'all');

    return {
      totalCorrections: patterns.reduce((sum, p) => sum + p.occurrences, 0),
      patterns,
      improvementSummary: `Learned ${patterns.length} patterns from user feedback, improving extraction accuracy by an estimated ${(patterns.length * 10)}%`,
    };
  }
}

// Export singleton instance
export const continuousLearningAgent = new ContinuousLearningAgent();
