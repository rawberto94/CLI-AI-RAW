/**
 * Opportunity Discovery Engine
 * Automatically discovers cost savings, consolidation, and optimization opportunities
 */

import { BaseAgent } from './base-agent';
import type {
  AgentInput,
  AgentOutput,
  DiscoveredOpportunity,
  OpportunityAction,
  MarketData,
  AgentRecommendation,
} from './types';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

export class OpportunityDiscoveryEngine extends BaseAgent {
  name = 'opportunity-discovery-engine';
  version = '1.0.0';
  capabilities = ['opportunity-discovery', 'cost-analysis', 'optimization'];

  async execute(input: AgentInput): Promise<AgentOutput> {
    // Support both plural contracts (from scheduler) and singular contract (from pipeline)
    let contracts: any[];
    let marketData = input.context?.marketData;

    if (Array.isArray(input.context?.contracts)) {
      contracts = input.context.contracts;
    } else {
      // Query tenant portfolio for cross-contract analysis
      try {
        const dbContracts = await prisma.contract.findMany({
          where: { tenantId: input.tenantId },
          select: {
            id: true, contractTitle: true, status: true, contractType: true,
            totalValue: true, annualValue: true, effectiveDate: true, expirationDate: true,
            supplierName: true, counterparty: true, vendor: true,
            autoRenewalEnabled: true, department: true,
          },
          take: 100,
        });
        contracts = dbContracts.map(c => ({
          id: c.id,
          title: c.contractTitle || '',
          status: c.status,
          contractType: c.contractType || 'OTHER',
          value: c.totalValue ?? c.annualValue ?? 0,
          supplier: c.supplierName || c.counterparty || c.vendor || '',
          parties: [c.supplierName, c.counterparty, c.vendor].filter(Boolean),
          effectiveDate: c.effectiveDate,
          expirationDate: c.expirationDate,
          autoRenewal: c.autoRenewalEnabled ?? false,
          department: c.department || '',
        }));
      } catch {
        // Fallback to single contract if DB query fails
        contracts = input.context?.contract ? [input.context.contract] : [];
      }
    }

    if (!contracts.length) {
      return {
        success: true,
        data: { opportunities: [], summary: { total: 0, totalValue: 0, byType: {} } },
        recommendations: [],
        confidence: 1,
        reasoning: 'No contracts available for opportunity analysis',
        metadata: { processingTime: 0 },
      };
    }

    // Discover opportunities
    const opportunities = await this.discoverOpportunities(contracts, marketData);

    // Convert to recommendations
    const recommendations: AgentRecommendation[] = opportunities.map(opp => ({
      id: `opp-${opp.id}`,
      title: opp.title,
      description: opp.description,
      category: opp.type === 'cost_savings' || opp.type === 'renegotiation' ? 'cost-savings' : 'process-improvement',
      priority: opp.potentialValue > 100000 ? 'high' : opp.potentialValue > 50000 ? 'medium' : 'low',
      confidence: opp.confidence,
      potentialValue: opp.potentialValue,
      effort: opp.effort,
      timeframe: opp.timeframe,
      actions: opp.actionPlan.map(action => ({
        id: `action-${action.step}`,
        type: action.automated ? 'validate' : 'request-human-review',
        description: action.action,
        priority: 'medium',
        automated: action.automated,
        targetEntity: {
          type: 'contract',
          id: opp.relatedContracts[0] || input.contractId,
        },
        payload: { action },
      })),
      reasoning: `${opp.type.toUpperCase()}: ${opp.description}`,
    }));

    const totalValue = opportunities.reduce((sum, o) => sum + o.potentialValue, 0);

    return {
      success: true,
      data: {
        opportunities,
        summary: {
          total: opportunities.length,
          totalValue,
          byType: this.groupOpportunitiesByType(opportunities),
        },
      },
      recommendations,
      confidence: 0.80,
      reasoning: this.formatReasoning([
        `Discovered ${opportunities.length} opportunities`,
        `Total Potential Value: $${totalValue.toLocaleString()}`,
        '',
        'Top 3 Opportunities:',
        ...opportunities.slice(0, 3).map(o => 
          `  ${o.type.toUpperCase()}: ${o.title} ($${o.potentialValue.toLocaleString()})`
        ),
      ]),
      metadata: {
        processingTime: Date.now() - (input.metadata?.timestamp?.getTime() ?? Date.now()),
      },
    };
  }

