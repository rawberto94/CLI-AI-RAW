/**
 * Autonomous Deadline Manager
 * Proactively monitors and manages contract deadlines with predictive analytics
 */

import { BaseAgent } from './base-agent';
import type {
  AgentInput,
  AgentOutput,
  DeadlineAssessment,
  CompletionPrediction,
  PredictionFactor,
  DeadlineAction,
  AgentAction,
} from './types';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

export class AutonomousDeadlineManager extends BaseAgent {
  name = 'autonomous-deadline-manager';
  version = '1.0.0';
  capabilities = ['deadline-management', 'prediction', 'auto-escalation'];

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { contracts } = input.context;

    // Monitor all contracts and generate actions
    const assessments = await Promise.all(
      contracts.map((contract: any) => this.assessDeadline(contract))
    );

    const allActions: AgentAction[] = [];

    // Generate actions for each assessment
    for (const assessment of assessments) {
      if (assessment.riskLevel === 'high' || assessment.riskLevel === 'critical') {
        // Auto-escalation
        allActions.push({
          id: `escalate-${assessment.contractId}-${Date.now()}`,
          type: 'escalate',
          description: assessment.recommendedActions.find((a: DeadlineAction) => a.type === 'escalate')?.description || 
                      `Contract at risk of missing deadline: ${assessment.deadline.toLocaleDateString()}`,
          priority: assessment.riskLevel === 'critical' ? 'urgent' : 'high',
          automated: true,
          targetEntity: {
            type: 'contract',
            id: assessment.contractId,
          },
          payload: {
            assessment,
            predictedCompletion: assessment.prediction.estimatedCompletionDate,
            daysOverdue: this.calculateDaysOverdue(assessment),
          },
          estimatedImpact: `Reduce risk from ${assessment.riskLevel} to medium`,
        });
      }

      // Add recommended actions
      for (const action of assessment.recommendedActions) {
        if (action.automated) {
          allActions.push({
            id: `action-${assessment.contractId}-${action.type}-${Date.now()}`,
            type: this.mapDeadlineActionType(action.type),
            description: action.description,
            priority: action.urgency === 'immediate' ? 'urgent' : action.urgency,
            automated: true,
            targetEntity: {
              type: 'contract',
              id: assessment.contractId,
            },
            payload: { action },
            estimatedImpact: action.estimatedImpact,
          });
        }
      }
    }

    const highRiskCount = assessments.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical').length;

