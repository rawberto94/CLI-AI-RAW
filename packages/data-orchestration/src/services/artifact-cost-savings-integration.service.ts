/**
 * Artifact Cost Savings Integration Service
 * 
 * Integrates cost savings analysis into artifact generation workflow
 * Ensures all artifacts include relevant cost optimization insights
 */

import { createLogger } from '../utils/logger';
import { ArtifactType } from './ai-artifact-generator.service';
import { costSavingsAnalyzerService, CostSavingsAnalysis } from './cost-savings-analyzer.service';

const logger = createLogger('artifact-cost-savings-integration');

export interface ArtifactWithSavings {
  artifact: any;
  costSavings?: CostSavingsAnalysis;
  savingsSummary?: string;
}

export class ArtifactCostSavingsIntegrationService {
  private static instance: ArtifactCostSavingsIntegrationService;

  private constructor() {}

  static getInstance(): ArtifactCostSavingsIntegrationService {
    if (!ArtifactCostSavingsIntegrationService.instance) {
      ArtifactCostSavingsIntegrationService.instance = new ArtifactCostSavingsIntegrationService();
    }
    return ArtifactCostSavingsIntegrationService.instance;
  }

  /**
   * Enhance artifact with cost savings analysis
   */
  async enhanceWithCostSavings(
    artifactType: ArtifactType,
    artifact: any,
    allArtifacts: Record<string, any>
  ): Promise<ArtifactWithSavings> {
    try {
      // Only add cost savings for relevant artifact types
      if (!this.shouldIncludeCostSavings(artifactType)) {
        return { artifact };
      }

      logger.info({ artifactType }, 'Enhancing artifact with cost savings analysis');

      const savingsAnalysis = await costSavingsAnalyzerService.analyzeCostSavings(allArtifacts);
      const savingsSummary = costSavingsAnalyzerService.generateSavingsSummary(savingsAnalysis);

      // Embed savings into artifact based on type
      const enhancedArtifact = this.embedSavingsIntoArtifact(artifactType, artifact, savingsAnalysis);

      return {
        artifact: enhancedArtifact,
        costSavings: savingsAnalysis,
        savingsSummary
      };
    } catch (error) {
      logger.error({ error, artifactType }, 'Failed to enhance artifact with cost savings');
      return { artifact };
    }
  }

  /**
   * Determine if artifact type should include cost savings
   */
  private shouldIncludeCostSavings(artifactType: ArtifactType): boolean {
    return ['FINANCIAL', 'RATES', 'RISK'].includes(artifactType);
  }

  /**
   * Embed cost savings into artifact structure
   */
  private embedSavingsIntoArtifact(
    artifactType: ArtifactType,
    artifact: any,
    savingsAnalysis: CostSavingsAnalysis
  ): any {
    switch (artifactType) {
      case 'FINANCIAL':
        return {
          ...artifact,
          costSavingsOpportunities: savingsAnalysis.quickWins.slice(0, 3).map(opp => ({
            title: opp.title,
            amount: opp.potentialSavings.amount,
            currency: opp.potentialSavings.currency,
            confidence: opp.confidence
          })),
          totalPotentialSavings: savingsAnalysis.totalPotentialSavings
        };

      case 'RATES':
        const rateOpportunities = savingsAnalysis.opportunities.filter(
          opp => opp.category === 'rate_optimization'
        );
        return {
          ...artifact,
          optimizationOpportunities: rateOpportunities.map(opp => ({
            title: opp.title,
            description: opp.description,
            savings: opp.potentialSavings,
            actionItems: opp.actionItems
          }))
        };

      case 'RISK':
        return {
          ...artifact,
          costSavingsOpportunities: savingsAnalysis.opportunities.map(opp => ({
            category: opp.category,
            title: opp.title,
            savings: opp.potentialSavings.amount,
            priority: opp.priority,
            effort: opp.effort
          })),
          savingsSummary: {
            totalOpportunities: savingsAnalysis.opportunities.length,
            totalPotentialSavings: savingsAnalysis.totalPotentialSavings.amount,
            quickWinsCount: savingsAnalysis.quickWins.length
          }
        };

      default:
        return artifact;
    }
  }

  /**
   * Generate cost savings recommendations for artifact
   */
  generateRecommendations(
    artifactType: ArtifactType,
    savingsAnalysis: CostSavingsAnalysis
  ): string[] {
    const recommendations: string[] = [];

    // Top 3 opportunities
    const topOpportunities = savingsAnalysis.opportunities
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);

    for (const opp of topOpportunities) {
      recommendations.push(
        `${opp.title}: ${opp.potentialSavings.currency} ${opp.potentialSavings.amount.toLocaleString()} potential savings (${opp.confidence} confidence)`
      );
    }

    // Quick wins
    if (savingsAnalysis.quickWins.length > 0) {
      recommendations.push(
        `${savingsAnalysis.quickWins.length} quick win opportunities identified - low effort, high confidence`
      );
    }

    // Strategic initiatives
    if (savingsAnalysis.strategicInitiatives.length > 0) {
      const strategicValue = savingsAnalysis.strategicInitiatives.reduce(
        (sum, opp) => sum + opp.potentialSavings.amount,
        0
      );
      recommendations.push(
        `Strategic initiatives could yield ${savingsAnalysis.totalPotentialSavings.currency} ${strategicValue.toLocaleString()} in additional savings`
      );
    }

    return recommendations;
  }
}

export const artifactCostSavingsIntegrationService = ArtifactCostSavingsIntegrationService.getInstance();
