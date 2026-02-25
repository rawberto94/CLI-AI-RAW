/**
 * RFx Detection Agent
 * 
 * Proactively identifies RFx opportunities by analyzing:
 * - Contract expiration dates (optimal timing for renewal RFPs)
 * - Market conditions (price trends, benchmarks)
 * - Performance issues (vendor underperformance triggers)
 * - Savings opportunities (consolidation, better rates)
 * 
 * Integrates with Merchant (RFx Procurement Agent) to auto-suggest RFx events.
 * 
 * @version 1.0.0
 */

import { BaseAgent } from './base-agent';
import type { AgentInput, AgentOutput } from './types';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

// ============================================================================
// TYPES
// ============================================================================

export interface RFxOpportunity {
  id: string;
  type: 'expiration' | 'savings_opportunity' | 'performance_issue' | 'market_shift' | 'consolidation';
  contractId: string;
  contractTitle: string;
  supplierName: string;
  confidence: number;
  recommendedType: 'RFP' | 'RFQ' | 'RFI';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  potentialSavings: {
    amount: number;
    percentage: number;
    currency: string;
  };
  reasoning: string;
  suggestedTimeline: {
    startDate: Date;
    responseDeadline: Date;
    awardDate: Date;
  };
  metadata: {
    daysUntilExpiry?: number;
    marketTrend?: 'up' | 'down' | 'stable';
    marketTrendPercent?: number;
    similarContractsCount?: number;
    avgSavingsFromSimilar?: number;
  };
}

export interface RFxDetectionResult {
  opportunities: RFxOpportunity[];
  summary: {
    totalOpportunities: number;
    totalPotentialSavings: number;
    byUrgency: Record<string, number>;
    byType: Record<string, number>;
  };
}

// ============================================================================
// MAIN AGENT CLASS
// ============================================================================

export class RFxDetectionAgent extends BaseAgent {
  name = 'rfx-detection-agent';
  version = '1.0.0';
  capabilities = [
    'rfx-opportunity-detection',
    'contract-renewal-timing',
    'savings-opportunity-identification',
    'vendor-performance-monitoring',
  ];

  protected getEventType(): 'opportunity_discovered' {
    return 'opportunity_discovered';
  }

  // Configuration thresholds
  private readonly CONFIG = {
    EXPIRY_WARNING_DAYS: 180, // Start suggesting RFx 6 months before expiry
    EXPIRY_CRITICAL_DAYS: 90, // Critical if < 3 months
    MIN_SAVINGS_PERCENTAGE: 10, // Suggest RFx if >10% savings potential
    MIN_CONTRACT_VALUE: 50000, // Only suggest for contracts >$50K
    PERFORMANCE_THRESHOLD: 3.0, // Out of 5.0 - below this triggers RFx
  };

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { tenantId, context } = input;
    const contractId = context?.contractId as string | undefined;
    
    logger.info({ tenantId, contractId }, 'RFx Detection Agent starting analysis');

