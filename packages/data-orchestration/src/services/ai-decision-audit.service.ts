/**
 * AI Decision Audit Service
 * 
 * Enterprise-grade AI governance and decision tracking:
 * - Complete audit trail of all AI decisions
 * - Confidence scoring with citations
 * - User feedback collection
 * - Compliance reporting for AI usage
 * - Explainability records
 * 
 * @version 1.0.0
 */

import { randomUUID } from 'crypto';

// Types
export type AIFeature = 
  | 'extraction'
  | 'summarization'
  | 'comparison'
  | 'risk_analysis'
  | 'clause_suggestion'
  | 'anomaly_detection'
  | 'template_matching'
  | 'validation'
  | 'translation'
  | 'chat';

export type DecisionOutcome = 'accepted' | 'rejected' | 'modified' | 'pending' | 'auto_applied';

export interface AIDecision {
  id: string;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  
  // Feature info
  feature: AIFeature;
  subFeature?: string;
  
  // Context
  contractId?: string;
  artifactId?: string;
  resourceType?: string;
  resourceId?: string;
  
  // AI details
  model: string;
  modelVersion?: string;
  promptVersion?: string;
  
  // Input/Output
  inputHash: string;
  inputSummary?: string;
  output: unknown;
  outputType: string;
  
  // Quality metrics
  confidence: number;
  processingTimeMs: number;
  tokensUsed?: number;
  estimatedCost?: number;
  
  // Citations and evidence
  citations?: Citation[];
  evidenceChain?: EvidenceItem[];
  
  // Outcome
  outcome: DecisionOutcome;
  userFeedback?: UserFeedback;
  
  // Timestamps
  createdAt: Date;
  reviewedAt?: Date;
  expiresAt?: Date;
}

export interface Citation {
  text: string;
  source: string;
  page?: number;
  section?: string;
  confidence: number;
}

export interface EvidenceItem {
  type: 'quote' | 'inference' | 'pattern' | 'rule';
  content: string;
  weight: number;
  source?: string;
}

export interface UserFeedback {
  rating?: number; // 1-5
  wasCorrect: boolean;
  correctedValue?: unknown;
  feedbackText?: string;
  feedbackCategory?: 'accuracy' | 'relevance' | 'completeness' | 'format' | 'other';
  submittedAt: Date;
  submittedBy: string;
}

export interface AIUsageStats {
  totalDecisions: number;
  byFeature: Record<AIFeature, number>;
  byModel: Record<string, number>;
  byOutcome: Record<DecisionOutcome, number>;
  avgConfidence: number;
  avgProcessingTime: number;
  totalTokens: number;
  estimatedCost: number;
  feedbackRate: number;
  accuracyRate: number;
}

export interface ComplianceReport {
  period: { start: Date; end: Date };
  tenantId: string;
  summary: {
    totalAIDecisions: number;
    humanReviewedPercent: number;
    avgConfidenceScore: number;
    accuracyRate: number;
    highRiskDecisions: number;
    overriddenDecisions: number;
  };
  byFeature: Record<string, {
    count: number;
    avgConfidence: number;
    accuracyRate: number;
    humanReviewRate: number;
  }>;
  byModel: Record<string, {
    count: number;
    avgConfidence: number;
    tokensUsed: number;
    cost: number;
  }>;
  riskFlags: RiskFlag[];
  recommendations: string[];
}

export interface RiskFlag {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'low_confidence' | 'high_rejection' | 'drift' | 'anomaly' | 'compliance';
  description: string;
  affectedDecisions: number;
  recommendation: string;
}

export interface AuditQuery {
  tenantId: string;
  startDate?: Date;
  endDate?: Date;
  feature?: AIFeature;
  model?: string;
  minConfidence?: number;
  maxConfidence?: number;
  outcome?: DecisionOutcome;
  hasUserFeedback?: boolean;
  contractId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

class AIDecisionAuditService {
  private decisions: Map<string, AIDecision> = new Map();
  private featureStats: Map<string, { total: number; correct: number; confidence: number[] }> = new Map();

  /**
   * Record an AI decision for audit
   */
  async recordDecision(
    decision: Omit<AIDecision, 'id' | 'createdAt' | 'inputHash'>
  ): Promise<AIDecision> {
    const id = randomUUID();
    const inputHash = this.hashInput(decision.output);

    const fullDecision: AIDecision = {
      id,
      inputHash,
      createdAt: new Date(),
      ...decision,
    };

    this.decisions.set(id, fullDecision);

    // Update feature stats
    this.updateFeatureStats(decision.feature, decision.confidence);

    return fullDecision;
  }