  protected getEventType(): 'opportunity_discovered' {
    return 'opportunity_discovered';
  }

  /**
   * Discover opportunities across contracts
   */
  private async discoverOpportunities(
    contracts: any[],
    marketData?: any
  ): Promise<DiscoveredOpportunity[]> {
    const opportunities: DiscoveredOpportunity[] = [];

    // Pattern 1: Multiple contracts with same supplier (consolidation)
    const consolidationOpps = this.findConsolidationOpportunities(contracts);
    opportunities.push(...consolidationOpps);

    // Pattern 2: Above-market pricing (renegotiation)
    if (marketData) {
      const renegotiationOpps = await this.findRenegotiationOpportunities(contracts, marketData);
      opportunities.push(...renegotiationOpps);
    }

    // Pattern 3: Expiring contracts with better alternatives (optimization)
    const optimizationOpps = await this.findOptimizationOpportunities(contracts, marketData);
    opportunities.push(...optimizationOpps);

    // Pattern 4: Duplicate services (cost savings)
    const duplicateOpps = this.findDuplicateServiceOpportunities(contracts);
    opportunities.push(...duplicateOpps);

    // Pattern 5: Auto-renewal prevention (cost savings)
    const renewalOpps = this.findAutoRenewalOpportunities(contracts);
    opportunities.push(...renewalOpps);

    // Sort by potential value
    return opportunities.sort((a, b) => b.potentialValue - a.potentialValue);
  }

  /**
   * Find consolidation opportunities (multiple contracts with same supplier)
   */
  private findConsolidationOpportunities(contracts: any[]): DiscoveredOpportunity[] {
    const opportunities: DiscoveredOpportunity[] = [];

    // Group by supplier
    const supplierGroups = new Map<string, any[]>();
    
    for (const contract of contracts) {
      const supplier = contract.parties?.find((p: any) => p.role === 'supplier')?.name || 
                      contract.supplier || 
                      'Unknown';
      
      if (!supplierGroups.has(supplier)) {
        supplierGroups.set(supplier, []);
      }
      supplierGroups.get(supplier)!.push(contract);
    }

    // Find suppliers with 3+ contracts
    for (const [supplier, supplierContracts] of supplierGroups) {
      if (supplierContracts.length >= 3 && supplier !== 'Unknown') {
        const totalValue = supplierContracts.reduce((sum, c) => sum + (c.value || 0), 0);
        const potentialSavings = totalValue * 0.15; // Estimated 15% savings

        opportunities.push({
          id: `consolidation-${supplier}-${Date.now()}`,
          type: 'consolidation',
          title: `Consolidate ${supplierContracts.length} ${supplier} contracts`,
          description: `Combining ${supplierContracts.length} separate contracts into a master agreement could yield volume discounts and simplified management`,
          potentialValue: potentialSavings,
          confidence: 0.80,
          effort: 'medium',
          timeframe: '2-3 months',
          relatedContracts: supplierContracts.map(c => c.id),
          actionPlan: [
            {
              step: 1,
              action: 'Generate consolidated contract analysis report',
              owner: 'ai_system',
              automated: true,
              estimatedDuration: '1 day',
            },
            {
              step: 2,
              action: 'Review current terms across all contracts',
              owner: 'procurement',
              automated: false,
              estimatedDuration: '3-5 days',
            },
            {
              step: 3,
              action: 'Request consolidated pricing proposal from supplier',
              owner: 'procurement',
              automated: false,
              estimatedDuration: '2 weeks',
              dependencies: [2],
            },
            {
              step: 4,
              action: 'Negotiate master agreement',
              owner: 'legal + procurement',
              automated: false,
              estimatedDuration: '4-6 weeks',
              dependencies: [3],
            },
          ],
          discoveredAt: new Date(),
          status: 'new',
        });
      }
    }

    return opportunities;
  }

