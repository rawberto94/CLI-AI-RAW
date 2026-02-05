/**
 * Contract Health Monitor
 * Continuously monitors contract health and predicts issues before they occur
 */

import { BaseAgent } from './base-agent';
import type {
  AgentInput,
  AgentOutput,
  ContractHealthReport,
  HealthIssue,
  HealthPrediction,
  HealthRecommendation,
  AgentRecommendation,
} from './types';
import { logger } from '../utils/logger';

export class ContractHealthMonitor extends BaseAgent {
  name = 'contract-health-monitor';
  version = '1.0.0';
  capabilities = ['health-monitoring', 'prediction', 'issue-detection'];

  async execute(input: AgentInput): Promise<AgentOutput> {
    // Defensive: contract may not be provided directly
    const contract = input.context?.contract || {
      id: input.contractId,
      // Build minimal contract from artifacts if available
      ...(input.context?.artifacts?.find?.((a: any) => a.type === 'OVERVIEW')?.data || {}),
    };

    if (!contract || !contract.id) {
      return {
        success: false,
        data: null,
        confidence: 0,
        reasoning: 'No contract data available for health assessment',
        metadata: {
          processingTime: 0,
        },
      };
    }

    const healthReport = await this.assessHealth(contract);

    // Map priority from health recommendation to agent recommendation format
    const mapPriorityToRecommendation = (p: string): 'low' | 'medium' | 'high' | 'critical' => {
      if (p === 'urgent') return 'critical';
      if (p === 'high' || p === 'medium' || p === 'low' || p === 'critical') return p;
      return 'medium';
    };

    // Map priority from health recommendation to agent action format
    const mapPriorityToAction = (p: string): 'low' | 'medium' | 'high' | 'urgent' => {
      if (p === 'critical') return 'urgent';
      if (p === 'high' || p === 'medium' || p === 'low' || p === 'urgent') return p;
      return 'medium';
    };

    // Convert to recommendations
    const recommendations: AgentRecommendation[] = healthReport.recommendations.map((rec, idx) => ({
      id: `health-rec-${idx}-${Date.now()}`,
      title: rec.action,
      description: rec.description,
      category: this.mapHealthToCategory(healthReport),
      priority: mapPriorityToRecommendation(rec.priority),
      confidence: 0.80,
      potentialValue: this.estimateImpactValue(rec),
      effort: this.mapAutomatableToEffort(rec.automatable),
      timeframe: rec.estimatedImpact || 'Immediate',
      actions: rec.automatable ? [{
        id: `auto-action-${idx}`,
        type: 'validate' as const,
        description: rec.action,
        priority: mapPriorityToAction(rec.priority),
        automated: true,
        targetEntity: {
          type: 'contract',
          id: contract.id,
        },
        payload: { recommendation: rec },
      }] : [],
      reasoning: `Health Score: ${healthReport.score}/100 (${healthReport.overallHealth})`,
    }));

    const startTime = input.metadata?.timestamp?.getTime?.() || Date.now();
    return {
      success: true,
      data: healthReport,
      recommendations,
      confidence: 0.85,
      reasoning: this.formatReasoning([
        `Overall Health: ${healthReport.overallHealth.toUpperCase()}`,
        `Health Score: ${healthReport.score}/100`,
        `Issues: ${healthReport.issues.length}`,
        `Predictions: ${healthReport.predictions.length}`,
        `Recommendations: ${healthReport.recommendations.length}`,
        '',
        ...healthReport.issues.map(issue => `⚠️  ${issue.severity.toUpperCase()}: ${issue.message}`),
        '',
        ...healthReport.predictions.map(pred => `🔮 ${pred.description} (${(pred.probability * 100).toFixed(0)}% probability)`),
      ]),
      metadata: {
        processingTime: Date.now() - startTime,
      },
    };
  }

  protected getEventType(): 'health_assessed' {
    return 'health_assessed';
  }