  /**
   * Record user feedback for a decision
   */
  async recordFeedback(
    decisionId: string,
    feedback: Omit<UserFeedback, 'submittedAt'>
  ): Promise<AIDecision | null> {
    const decision = this.decisions.get(decisionId);
    if (!decision) return null;

    decision.userFeedback = {
      ...feedback,
      submittedAt: new Date(),
    };
    decision.reviewedAt = new Date();

    // Update outcome based on feedback
    if (feedback.correctedValue !== undefined) {
      decision.outcome = 'modified';
    } else if (feedback.wasCorrect) {
      decision.outcome = 'accepted';
    } else {
      decision.outcome = 'rejected';
    }

    // Update accuracy stats
    this.updateAccuracyStats(decision.feature, feedback.wasCorrect);

    return decision;
  }

  /**
   * Query decisions for audit
   */
  async queryDecisions(query: AuditQuery): Promise<{
    decisions: AIDecision[];
    total: number;
    hasMore: boolean;
  }> {
    let filtered = Array.from(this.decisions.values())
      .filter(d => d.tenantId === query.tenantId);

    // Apply filters
    if (query.startDate) {
      filtered = filtered.filter(d => d.createdAt >= query.startDate!);
    }
    if (query.endDate) {
      filtered = filtered.filter(d => d.createdAt <= query.endDate!);
    }
    if (query.feature) {
      filtered = filtered.filter(d => d.feature === query.feature);
    }
    if (query.model) {
      filtered = filtered.filter(d => d.model === query.model);
    }
    if (query.minConfidence !== undefined) {
      filtered = filtered.filter(d => d.confidence >= query.minConfidence!);
    }
    if (query.maxConfidence !== undefined) {
      filtered = filtered.filter(d => d.confidence <= query.maxConfidence!);
    }
    if (query.outcome) {
      filtered = filtered.filter(d => d.outcome === query.outcome);
    }
    if (query.hasUserFeedback !== undefined) {
      filtered = filtered.filter(d => 
        query.hasUserFeedback ? d.userFeedback !== undefined : d.userFeedback === undefined
      );
    }
    if (query.contractId) {
      filtered = filtered.filter(d => d.contractId === query.contractId);
    }
    if (query.userId) {
      filtered = filtered.filter(d => d.userId === query.userId);
    }

    // Sort by date descending
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const decisions = filtered.slice(offset, offset + limit);

    return {
      decisions,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AIUsageStats> {
    let decisions = Array.from(this.decisions.values())
      .filter(d => d.tenantId === tenantId);

    if (startDate) {
      decisions = decisions.filter(d => d.createdAt >= startDate);
    }
    if (endDate) {
      decisions = decisions.filter(d => d.createdAt <= endDate);
    }

    const byFeature: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    let totalConfidence = 0;
    let totalProcessingTime = 0;
    let totalTokens = 0;
    let estimatedCost = 0;
    let feedbackCount = 0;
    let correctCount = 0;

    for (const d of decisions) {
      byFeature[d.feature] = (byFeature[d.feature] || 0) + 1;
      byModel[d.model] = (byModel[d.model] || 0) + 1;
      byOutcome[d.outcome] = (byOutcome[d.outcome] || 0) + 1;
      totalConfidence += d.confidence;
      totalProcessingTime += d.processingTimeMs;
      totalTokens += d.tokensUsed || 0;
      estimatedCost += d.estimatedCost || 0;

      if (d.userFeedback) {
        feedbackCount++;
        if (d.userFeedback.wasCorrect) {
          correctCount++;
        }
      }
    }

    const count = decisions.length || 1;

    return {
      totalDecisions: decisions.length,
      byFeature: byFeature as Record<AIFeature, number>,
      byModel,
      byOutcome: byOutcome as Record<DecisionOutcome, number>,
      avgConfidence: totalConfidence / count,
      avgProcessingTime: totalProcessingTime / count,
      totalTokens,
      estimatedCost,
      feedbackRate: feedbackCount / count,
      accuracyRate: feedbackCount > 0 ? correctCount / feedbackCount : 0,
    };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const stats = await this.getUsageStats(tenantId, startDate, endDate);
    const decisions = (await this.queryDecisions({
      tenantId,
      startDate,
      endDate,
      limit: 10000,
    })).decisions;

    // Calculate feature-level stats
    const byFeature: Record<string, any> = {};
    const byModel: Record<string, any> = {};

    for (const d of decisions) {
      // Feature stats
      if (!byFeature[d.feature]) {
        byFeature[d.feature] = {
          count: 0,
          totalConfidence: 0,
          reviewed: 0,
          correct: 0,
        };
      }
      byFeature[d.feature].count++;
      byFeature[d.feature].totalConfidence += d.confidence;
      if (d.userFeedback) {
        byFeature[d.feature].reviewed++;
        if (d.userFeedback.wasCorrect) {
          byFeature[d.feature].correct++;
        }
      }

      // Model stats
      if (!byModel[d.model]) {
        byModel[d.model] = {
          count: 0,
          totalConfidence: 0,
          tokensUsed: 0,
          cost: 0,
        };
      }
      byModel[d.model].count++;
      byModel[d.model].totalConfidence += d.confidence;
      byModel[d.model].tokensUsed += d.tokensUsed || 0;
      byModel[d.model].cost += d.estimatedCost || 0;
    }

    // Normalize stats
    for (const key in byFeature) {
      const f = byFeature[key];
      byFeature[key] = {
        count: f.count,
        avgConfidence: f.totalConfidence / f.count,
        accuracyRate: f.reviewed > 0 ? f.correct / f.reviewed : 0,
        humanReviewRate: f.reviewed / f.count,
      };
    }

    for (const key in byModel) {
      const m = byModel[key];
      byModel[key] = {
        count: m.count,
        avgConfidence: m.totalConfidence / m.count,
        tokensUsed: m.tokensUsed,
        cost: m.cost,
      };
    }

    // Identify risk flags
    const riskFlags = this.identifyRiskFlags(decisions, stats);

    // Generate recommendations
    const recommendations = this.generateRecommendations(stats, riskFlags);

    // Count high-risk and overridden decisions
    const highRiskDecisions = decisions.filter(d => d.confidence < 0.5).length;
    const overriddenDecisions = decisions.filter(d => d.outcome === 'modified').length;

    return {
      period: { start: startDate, end: endDate },
      tenantId,
      summary: {
        totalAIDecisions: stats.totalDecisions,
        humanReviewedPercent: stats.feedbackRate * 100,
        avgConfidenceScore: stats.avgConfidence,
        accuracyRate: stats.accuracyRate,
        highRiskDecisions,
        overriddenDecisions,
      },
      byFeature,
      byModel,
      riskFlags,
      recommendations,
    };
  }

  /**
   * Get decision by ID
   */
  async getDecision(decisionId: string): Promise<AIDecision | null> {
    return this.decisions.get(decisionId) || null;
  }

  /**
   * Get decisions for a contract
   */
  async getContractDecisions(
    tenantId: string,
    contractId: string
  ): Promise<AIDecision[]> {
    return Array.from(this.decisions.values())
      .filter(d => d.tenantId === tenantId && d.contractId === contractId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Export decisions for compliance
   */
  async exportDecisions(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const { decisions } = await this.queryDecisions({
      tenantId,
      startDate,
      endDate,
      limit: 100000,
    });

    if (format === 'csv') {
      const headers = [
        'id', 'feature', 'model', 'confidence', 'outcome', 
        'processingTimeMs', 'tokensUsed', 'createdAt', 'reviewedAt',
        'wasCorrect', 'feedbackText'
      ];
      const rows = decisions.map(d => [
        d.id,
        d.feature,
        d.model,
        d.confidence.toFixed(4),
        d.outcome,
        d.processingTimeMs,
        d.tokensUsed || '',
        d.createdAt.toISOString(),
        d.reviewedAt?.toISOString() || '',
        d.userFeedback?.wasCorrect ?? '',
        d.userFeedback?.feedbackText || '',
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    return JSON.stringify(decisions, null, 2);
  }

  /**
   * Identify risk flags from decisions
   */
  private identifyRiskFlags(decisions: AIDecision[], stats: AIUsageStats): RiskFlag[] {
    const flags: RiskFlag[] = [];

    // Low confidence flag
    const lowConfidenceCount = decisions.filter(d => d.confidence < 0.5).length;
    if (lowConfidenceCount > decisions.length * 0.1) {
      flags.push({
        id: randomUUID(),
        severity: 'high',
        type: 'low_confidence',
        description: `${lowConfidenceCount} decisions (${(lowConfidenceCount/decisions.length*100).toFixed(1)}%) had confidence below 50%`,
        affectedDecisions: lowConfidenceCount,
        recommendation: 'Review prompt templates and consider additional training data',
      });
    }

    // High rejection rate
    const rejectionRate = (stats.byOutcome.rejected || 0) / stats.totalDecisions;
    if (rejectionRate > 0.2) {
      flags.push({
        id: randomUUID(),
        severity: 'high',
        type: 'high_rejection',
        description: `${(rejectionRate*100).toFixed(1)}% of AI decisions were rejected by users`,
        affectedDecisions: stats.byOutcome.rejected || 0,
        recommendation: 'Analyze rejected decisions to identify patterns and improve accuracy',
      });
    }

    // Low feedback rate (compliance concern)
    if (stats.feedbackRate < 0.1 && stats.totalDecisions > 100) {
      flags.push({
        id: randomUUID(),
        severity: 'medium',
        type: 'compliance',
        description: `Only ${(stats.feedbackRate*100).toFixed(1)}% of AI decisions have human feedback`,
        affectedDecisions: Math.floor(stats.totalDecisions * (1 - stats.feedbackRate)),
        recommendation: 'Implement mandatory review for high-impact AI decisions',
      });
    }

    return flags;
  }

  /**
   * Generate recommendations based on stats
   */
  private generateRecommendations(stats: AIUsageStats, flags: RiskFlag[]): string[] {
    const recommendations: string[] = [];

    if (stats.avgConfidence < 0.7) {
      recommendations.push('Average confidence is below 70%. Consider using more capable models for complex extractions.');
    }

    if (stats.accuracyRate < 0.9 && stats.feedbackRate > 0.1) {
      recommendations.push('Accuracy rate is below 90%. Review extraction templates and add more training examples.');
    }

    if (stats.avgProcessingTime > 5000) {
      recommendations.push('Average processing time exceeds 5 seconds. Consider optimizing prompts or using faster models.');
    }

    if (stats.estimatedCost > 0) {
      const costPerDecision = stats.estimatedCost / stats.totalDecisions;
      if (costPerDecision > 0.05) {
        recommendations.push('Cost per decision is high. Consider using GPT-4o-mini for routine extractions.');
      }
    }

    // Add flag-specific recommendations
    flags.forEach(flag => {
      if (!recommendations.includes(flag.recommendation)) {
        recommendations.push(flag.recommendation);
      }
    });

    return recommendations;
  }

  /**
   * Hash input for deduplication
   */
  private hashInput(input: unknown): string {
    const str = JSON.stringify(input);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * Update feature statistics
   */
  private updateFeatureStats(feature: AIFeature, confidence: number): void {
    const key = feature;
    const existing = this.featureStats.get(key) || { total: 0, correct: 0, confidence: [] };
    existing.total++;
    existing.confidence.push(confidence);
    if (existing.confidence.length > 1000) {
      existing.confidence = existing.confidence.slice(-1000);
    }
    this.featureStats.set(key, existing);
  }

  /**
   * Update accuracy statistics
   */
  private updateAccuracyStats(feature: AIFeature, wasCorrect: boolean): void {
    const key = feature;
    const existing = this.featureStats.get(key);
    if (existing && wasCorrect) {
      existing.correct++;
    }
  }

  /**
   * Get feature accuracy
   */
  getFeatureAccuracy(feature: AIFeature): { accuracy: number; avgConfidence: number; sampleSize: number } {
    const stats = this.featureStats.get(feature);
    if (!stats || stats.total === 0) {
      return { accuracy: 0, avgConfidence: 0, sampleSize: 0 };
    }

    const avgConfidence = stats.confidence.reduce((a, b) => a + b, 0) / stats.confidence.length;
    const accuracy = stats.correct / stats.total;

    return {
      accuracy,
      avgConfidence,
      sampleSize: stats.total,
    };
  }
}

// Export singleton
export const aiDecisionAuditService = new AIDecisionAuditService();
export { AIDecisionAuditService };