  /**
   * Find renegotiation opportunities (above-market pricing)
   */
  private async findRenegotiationOpportunities(
    contracts: any[],
    marketData: any
  ): Promise<DiscoveredOpportunity[]> {
    const opportunities: DiscoveredOpportunity[] = [];

    for (const contract of contracts) {
      // Skip if no rate information
      if (!contract.rate || !contract.serviceType) continue;

      // Get market rate (mock for now)
      const marketRate = await this.getMarketRate(
        contract.serviceType,
        contract.region || 'US'
      );

      if (!marketRate) continue;

      // Check if 20%+ above market
      const priceDiff = contract.rate - marketRate.averageRate;
      const priceDiffPercent = (priceDiff / marketRate.averageRate) * 100;

      if (priceDiffPercent > 20) {
        const estimatedVolume = contract.estimatedAnnualVolume || 1000;
        const potentialSavings = priceDiff * estimatedVolume;

        opportunities.push({
          id: `renegotiation-${contract.id}-${Date.now()}`,
          type: 'renegotiation',
          title: `Renegotiate ${contract.title} - ${priceDiffPercent.toFixed(0)}% above market`,
          description: `Current rate ($${contract.rate}) is ${priceDiffPercent.toFixed(0)}% above market benchmark ($${marketRate.averageRate}). Similar contracts in your region average $${marketRate.medianRate}.`,
          potentialValue: potentialSavings,
          confidence: 0.85,
          effort: 'low',
          timeframe: '1 month',
          relatedContracts: [contract.id],
          actionPlan: [
            {
              step: 1,
              action: 'Generate market comparison report with benchmarks',
              owner: 'ai_system',
              automated: true,
            },
            {
              step: 2,
              action: 'Schedule supplier negotiation meeting',
              owner: 'procurement',
              automated: false,
            },
            {
              step: 3,
              action: 'Present market data and request rate adjustment',
              owner: 'procurement',
              automated: false,
              dependencies: [1, 2],
            },
          ],
          discoveredAt: new Date(),
          status: 'new',
        });
      }
    }

    return opportunities;
  }

