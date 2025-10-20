/**
 * Artifact Context Enrichment Service
 * 
 * Enriches artifact generation with context from previously generated artifacts
 * to improve accuracy and consistency.
 * Includes cost savings analysis for indirect procurement.
 */

import pino from 'pino';
import { ArtifactType } from './ai-artifact-generator.service';
import { costSavingsAnalyzerService } from './cost-savings-analyzer.service';

const logger = pino({ name: 'artifact-context-enrichment-service' });

export interface EnrichedContext {
  type: ArtifactType;
  relevantData: Record<string, any>;
  dependencies: ArtifactType[];
  contextSummary: string;
}

export interface DependencyGraph {
  nodes: ArtifactType[];
  edges: Map<ArtifactType, ArtifactType[]>;
}

const ARTIFACT_DEPENDENCIES: Record<ArtifactType, ArtifactType[]> = {
  OVERVIEW: [],
  FINANCIAL: ['OVERVIEW'],
  CLAUSES: ['OVERVIEW'],
  RATES: ['OVERVIEW', 'FINANCIAL'],
  COMPLIANCE: ['OVERVIEW', 'CLAUSES'],
  RISK: ['OVERVIEW', 'FINANCIAL', 'CLAUSES']
};

export class ArtifactContextEnrichmentService {
  private static instance: ArtifactContextEnrichmentService;

  private constructor() {
    logger.info('Artifact Context Enrichment Service initialized');
  }

  static getInstance(): ArtifactContextEnrichmentService {
    if (!ArtifactContextEnrichmentService.instance) {
      ArtifactContextEnrichmentService.instance = new ArtifactContextEnrichmentService();
    }
    return ArtifactContextEnrichmentService.instance;
  }

  enrichContext(
    targetType: ArtifactType,
    previousArtifacts: Map<ArtifactType, any>
  ): EnrichedContext {
    const dependencies = ARTIFACT_DEPENDENCIES[targetType] || [];
    const relevantData: Record<string, any> = {};

    for (const depType of dependencies) {
      const artifact = previousArtifacts.get(depType);
      if (artifact) {
        relevantData[depType] = this.extractRelevantData(targetType, depType, artifact);
      }
    }

    const contextSummary = this.buildContextSummary(targetType, relevantData);

    logger.debug({ targetType, dependencies, hasContext: Object.keys(relevantData).length }, 'Context enriched');

    return {
      type: targetType,
      relevantData,
      dependencies,
      contextSummary
    };
  }

  private extractRelevantData(targetType: ArtifactType, sourceType: ArtifactType, sourceArtifact: any): any {
    // Extract only relevant fields based on target type
    switch (targetType) {
      case 'FINANCIAL':
        if (sourceType === 'OVERVIEW') {
          return {
            parties: sourceArtifact.parties,
            contractType: sourceArtifact.contractType,
            term: sourceArtifact.term
          };
        }
        break;

      case 'RISK':
        if (sourceType === 'FINANCIAL') {
          return {
            totalValue: sourceArtifact.totalValue,
            currency: sourceArtifact.currency,
            paymentTerms: sourceArtifact.paymentTerms
          };
        }
        if (sourceType === 'CLAUSES') {
          return {
            highRiskClauses: sourceArtifact.clauses?.filter((c: any) => c.riskLevel === 'high') || [],
            clauseCount: sourceArtifact.clauses?.length || 0
          };
        }
        break;

      case 'RATES':
        if (sourceType === 'FINANCIAL') {
          return {
            currency: sourceArtifact.currency,
            totalValue: sourceArtifact.totalValue
          };
        }
        break;

      case 'COMPLIANCE':
        if (sourceType === 'CLAUSES') {
          return {
            complianceClauses: sourceArtifact.clauses?.filter((c: any) => 
              c.type?.toLowerCase().includes('compliance') || 
              c.type?.toLowerCase().includes('regulatory')
            ) || []
          };
        }
        break;
    }

    return sourceArtifact;
  }

  private buildContextSummary(targetType: ArtifactType, relevantData: Record<string, any>): string {
    const parts: string[] = [];

    if (relevantData.OVERVIEW) {
      const overview = relevantData.OVERVIEW;
      parts.push(`Contract Type: ${overview.contractType || 'Unknown'}`);
      if (overview.parties && overview.parties.length > 0) {
        parts.push(`Parties: ${overview.parties.map((p: any) => p.name).join(', ')}`);
      }
      if (overview.term) {
        parts.push(`Term: ${overview.term}`);
      }
    }

    if (relevantData.FINANCIAL) {
      const financial = relevantData.FINANCIAL;
      if (financial.totalValue) {
        parts.push(`Total Value: ${financial.currency} ${financial.totalValue}`);
      }
      if (financial.paymentTerms && financial.paymentTerms.length > 0) {
        parts.push(`Payment Terms: ${financial.paymentTerms.join(', ')}`);
      }
    }

    if (relevantData.CLAUSES) {
      const clauses = relevantData.CLAUSES;
      if (clauses.highRiskClauses && clauses.highRiskClauses.length > 0) {
        parts.push(`High-Risk Clauses: ${clauses.highRiskClauses.length}`);
      }
      if (clauses.clauseCount) {
        parts.push(`Total Clauses: ${clauses.clauseCount}`);
      }
    }

    // Add cost savings context for RISK artifact
    if (targetType === 'RISK' && (relevantData.FINANCIAL || relevantData.RATES)) {
      try {
        const savingsAnalysis = costSavingsAnalyzerService.analyzeCostSavings({
          overview: relevantData.OVERVIEW,
          financial: relevantData.FINANCIAL,
          rates: relevantData.RATES,
          clauses: relevantData.CLAUSES
        });
        
        savingsAnalysis.then(analysis => {
          if (analysis.opportunities.length > 0) {
            parts.push(`Cost Savings Opportunities: ${analysis.opportunities.length} identified`);
            parts.push(`Potential Savings: ${analysis.totalPotentialSavings.currency} ${analysis.totalPotentialSavings.amount.toLocaleString()}`);
          }
        }).catch(err => {
          logger.warn({ error: err }, 'Failed to add cost savings context');
        });
      } catch (error) {
        logger.warn({ error }, 'Failed to analyze cost savings for context');
      }
    }

    return parts.length > 0 ? parts.join(' | ') : 'No context available';
  }

  buildDependencyGraph(): DependencyGraph {
    const nodes = Object.keys(ARTIFACT_DEPENDENCIES) as ArtifactType[];
    const edges = new Map<ArtifactType, ArtifactType[]>();

    for (const [type, deps] of Object.entries(ARTIFACT_DEPENDENCIES)) {
      edges.set(type as ArtifactType, deps);
    }

    return { nodes, edges };
  }

  getDependencies(type: ArtifactType): ArtifactType[] {
    return ARTIFACT_DEPENDENCIES[type] || [];
  }

  areDependenciesMet(type: ArtifactType, availableArtifacts: Set<ArtifactType>): boolean {
    const deps = this.getDependencies(type);
    return deps.every(dep => availableArtifacts.has(dep));
  }
}

export const artifactContextEnrichmentService = ArtifactContextEnrichmentService.getInstance();