  /**
   * Assess overall contract health
   */
  private async assessHealth(contract: any): Promise<ContractHealthReport> {
    const issues: HealthIssue[] = [];
    const predictions: HealthPrediction[] = [];
    const recommendations: HealthRecommendation[] = [];

    // Check 1: Data completeness
    const completeness = this.calculateCompleteness(contract);
    if (completeness < 0.7) {
      issues.push({
        type: 'data_completeness',
        severity: completeness < 0.5 ? 'high' : 'medium',
        message: `Contract is only ${(completeness * 100).toFixed(0)}% complete`,
        affectedFields: this.getIncompleteFields(contract),
        detectedAt: new Date(),
        details: { completeness },
      });

      recommendations.push({
        action: 'complete_missing_data',
        priority: 'high',
        automatable: true,
        description: 'Use AI gap-filling to complete missing fields automatically',
        estimatedImpact: `Improve completeness from ${(completeness * 100).toFixed(0)}% to 90%+`,
      });
    }

    // Check 2: Risk trajectory
    const riskTrend = await this.analyzeRiskTrend(contract);
    if (riskTrend.increasing) {
      predictions.push({
        type: 'risk_escalation',
        probability: 0.75,
        timeframe: '30 days',
        impact: 'high',
        description: riskTrend.reason,
        preventable: true,
      });

      if (riskTrend.reason.includes('renewal')) {
        recommendations.push({
          action: 'initiate_renewal_planning',
          priority: 'urgent',
          automatable: true,
          description: 'Start renewal workflow now to mitigate risk',
          estimatedImpact: 'Prevent service interruption',
          requiredResources: ['Procurement team', 'Legal review'],
        });
      }
    }

    // Check 3: Compliance drift
    const complianceCheck = await this.checkComplianceDrift(contract);
    if (complianceCheck.drifted) {
      issues.push({
        type: 'compliance_drift',
        severity: 'high',
        message: 'Contract terms no longer align with current regulatory requirements',
        detectedAt: new Date(),
        details: { gaps: complianceCheck.gaps },
      });

      recommendations.push({
        action: 'schedule_amendment',
        priority: 'urgent',
        automatable: false,
        description: `Amendment required to address: ${complianceCheck.gaps.join(', ')}`,
        estimatedImpact: 'Ensure regulatory compliance',
        requiredResources: ['Legal team', 'Compliance officer'],
      });
    }

    // Check 4: Expiration monitoring
    if (contract.expirationDate) {
      const daysToExpiration = (new Date(contract.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      
      if (daysToExpiration < 90 && daysToExpiration > 0 && !contract.renewalInitiated) {
        issues.push({
          type: 'unmonitored_renewal',
          severity: daysToExpiration < 30 ? 'critical' : 'high',
          message: `Contract expires in ${Math.round(daysToExpiration)} days without renewal plan`,
          detectedAt: new Date(),
          details: { daysToExpiration },
        });

        recommendations.push({
          action: 'create_renewal_workflow',
          priority: daysToExpiration < 30 ? 'urgent' : 'high',
          automatable: true,
          description: 'Automatically create and initiate renewal workflow',
          estimatedImpact: `Prevent service disruption on ${new Date(contract.expirationDate).toLocaleDateString()}`,
        });
      }
    }

    // Check 5: Quality degradation
    if (contract.dataQualityScore && contract.dataQualityScore < 0.7) {
      issues.push({
        type: 'quality_degradation',
        severity: 'medium',
        message: `Data quality score below threshold: ${(contract.dataQualityScore * 100).toFixed(0)}%`,
        detectedAt: new Date(),
        details: { qualityScore: contract.dataQualityScore },
      });

      recommendations.push({
        action: 'run_quality_improvement',
        priority: 'medium',
        automatable: true,
        description: 'Re-process contract with enhanced extraction to improve data quality',
      });
    }

    // Calculate overall health score
    const score = this.calculateHealthScore(issues, predictions, completeness);
    const overallHealth = this.scoreToHealth(score);

    return {
      contractId: contract.id,
      overallHealth,
      score,
      issues,
      predictions,
      recommendations,
      lastAssessed: new Date(),
      nextAssessment: this.calculateNextAssessment(overallHealth),
    };
  }

  /**
   * Calculate data completeness
   */
  private calculateCompleteness(contract: any): number {
    const requiredFields = [
      'title',
      'contractType',
      'parties',
      'effectiveDate',
      'value',
      'status',
    ];

    const optionalButImportant = [
      'expirationDate',
      'department',
      'owner',
      'description',
    ];

    let score = 0;
    let maxScore = 0;

    // Required fields worth 2 points each
    for (const field of requiredFields) {
      maxScore += 2;
      if (contract[field] && contract[field] !== '' && contract[field] !== null) {
        score += 2;
      }
    }

    // Optional fields worth 1 point each
    for (const field of optionalButImportant) {
      maxScore += 1;
      if (contract[field] && contract[field] !== '' && contract[field] !== null) {
        score += 1;
      }
    }

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Get incomplete fields
   */
  private getIncompleteFields(contract: any): string[] {
    const allFields = [
      'title', 'contractType', 'parties', 'effectiveDate', 'expirationDate',
      'value', 'status', 'department', 'owner', 'description',
    ];

    return allFields.filter(field => !contract[field] || contract[field] === '' || contract[field] === null);
  }

  /**
   * Analyze risk trend
   */
  private async analyzeRiskTrend(contract: any): Promise<{ increasing: boolean; reason: string }> {
    // Check if approaching renewal without preparation
    if (contract.expirationDate) {
      const daysToExpiration = (new Date(contract.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      
      if (daysToExpiration < 90 && daysToExpiration > 0 && !contract.renewalInitiated) {
        return {
          increasing: true,
          reason: 'Contract approaching renewal without prepared strategy',
        };
      }
    }

    // Check if high-value contract with low monitoring
    if (contract.value > 500000 && !contract.lastReviewed) {
      return {
        increasing: true,
        reason: 'High-value contract lacks regular monitoring',
      };
    }

    return { increasing: false, reason: '' };
  }

  /**
   * Check for compliance drift
   */
  private async checkComplianceDrift(contract: any): Promise<{ drifted: boolean; gaps: string[] }> {
    // This would check against current regulations
    // For now, use simple heuristics

    const gaps: string[] = [];

    // Check if old contract might need GDPR updates
    if (contract.effectiveDate && new Date(contract.effectiveDate) < new Date('2018-05-25')) {
      if (contract.contractType?.includes('DATA') || contract.description?.toLowerCase().includes('data')) {
        gaps.push('GDPR compliance review needed');
      }
    }

    // Check if SaaS contract needs SOC2 review
    if (contract.contractType?.includes('SAAS') || contract.contractType?.includes('SOFTWARE')) {
      if (!contract.compliance?.includes('SOC2')) {
        gaps.push('SOC2 compliance verification needed');
      }
    }

    return {
      drifted: gaps.length > 0,
      gaps,
    };
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(
    issues: HealthIssue[],
    predictions: HealthPrediction[],
    completeness: number
  ): number {
    let score = 100;

    // Deduct for issues
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 8;
          break;
        case 'low':
          score -= 3;
          break;
      }
    }

    // Deduct for high-probability predictions
    for (const prediction of predictions) {
      if (prediction.probability > 0.7) {
        const impactDeduction = {
          'critical': 20,
          'high': 12,
          'medium': 6,
          'low': 2,
        }[prediction.impact] || 5;
        
        score -= impactDeduction * prediction.probability;
      }
    }

    // Factor in completeness
    score *= completeness;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Convert score to health rating
   */
  private scoreToHealth(score: number): ContractHealthReport['overallHealth'] {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 25) return 'poor';
    return 'critical';
  }

  /**
   * Calculate next assessment date
   */
  private calculateNextAssessment(health: ContractHealthReport['overallHealth']): Date {
    const next = new Date();
    
    switch (health) {
      case 'critical':
      case 'poor':
        next.setDate(next.getDate() + 1); // Daily
        break;
      case 'fair':
        next.setDate(next.getDate() + 3); // Every 3 days
        break;
      case 'good':
        next.setDate(next.getDate() + 7); // Weekly
        break;
      case 'excellent':
        next.setDate(next.getDate() + 14); // Bi-weekly
        break;
    }

    return next;
  }

  /**
   * Map health to recommendation category
   */
  private mapHealthToCategory(report: ContractHealthReport): AgentRecommendation['category'] {
    if (report.issues.some(i => i.type === 'compliance_drift')) {
      return 'compliance';
    }
    if (report.issues.some(i => i.type === 'data_completeness' || i.type === 'quality_degradation')) {
      return 'data-quality';
    }
    if (report.predictions.some(p => p.type === 'risk_escalation')) {
      return 'risk-mitigation';
    }
    return 'process-improvement';
  }

  /**
   * Estimate impact value
   */
  private estimateImpactValue(rec: HealthRecommendation): number | undefined {
    // Rough estimates based on recommendation type
    if (rec.action.includes('renewal')) return 50000;
    if (rec.action.includes('compliance')) return 25000;
    return undefined;
  }

  /**
   * Map automatable to effort
   */
  private mapAutomatableToEffort(automatable: boolean): 'low' | 'medium' | 'high' {
    return automatable ? 'low' : 'medium';
  }
}

// Export singleton instance
export const contractHealthMonitor = new ContractHealthMonitor();