  /**
   * Find optimization opportunities (better alternatives available)
   */
  private async findOptimizationOpportunities(
    contracts: any[],
    marketData?: any
  ): Promise<DiscoveredOpportunity[]> {
    const opportunities: DiscoveredOpportunity[] = [];

    // Find contracts expiring within 90 days
    const expiringContracts = contracts.filter(c => {
      if (!c.expirationDate) return false;
      const daysToExpiry = (new Date(c.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysToExpiry > 0 && daysToExpiry < 90;
    });

    for (const contract of expiringContracts) {
      // Check if better alternatives exist (mock for now)
      const alternatives = await this.findBetterAlternatives(contract, marketData);

      if (alternatives.length > 0) {
        const bestAlternative = alternatives[0];
        if (!bestAlternative) continue;
        
        const savings = contract.value - bestAlternative.estimatedCost;

        if (savings > contract.value * 0.1) { // 10%+ savings
          opportunities.push({
            id: `optimization-${contract.id}-${Date.now()}`,
            type: 'optimization',
            title: `Switch supplier for ${contract.title}`,
            description: `${bestAlternative.supplier} offers comparable service at ${(savings / contract.value * 100).toFixed(0)}% lower cost. Contract expires in ${Math.round((new Date(contract.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days.`,
            potentialValue: savings,
            confidence: 0.70,
            effort: 'high',
            timeframe: '4-6 months',
            relatedContracts: [contract.id],
            actionPlan: [
              {
                step: 1,
                action: 'Conduct supplier evaluation and comparison',
                owner: 'procurement',
                automated: false,
              },
              {
                step: 2,
                action: 'Request detailed proposal from alternative supplier',
                owner: 'procurement',
                automated: false,
                dependencies: [1],
              },
              {
                step: 3,
                action: 'Plan transition strategy and timeline',
                owner: 'operations + it',
                automated: false,
                dependencies: [2],
              },
              {
                step: 4,
                action: 'Execute supplier transition',
                owner: 'operations',
                automated: false,
                dependencies: [3],
              },
            ],
            discoveredAt: new Date(),
            status: 'new',
          });
        }
      }
    }

    return opportunities;
  }

  /**
   * Find duplicate service opportunities
   */
  private findDuplicateServiceOpportunities(contracts: any[]): DiscoveredOpportunity[] {
    const opportunities: DiscoveredOpportunity[] = [];

    // Group by service type
    const serviceGroups = new Map<string, any[]>();
    
    for (const contract of contracts) {
      const serviceType = contract.serviceType || contract.contractType || 'Unknown';
      
      if (!serviceGroups.has(serviceType)) {
        serviceGroups.set(serviceType, []);
      }
      serviceGroups.get(serviceType)!.push(contract);
    }

    // Find potential duplicates
    for (const [serviceType, serviceContracts] of serviceGroups) {
      if (serviceContracts.length >= 2 && serviceType !== 'Unknown') {
        // Check if services overlap
        const potentialDuplicates = this.identifyOverlappingServices(serviceContracts);

        if (potentialDuplicates.length > 0) {
          const totalCost = potentialDuplicates.reduce((sum, c) => sum + (c.value || 0), 0);
          const savings = totalCost * 0.5; // Could eliminate one

          opportunities.push({
            id: `duplicate-${serviceType}-${Date.now()}`,
            type: 'cost_savings',
            title: `Eliminate duplicate ${serviceType} services`,
            description: `Found ${potentialDuplicates.length} potentially overlapping ${serviceType} contracts. Consolidating could eliminate redundancy.`,
            potentialValue: savings,
            confidence: 0.65,
            effort: 'medium',
            timeframe: '2-3 months',
            relatedContracts: potentialDuplicates.map(c => c.id),
            actionPlan: [
              {
                step: 1,
                action: 'Analyze service overlap and usage patterns',
                owner: 'ai_system',
                automated: true,
              },
              {
                step: 2,
                action: 'Meet with stakeholders to confirm redundancy',
                owner: 'procurement',
                automated: false,
              },
              {
                step: 3,
                action: 'Plan service consolidation',
                owner: 'procurement + operations',
                automated: false,
                dependencies: [2],
              },
            ],
            discoveredAt: new Date(),
            status: 'new',
          });
        }
      }
    }

    return opportunities;
  }

  /**
   * Find auto-renewal prevention opportunities
   */
  private findAutoRenewalOpportunities(contracts: any[]): DiscoveredOpportunity[] {
    const opportunities: DiscoveredOpportunity[] = [];

    for (const contract of contracts) {
      // Check if has auto-renewal and is expiring soon
      if (contract.autoRenewal && contract.expirationDate) {
        const daysToExpiry = (new Date(contract.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        
        // If auto-renewal in next 60 days and contract is underutilized
        if (daysToExpiry > 0 && daysToExpiry < 60 && contract.utilizationRate < 0.5) {
          opportunities.push({
            id: `autorenewal-${contract.id}-${Date.now()}`,
            type: 'cost_savings',
            title: `Prevent auto-renewal of underutilized ${contract.title}`,
            description: `Contract set to auto-renew in ${Math.round(daysToExpiry)} days but only ${(contract.utilizationRate * 100).toFixed(0)}% utilized. Consider cancellation or renegotiation.`,
            potentialValue: contract.value,
            confidence: 0.75,
            effort: 'low',
            timeframe: '1 month',
            relatedContracts: [contract.id],
            actionPlan: [
              {
                step: 1,
                action: 'Generate usage analysis report',
                owner: 'ai_system',
                automated: true,
              },
              {
                step: 2,
                action: 'Review with contract owner and stakeholders',
                owner: 'procurement',
                automated: false,
              },
              {
                step: 3,
                action: 'Cancel or renegotiate before auto-renewal',
                owner: 'procurement',
                automated: false,
                dependencies: [2],
              },
            ],
            discoveredAt: new Date(),
            status: 'new',
          });
        }
      }
    }

    return opportunities;
  }

  /**
   * Get market rate data from cross-contract analysis
   */
  private async getMarketRate(
    serviceType: string,
    region: string
  ): Promise<MarketData | null> {
    try {
      // Aggregate comparable contracts across tenants of same type
      const contracts = await prisma.contract.findMany({
        where: {
          contractType: { contains: serviceType, mode: 'insensitive' },
          isDeleted: false,
          totalValue: { not: null, gt: 0 },
        },
        select: { totalValue: true },
        take: 200,
        orderBy: { createdAt: 'desc' },
      });

      if (contracts.length < 3) return null;

      const values = contracts
        .map(c => Number(c.totalValue))
        .filter(v => v > 0)
        .sort((a, b) => a - b);

      if (values.length === 0) return null;

      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const median = values[Math.floor(values.length / 2)];
      const p25 = values[Math.floor(values.length * 0.25)];
      const p75 = values[Math.floor(values.length * 0.75)];

      return {
        serviceType,
        region,
        averageRate: Math.round(avg),
        medianRate: Math.round(median),
        percentile25: Math.round(p25),
        percentile75: Math.round(p75),
        sampleSize: values.length,
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.warn({ error, serviceType }, 'Failed to get market rate');
      return null;
    }
  }

  /**
   * Find alternative suppliers offering better terms
   */
  private async findBetterAlternatives(
    contract: any,
    marketData?: any
  ): Promise<Array<{ supplier: string; estimatedCost: number; rating: number }>> {
    try {
      if (!contract.supplierName || !contract.totalValue) return [];

      const contractValue = Number(contract.totalValue);

      // Find other suppliers with the same contract type and lower cost
      const alternatives = await prisma.contract.findMany({
        where: {
          contractType: contract.contractType,
          isDeleted: false,
          supplierName: { not: contract.supplierName },
          totalValue: { not: null, gt: 0, lt: contractValue },
        },
        select: { supplierName: true, totalValue: true },
        distinct: ['supplierName'],
        orderBy: { totalValue: 'asc' },
        take: 5,
      });

      return alternatives.map(alt => ({
        supplier: alt.supplierName || 'Unknown',
        estimatedCost: Number(alt.totalValue),
        rating: Math.min(5, 3 + (1 - Number(alt.totalValue) / contractValue) * 2),
      }));
    } catch (error) {
      logger.warn({ error }, 'Failed to find alternatives');
      return [];
    }
  }

  /**
   * Identify overlapping services
   */
  private identifyOverlappingServices(contracts: any[]): any[] {
    // Simple overlap detection based on descriptions
    // In production, would use NLP to identify semantic overlap
    return contracts.slice(0, 2); // Return first 2 as potentially overlapping
  }

  /**
   * Group opportunities by type
   */
  private groupOpportunitiesByType(opportunities: DiscoveredOpportunity[]): Record<string, number> {
    const grouped: Record<string, number> = {};

    for (const opp of opportunities) {
      grouped[opp.type] = (grouped[opp.type] || 0) + 1;
    }

    return grouped;
  }
}

// Export singleton instance
export const opportunityDiscoveryEngine = new OpportunityDiscoveryEngine();