    return {
      success: true,
      data: {
        assessments,
        summary: {
          total: assessments.length,
          critical: assessments.filter(a => a.riskLevel === 'critical').length,
          high: assessments.filter(a => a.riskLevel === 'high').length,
          medium: assessments.filter(a => a.riskLevel === 'medium').length,
          low: assessments.filter(a => a.riskLevel === 'low').length,
        },
      },
      actions: allActions,
      confidence: 0.85,
      reasoning: this.formatReasoning([
        `Monitored ${assessments.length} contracts`,
        `High/Critical Risk: ${highRiskCount}`,
        `Actions Generated: ${allActions.length}`,
        `Auto-Escalations: ${allActions.filter(a => a.type === 'escalate').length}`,
      ]),
      metadata: {
        processingTime: Date.now() - (input.metadata?.timestamp?.getTime() ?? Date.now()),
      },
    };
  }

  protected getEventType(): 'deadline_managed' {
    return 'deadline_managed';
  }

  /**
   * Assess deadline risk for a contract
   */
  private async assessDeadline(contract: any): Promise<DeadlineAssessment> {
    // Determine deadline type and date
    const { type, deadline } = this.getRelevantDeadline(contract);

    // Predict completion
    const prediction = await this.predictCompletion(contract, deadline);

    // Determine risk level
    const riskLevel = this.calculateRiskLevel(deadline, prediction);

    // Generate recommended actions
    const recommendedActions = this.generateDeadlineActions(contract, deadline, prediction, riskLevel);

    return {
      contractId: contract.id,
      type,
      deadline,
      currentStatus: contract.status || 'in-progress',
      riskLevel,
      prediction,
      recommendedActions,
    };
  }

  /**
   * Get the most relevant deadline for a contract
   */
  private getRelevantDeadline(contract: any): { type: DeadlineAssessment['type']; deadline: Date } {
    // Priority: approval deadline > renewal > obligation > milestone
    if (contract.approvalDeadline) {
      return { type: 'approval', deadline: new Date(contract.approvalDeadline) };
    }

    if (contract.expirationDate) {
      const expiration = new Date(contract.expirationDate);
      const renewalDeadline = new Date(expiration);
      renewalDeadline.setDate(renewalDeadline.getDate() - 90); // 90 days before expiration
      
      if (renewalDeadline < new Date()) {
        return { type: 'renewal', deadline: expiration };
      }
    }

    // Default to a near-future date if no deadlines found
    const defaultDeadline = new Date();
    defaultDeadline.setDate(defaultDeadline.getDate() + 30);
    
    return { type: 'milestone', deadline: defaultDeadline };
  }

  /**
   * Predict when contract processing will complete
   */
  private async predictCompletion(
    contract: any,
    deadline: Date
  ): Promise<CompletionPrediction> {
    const factors: PredictionFactor[] = [];

    // Factor 1: Current progress
    const progressFactor = this.analyzeProgress(contract);
    factors.push(progressFactor);

    // Factor 2: Historical performance
    const historicalFactor = await this.analyzeHistoricalPerformance(contract);
    factors.push(historicalFactor);

    // Factor 3: Workload
    const workloadFactor = await this.analyzeWorkload(contract);
    factors.push(workloadFactor);

    // Factor 4: Complexity
    const complexityFactor = this.analyzeComplexity(contract);
    factors.push(complexityFactor);

    // Calculate estimated completion date
    const daysRemaining = this.estimateDaysRemaining(factors);
    const estimatedCompletionDate = new Date();
    estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + daysRemaining);

    // Calculate confidence
    const confidence = this.calculatePredictionConfidence(factors);

    // Determine if at risk
    const atRisk = estimatedCompletionDate > deadline;

    return {
      estimatedCompletionDate,
      confidence,
      factors,
      atRisk,
    };
  }

  /**
   * Analyze current progress
   */
  private analyzeProgress(contract: any): PredictionFactor {
    // Simple progress estimation based on status
    const statusProgress: Record<string, number> = {
      'draft': 0.1,
      'pending_review': 0.3,
      'in_review': 0.5,
      'pending_approval': 0.7,
      'approved': 0.9,
      'active': 1.0,
    };

    const progress = statusProgress[contract.status] || 0.5;

    return {
      factor: 'Current Progress',
      impact: progress > 0.7 ? 'positive' : progress > 0.4 ? 'neutral' : 'negative',
      weight: 0.3,
      description: `Contract is ${(progress * 100).toFixed(0)}% complete`,
    };
  }

  /**
   * Analyze historical performance from completed processing jobs
   */
  private async analyzeHistoricalPerformance(contract: any): Promise<PredictionFactor> {
    try {
      const completed = await prisma.processingJob.findMany({
        where: {
          tenantId: contract.tenantId,
          status: 'COMPLETED',
          completedAt: { not: null },
          startedAt: { not: null },
          contract: { contractType: contract.contractType },
        },
        select: { startedAt: true, completedAt: true },
        orderBy: { completedAt: 'desc' },
        take: 20,
      });

      if (completed.length === 0) {
        return {
          factor: 'Historical Performance',
          impact: 'neutral',
          weight: 0.2,
          description: 'No historical data available for this contract type',
        };
      }

      const durations = completed.map(j =>
        (j.completedAt!.getTime() - j.startedAt!.getTime()) / 86400000
      );
      const avgDays = durations.reduce((a, b) => a + b, 0) / durations.length;

      const impact = avgDays <= 3 ? 'positive' : avgDays <= 7 ? 'neutral' : 'negative';

      return {
        factor: 'Historical Performance',
        impact,
        weight: 0.2,
        description: `Similar contracts completed in ${avgDays.toFixed(1)} days on average (${completed.length} samples)`,
      };
    } catch (error) {
      logger.warn({ error }, 'Failed to analyze historical performance');
      return {
        factor: 'Historical Performance',
        impact: 'neutral',
        weight: 0.2,
        description: 'Unable to retrieve historical data',
      };
    }
  }

  /**
   * Analyze current workload from active processing jobs
   */
  private async analyzeWorkload(contract: any): Promise<PredictionFactor> {
    try {
      const activeJobs = await prisma.processingJob.count({
        where: {
          tenantId: contract.tenantId,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      });

      let impact: 'positive' | 'neutral' | 'negative';
      let description: string;

      if (activeJobs <= 5) {
        impact = 'positive';
        description = `Light workload (${activeJobs} active jobs)`;
      } else if (activeJobs <= 20) {
        impact = 'neutral';
        description = `Moderate workload (${activeJobs} active jobs)`;
      } else {
        impact = 'negative';
        description = `Heavy workload (${activeJobs} active jobs) — may cause delays`;
      }

      return { factor: 'Team Workload', impact, weight: 0.2, description };
    } catch (error) {
      logger.warn({ error }, 'Failed to analyze workload');
      return {
        factor: 'Team Workload',
        impact: 'neutral',
        weight: 0.2,
        description: 'Unable to assess current workload',
      };
    }
  }

  /**
   * Analyze contract complexity
   */
  private analyzeComplexity(contract: any): PredictionFactor {
    let complexityScore = 0;

    // High value = more complex
    if (contract.value > 500000) complexityScore += 0.3;
    else if (contract.value > 100000) complexityScore += 0.2;
    else complexityScore += 0.1;

    // Long duration = more complex
    if (contract.expirationDate) {
      const duration = (new Date(contract.expirationDate).getTime() - new Date(contract.effectiveDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24);
      if (duration > 365 * 3) complexityScore += 0.3; // > 3 years
      else if (duration > 365) complexityScore += 0.2; // > 1 year
      else complexityScore += 0.1;
    }

    const impact = complexityScore > 0.5 ? 'negative' : complexityScore > 0.3 ? 'neutral' : 'positive';

    return {
      factor: 'Contract Complexity',
      impact,
      weight: 0.3,
      description: `Complexity score: ${(complexityScore * 100).toFixed(0)}/100`,
    };
  }

  /**
   * Estimate days remaining to complete
   */
  private estimateDaysRemaining(factors: PredictionFactor[]): number {
    let baselineDays = 7; // Default estimate

    for (const factor of factors) {
      const adjustment = baselineDays * factor.weight;
      
      if (factor.impact === 'positive') {
        baselineDays -= adjustment * 0.3;
      } else if (factor.impact === 'negative') {
        baselineDays += adjustment * 0.5;
      }
    }

    return Math.max(1, Math.round(baselineDays));
  }

  /**
   * Calculate prediction confidence
   */
  private calculatePredictionConfidence(factors: PredictionFactor[]): number {
    // More factors with neutral impact = higher confidence
    const neutralCount = factors.filter(f => f.impact === 'neutral').length;
    const baseConfidence = 0.7;
    
    return Math.min(0.95, baseConfidence + (neutralCount * 0.05));
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(
    deadline: Date,
    prediction: CompletionPrediction
  ): DeadlineAssessment['riskLevel'] {
    if (!prediction.atRisk) {
      return 'low';
    }

    const daysOverdue = (prediction.estimatedCompletionDate.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24);

    if (daysOverdue > 7) return 'critical';
    if (daysOverdue > 3) return 'high';
    if (daysOverdue > 1) return 'medium';
    
    return 'low';
  }

  /**
   * Calculate days overdue
   */
  private calculateDaysOverdue(assessment: DeadlineAssessment): number {
    return Math.max(0, Math.round(
      (assessment.prediction.estimatedCompletionDate.getTime() - assessment.deadline.getTime()) / (1000 * 60 * 60 * 24)
    ));
  }

  /**
   * Generate recommended actions
   */
  private generateDeadlineActions(
    contract: any,
    deadline: Date,
    prediction: CompletionPrediction,
    riskLevel: DeadlineAssessment['riskLevel']
  ): DeadlineAction[] {
    const actions: DeadlineAction[] = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      // Escalate immediately
      actions.push({
        type: 'escalate',
        description: `Escalate to supervisor - deadline at risk (${this.calculateDaysOverdue({ contractId: contract.id, type: 'approval', deadline, currentStatus: contract.status, riskLevel, prediction, recommendedActions: [] })} days overdue)`,
        automated: true,
        estimatedImpact: 'Immediate attention from senior team member',
        urgency: riskLevel === 'critical' ? 'immediate' : 'high',
      });

      // Suggest adding resources
      actions.push({
        type: 'add_resources',
        description: 'Assign additional reviewer to expedite approval process',
        automated: false,
        estimatedImpact: 'Could reduce processing time by 2-3 days',
        urgency: 'high',
      });
    }

    if (riskLevel === 'medium') {
      // Send notification
      actions.push({
        type: 'notify',
        description: 'Notify assigned reviewers of approaching deadline',
        automated: true,
        estimatedImpact: 'Increased awareness and prioritization',
        urgency: 'medium',
      });
    }

    // Check if renewal approaching
    const daysToExpiration = contract.expirationDate ? 
      (new Date(contract.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24) : Infinity;

    if (daysToExpiration < 90 && daysToExpiration > 0) {
      actions.push({
        type: 'notify',
        description: `Initiate renewal process (${Math.round(daysToExpiration)} days until expiration)`,
        automated: true,
        estimatedImpact: 'Proactive renewal planning',
        urgency: daysToExpiration < 30 ? 'high' : 'medium',
      });
    }

    return actions;
  }

  /**
   * Map deadline action type to agent action type
   */
  private mapDeadlineActionType(type: DeadlineAction['type']): AgentAction['type'] {
    const mapping: Record<DeadlineAction['type'], AgentAction['type']> = {
      'escalate': 'escalate',
      'reassign': 'update-metadata',
      'extend_deadline': 'update-metadata',
      'add_resources': 'update-metadata',
      'notify': 'send-notification',
    };

    return mapping[type] || 'send-notification';
  }
}

// Export singleton instance
export const autonomousDeadlineManager = new AutonomousDeadlineManager();