    try {
      let opportunities: RFxOpportunity[] = [];

      if (contractId) {
        // Analyze specific contract
        const contract = await this.getContract(contractId, tenantId);
        if (contract) {
          opportunities = await this.analyzeContract(contract, tenantId);
        }
      } else {
        // Portfolio-wide analysis
        opportunities = await this.analyzePortfolio(tenantId);
      }

      // Sort by urgency and confidence
      opportunities = this.prioritizeOpportunities(opportunities);

      const result: RFxDetectionResult = {
        opportunities,
        summary: this.generateSummary(opportunities),
      };

      return {
        success: true,
        data: result,
        confidence: opportunities.length > 0 ? 0.9 : 0.7,
        reasoning: this.generateReasoning(opportunities),
        actions: this.generateActions(opportunities, tenantId),
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'RFx Detection Agent failed');
      return {
        success: false,
        confidence: 0,
        reasoning: `RFx detection failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ============================================================================
  // ANALYSIS METHODS
  // ============================================================================

  private async analyzePortfolio(tenantId: string): Promise<RFxOpportunity[]> {
    const opportunities: RFxOpportunity[] = [];
    
    // Get active contracts expiring in next 180 days
    const expiringContracts = await prisma.contract.findMany({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'EXECUTED'] },
        expirationDate: {
          lte: new Date(Date.now() + this.CONFIG.EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
        totalValue: { gte: this.CONFIG.MIN_CONTRACT_VALUE },
      },
      select: {
        id: true,
        contractTitle: true,
        supplierName: true,
        contractType: true,
        totalValue: true,
        annualValue: true,
        effectiveDate: true,
        expirationDate: true,
        autoRenewalEnabled: true,
        renewalInitiatedAt: true,
      },
      orderBy: { expirationDate: 'asc' },
      take: 100,
    });

    for (const contract of expiringContracts) {
      const contractOpps = await this.analyzeContract(contract, tenantId);
      opportunities.push(...contractOpps);
    }

    return opportunities;
  }

  private async analyzeContract(
    contract: any,
    tenantId: string
  ): Promise<RFxOpportunity[]> {
    // Run all 4 checks in parallel for better performance
    const [expiryResult, savingsResult, performanceResult, consolidationResult] = await Promise.allSettled([
      this.checkExpirationOpportunity(contract, tenantId),
      this.checkSavingsOpportunity(contract, tenantId),
      this.checkPerformanceIssues(contract, tenantId),
      this.checkConsolidationOpportunity(contract, tenantId),
    ]);

    const opportunities: RFxOpportunity[] = [];

    for (const result of [expiryResult, savingsResult, performanceResult, consolidationResult]) {
      if (result.status === 'fulfilled' && result.value) {
        opportunities.push(result.value);
      } else if (result.status === 'rejected') {
        logger.warn({ error: result.reason, contractId: contract.id }, 'Detection check failed');
      }
    }

    return opportunities;
  }

  // ============================================================================
  // DETECTION LOGIC
  // ============================================================================

  private async checkExpirationOpportunity(
    contract: any,
    tenantId: string
  ): Promise<RFxOpportunity | null> {
    if (!contract.expirationDate) return null;
    
    const daysUntilExpiry = Math.floor(
      (contract.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    // Skip if renewal already initiated
    if (contract.renewalInitiatedAt) return null;

    // Skip if too far out
    if (daysUntilExpiry > this.CONFIG.EXPIRY_WARNING_DAYS) return null;

    // Determine urgency
    let urgency: RFxOpportunity['urgency'] = 'medium';
    if (daysUntilExpiry <= this.CONFIG.EXPIRY_CRITICAL_DAYS) {
      urgency = contract.autoRenewalEnabled ? 'high' : 'critical';
    } else if (daysUntilExpiry <= 120) {
      urgency = 'high';
    }

    // Estimate savings potential
    const savingsEstimate = await this.estimateSavingsPotential(contract, tenantId);

    // Calculate suggested timeline
    const suggestedTimeline = this.calculateTimeline(daysUntilExpiry);

    const opportunity: RFxOpportunity = {
      id: `exp-${contract.id}`,
      type: 'expiration',
      contractId: contract.id,
      contractTitle: contract.contractTitle || 'Untitled Contract',
      supplierName: contract.supplierName || 'Unknown Supplier',
      confidence: this.calculateExpiryConfidence(daysUntilExpiry, contract),
      recommendedType: this.determineRFxType(contract),
      urgency,
      potentialSavings: savingsEstimate,
      reasoning: this.generateExpiryReasoning(contract, daysUntilExpiry, savingsEstimate),
      suggestedTimeline,
      metadata: {
        daysUntilExpiry,
        similarContractsCount: savingsEstimate.similarCount,
        avgSavingsFromSimilar: savingsEstimate.avgSimilarSavings,
      },
    };

    return opportunity;
  }

  private async checkSavingsOpportunity(
    contract: any,
    tenantId: string
  ): Promise<RFxOpportunity | null> {
    // Skip low-value contracts
    if (!contract.totalValue || contract.totalValue < this.CONFIG.MIN_CONTRACT_VALUE * 2) {
      return null;
    }

    // Look for similar contracts with better pricing
    const similarContracts = await this.getSimilarContracts(contract, tenantId);
    
    if (similarContracts.length < 2) return null;

    // Calculate average rate from similar contracts
    const avgRate = similarContracts.reduce((sum: number, c: any) => {
      const rate = c.totalValue && c.durationMonths 
        ? Number(c.totalValue) / c.durationMonths 
        : 0;
      return sum + rate;
    }, 0) / similarContracts.length;

    const currentRate = contract.totalValue && contract.durationMonths
      ? Number(contract.totalValue) / contract.durationMonths
      : 0;

    if (currentRate === 0 || avgRate === 0) return null;

    const savingsPercent = ((currentRate - avgRate) / currentRate) * 100;

    // Only suggest if savings potential > threshold
    if (savingsPercent < this.CONFIG.MIN_SAVINGS_PERCENTAGE) return null;

    const annualValue = Number(contract.annualValue) || Number(contract.totalValue) || 0;
    const potentialSavingsAmount = (annualValue * savingsPercent) / 100;

    return {
      id: `sav-${contract.id}`,
      type: 'savings_opportunity',
      contractId: contract.id,
      contractTitle: contract.contractTitle || 'Untitled Contract',
      supplierName: contract.supplierName || 'Unknown Supplier',
      confidence: Math.min(0.95, 0.7 + (similarContracts.length * 0.05)),
      recommendedType: 'RFQ',
      urgency: savingsPercent > 20 ? 'high' : 'medium',
      potentialSavings: {
        amount: potentialSavingsAmount,
        percentage: Math.round(savingsPercent),
        currency: 'USD',
      },
      reasoning: `Similar contracts are priced ${Math.round(savingsPercent)}% lower on average. ` +
                `Based on ${similarContracts.length} comparable contracts in your portfolio.`,
      suggestedTimeline: this.calculateTimeline(90),
      metadata: {
        similarContractsCount: similarContracts.length,
        avgSavingsFromSimilar: Math.round(savingsPercent),
        marketTrend: 'down',
        marketTrendPercent: Math.round(savingsPercent),
      },
    };
  }

  private async checkPerformanceIssues(
    contract: any,
    tenantId: string
  ): Promise<RFxOpportunity | null> {
    // Check for obligation/deliverable issues
    const obligationIssues = await this.getObligationIssues(contract.id, tenantId);
    
    // Check for contract health score
    const healthScore = contract.healthScore || 100;
    
    // Check vendor performance rating against threshold
    const performanceRating = contract.performanceRating || contract.vendorRating || 5.0;
    const belowPerformanceThreshold = performanceRating < this.CONFIG.PERFORMANCE_THRESHOLD;
    
    if (obligationIssues.length === 0 && healthScore > 70 && !belowPerformanceThreshold) {
      return null;
    }

    const hasCriticalIssues = obligationIssues.some((o: any) => o.severity === 'critical');
    
    // Build detailed reasoning
    const reasonParts: string[] = [];
    if (hasCriticalIssues) {
      reasonParts.push(`Critical performance issues detected: ${obligationIssues.length} obligations overdue or at risk.`);
    }
    if (belowPerformanceThreshold) {
      reasonParts.push(`Vendor performance rating (${performanceRating.toFixed(1)}/5.0) below threshold (${this.CONFIG.PERFORMANCE_THRESHOLD}/5.0).`);
    }
    if (healthScore <= 70) {
      reasonParts.push(`Contract health score (${healthScore}/100) below acceptable level.`);
    }
    if (reasonParts.length === 0) {
      reasonParts.push('Consider competitive alternatives based on overall performance metrics.');
    }
    
    return {
      id: `perf-${contract.id}`,
      type: 'performance_issue',
      contractId: contract.id,
      contractTitle: contract.contractTitle || 'Untitled Contract',
      supplierName: contract.supplierName || 'Unknown Supplier',
      confidence: hasCriticalIssues ? 0.9 : belowPerformanceThreshold ? 0.85 : 0.75,
      recommendedType: 'RFP',
      urgency: hasCriticalIssues ? 'critical' : 'high',
      potentialSavings: { amount: 0, percentage: 0, currency: 'USD' },
      reasoning: reasonParts.join(' '),
      suggestedTimeline: this.calculateTimeline(60),
      metadata: {
        similarContractsCount: obligationIssues.length,
      },
    };
  }

  private async checkConsolidationOpportunity(
    contract: any,
    tenantId: string
  ): Promise<RFxOpportunity | null> {
    // Find other contracts with same supplier
    const sameSupplierContracts = await prisma.contract.findMany({
      where: {
        tenantId,
        supplierName: contract.supplierName,
        id: { not: contract.id },
        status: { in: ['ACTIVE', 'EXECUTED'] },
      },
      select: {
        id: true,
        contractTitle: true,
        totalValue: true,
        contractType: true,
      },
    });

    if (sameSupplierContracts.length < 2) return null;

    const totalValue = sameSupplierContracts.reduce(
      (sum: number, c: any) => sum + (Number(c.totalValue) || 0),
      Number(contract.totalValue) || 0
    );

    // Estimate consolidation savings (typically 5-15%)
    const consolidationSavingsPercent = 8;
    const potentialSavings = (totalValue * consolidationSavingsPercent) / 100;

    return {
      id: `cons-${contract.id}`,
      type: 'consolidation',
      contractId: contract.id,
      contractTitle: contract.contractTitle || 'Untitled Contract',
      supplierName: contract.supplierName || 'Unknown Supplier',
      confidence: 0.8,
      recommendedType: 'RFP',
      urgency: 'medium',
      potentialSavings: {
        amount: potentialSavings,
        percentage: consolidationSavingsPercent,
        currency: 'USD',
      },
      reasoning: `You have ${sameSupplierContracts.length + 1} separate contracts with ${contract.supplierName}. ` +
                `Consolidating into a master agreement could yield ${consolidationSavingsPercent}% savings ` +
                `through volume discounts and reduced admin overhead.`,
      suggestedTimeline: this.calculateTimeline(120),
      metadata: {
        similarContractsCount: sameSupplierContracts.length + 1,
      },
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async getContract(contractId: string, tenantId: string) {
    return prisma.contract.findFirst({
      where: { id: contractId, tenantId },
    });
  }

  private async estimateSavingsPotential(contract: any, tenantId: string): Promise<{
    amount: number;
    percentage: number;
    currency: string;
    similarCount: number;
    avgSimilarSavings: number;
  }> {
    // Get similar past RFx events
    const similarRFx: any[] = await (prisma as any).rfxEvent?.findMany?.({
      where: {
        tenantId,
        type: this.determineRFxType(contract),
        category: contract.contractType,
        status: 'awarded',
        savingsAchieved: { not: null },
      },
      take: 10,
    }) || [];

    if (similarRFx.length === 0) {
      // Default estimate if no history
      const annualValue = Number(contract.annualValue) || Number(contract.totalValue) || 0;
      return {
        amount: annualValue * 0.12, // 12% default savings estimate
        percentage: 12,
        currency: 'USD',
        similarCount: 0,
        avgSimilarSavings: 12,
      };
    }

    const avgSavings = similarRFx.reduce(
      (sum: number, r: any) => sum + (r.savingsAchieved || 0),
      0
    ) / similarRFx.length;

    const avgSavingsPercent = similarRFx.reduce(
      (sum: number, r: any) => sum + (r.savingsPercent || 10),
      0
    ) / similarRFx.length;

    const annualValue = Number(contract.annualValue) || Number(contract.totalValue) || 0;

    return {
      amount: (annualValue * avgSavingsPercent) / 100,
      percentage: Math.round(avgSavingsPercent),
      currency: 'USD',
      similarCount: similarRFx.length,
      avgSimilarSavings: Math.round(avgSavingsPercent),
    };
  }

  private async getSimilarContracts(contract: any, tenantId: string) {
    return prisma.contract.findMany({
      where: {
        tenantId,
        contractType: contract.contractType,
        id: { not: contract.id },
        status: 'COMPLETED',
        totalValue: { not: null },
      },
      select: {
        totalValue: true,
        effectiveDate: true,
        expirationDate: true,
        durationMonths: true,
      },
      take: 20,
    });
  }

  private async getObligationIssues(contractId: string, tenantId: string) {
    // Get obligations that are overdue or at risk
    const obligations = await (prisma as any).obligation?.findMany?.({
      where: {
        contractId,
        tenantId,
        status: { in: ['overdue', 'at_risk', 'breached'] },
      },
    }) || [];

    return obligations;
  }

  private determineRFxType(contract: any): 'RFP' | 'RFQ' | 'RFI' {
    const value = Number(contract.totalValue) || 0;
    const complexity = this.assessComplexity(contract);

    if (value > 500000 || complexity === 'high') return 'RFP';
    if (value > 100000 || complexity === 'medium') return 'RFQ';
    return 'RFI';
  }

  private assessComplexity(contract: any): 'low' | 'medium' | 'high' {
    // Simple heuristic based on contract type
    const complexTypes = ['MSA', 'ENTERPRISE_LICENSE', 'INFRASTRUCTURE'];
    if (complexTypes.includes(contract.contractType)) return 'high';
    
    const mediumTypes = ['SOW', 'PROFESSIONAL_SERVICES', 'SOFTWARE_LICENSE'];
    if (mediumTypes.includes(contract.contractType)) return 'medium';
    
    return 'low';
  }

  private calculateExpiryConfidence(daysUntilExpiry: number, contract: any): number {
    let confidence = 0.9;
    
    // Reduce confidence if very far out
    if (daysUntilExpiry > 150) confidence -= 0.2;
    
    // Increase confidence if auto-renewal is enabled (time-sensitive)
    if (contract.autoRenewalEnabled) confidence += 0.05;
    
    // Increase confidence if high-value contract
    if (contract.totalValue > 500000) confidence += 0.05;
    
    return Math.min(0.98, confidence);
  }

  private calculateTimeline(daysUntilExpiry: number) {
    const now = new Date();
    
    // Start RFx 90 days before expiry (or immediately if < 90 days)
    const startOffset = Math.max(0, daysUntilExpiry - 90);
    const startDate = new Date(now.getTime() + startOffset * 24 * 60 * 60 * 1000);
    
    // Responses due 30 days before expiry (or 30 days from now if < 60 days)
    const responseOffset = Math.max(30, daysUntilExpiry - 30);
    const responseDeadline = new Date(now.getTime() + responseOffset * 24 * 60 * 60 * 1000);
    
    // Award 15 days before expiry
    const awardOffset = Math.max(15, daysUntilExpiry - 15);
    const awardDate = new Date(now.getTime() + awardOffset * 24 * 60 * 60 * 1000);

    return {
      startDate,
      responseDeadline,
      awardDate,
    };
  }

  private generateExpiryReasoning(
    contract: any,
    daysUntilExpiry: number,
    savings: any
  ): string {
    const parts: string[] = [];
    
    parts.push(`Contract expires in ${daysUntilExpiry} days.`);
    
    if (contract.autoRenewalEnabled) {
      parts.push('Auto-renewal clause present - early engagement needed for negotiation leverage.');
    }
    
    if (savings.similarCount > 0) {
      parts.push(`Similar contracts achieved ${savings.avgSimilarSavings}% savings through competitive bidding.`);
    } else {
      parts.push('Historical data suggests 12-15% savings potential through competitive RFP.');
    }
    
    if (daysUntilExpiry < this.CONFIG.EXPIRY_CRITICAL_DAYS) {
      parts.push('⚠️ URGENT: Limited time to complete full RFx process before expiry.');
    }
    
    return parts.join(' ');
  }

  private prioritizeOpportunities(opportunities: RFxOpportunity[]): RFxOpportunity[] {
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    return opportunities.sort((a, b) => {
      // First by urgency
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      
      // Then by potential savings
      return b.potentialSavings.amount - a.potentialSavings.amount;
    });
  }

  private generateSummary(opportunities: RFxOpportunity[]): RFxDetectionResult['summary'] {
    const byUrgency: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byType: Record<string, number> = {};
    let totalSavings = 0;

    for (const opp of opportunities) {
      const urgency = opp.urgency || 'medium';
      byUrgency[urgency] = (byUrgency[urgency] || 0) + 1;
      byType[opp.type] = (byType[opp.type] || 0) + 1;
      totalSavings += opp.potentialSavings.amount;
    }

    return {
      totalOpportunities: opportunities.length,
      totalPotentialSavings: totalSavings,
      byUrgency,
      byType,
    };
  }

  private generateReasoning(opportunities: RFxOpportunity[]): string {
    if (opportunities.length === 0) {
      return 'No RFx opportunities detected at this time.';
    }

    const critical = opportunities.filter(o => o.urgency === 'critical').length;
    const high = opportunities.filter(o => o.urgency === 'high').length;
    const totalSavings = opportunities.reduce((sum, o) => sum + o.potentialSavings.amount, 0);

    return `Found ${opportunities.length} RFx opportunities ` +
           `(${critical} critical, ${high} high priority). ` +
           `Total potential savings: $${(totalSavings / 1000000).toFixed(1)}M.`;
  }

  private generateActions(opportunities: RFxOpportunity[], tenantId: string): any[] {
    const actions = [];

    // Add action for highest priority opportunity
    if (opportunities.length > 0) {
      const topOpportunity = opportunities[0]!;
      actions.push({
        id: `create-rfx-${topOpportunity.contractId}`,
        type: 'create_rfx',
        description: `Create ${topOpportunity.recommendedType} for ${topOpportunity.contractTitle}`,
        priority: topOpportunity.urgency === 'critical' ? 'urgent' : 'high',
        automated: false,
        targetEntity: { type: 'contract', id: topOpportunity.contractId },
        payload: {
          opportunityType: topOpportunity.type,
          recommendedType: topOpportunity.recommendedType,
          potentialSavings: topOpportunity.potentialSavings,
        },
        estimatedImpact: `$${(topOpportunity.potentialSavings.amount / 1000).toFixed(0)}K potential savings`,
      });
    }

    // Add market shift monitoring action
    actions.push({
      id: 'monitor-market-shifts',
      type: 'monitor_market',
      description: 'Monitor market conditions for pricing shifts and new vendor entries',
      priority: 'low',
      automated: true,
      targetEntity: { type: 'portfolio', id: tenantId },
      payload: {
        contractTypes: [...new Set(opportunities.map(o => o.metadata?.marketTrend).filter(Boolean))],
      },
    });

    // Add reminder action for non-urgent items
    const nonUrgent = opportunities.filter(o => o.urgency === 'low' || o.urgency === 'medium');
    if (nonUrgent.length > 0) {
      actions.push({
        id: 'schedule-rfx-reminders',
        type: 'schedule_review',
        description: `Schedule reminders for ${nonUrgent.length} upcoming RFx opportunities`,
        priority: 'medium',
        automated: true,
        targetEntity: { type: 'contract', id: 'portfolio' },
        payload: { opportunities: nonUrgent.map(o => o.contractId) },
      });
    }

    return actions;
  }
}

// Export singleton
export const rfxDetectionAgent = new RFxDetectionAgent();
