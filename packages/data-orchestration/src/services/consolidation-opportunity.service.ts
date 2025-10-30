/**
 * Consolidation Opportunity Service
 * 
 * Identifies and analyzes supplier consolidation opportunities within clusters
 * to maximize cost savings and operational efficiency.
 */

import { PrismaClient } from '@prisma/client';
import { RateCardCluster } from './rate-card-clustering.service';
import { similarityCalculatorService } from './similarity-calculator.service';

const prisma = new PrismaClient();

export interface ConsolidationOpportunity {
  id: string;
  clusterId: string;
  clusterName: string;
  
  // Supplier Analysis
  currentSuppliers: SupplierInfo[];
  recommendedSupplier: SupplierInfo;
  suppliersToConsolidate: string[];
  
  // Financial Impact
  currentAnnualCost: number;
  projectedAnnualCost: number;
  annualSavings: number;
  savingsPercentage: number;
  
  // Volume Analysis
  totalVolume: number; // Total FTEs or days
  volumeBySupplier: Record<string, number>;
  
  // Risk Assessment
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: string[];
  
  // Implementation
  implementationComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedTimeframe: string;
  actionItems: string[];
  
  // Confidence
  confidence: number; // 0-100
  dataQuality: number; // 0-100
}

export interface SupplierInfo {
  supplierId: string;
  supplierName: string;
  supplierTier: string;
  rateCardCount: number;
  averageRate: number;
  totalAnnualCost: number;
  competitivenessScore?: number;
}

export interface ConsolidationRanking {
  opportunities: ConsolidationOpportunity[];
  totalPotentialSavings: number;
  totalOpportunities: number;
}

export class ConsolidationOpportunityService {
  /**
   * Identify consolidation opportunities within a cluster
   */
  async identifyConsolidationOpportunities(
    clusterId: string,
    cluster: RateCardCluster,
    tenantId: string
  ): Promise<ConsolidationOpportunity | null> {
    // Fetch detailed rate card information
    const rateCards = await prisma.rateCardEntry.findMany({
      where: {
        id: { in: cluster.members },
        tenantId,
      },
      select: {
        id: true,
        supplierId: true,
        supplierName: true,
        supplierTier: true,
        dailyRateUSD: true,
        volumeCommitted: true,
        contractValue: true,
        effectiveDate: true,
        expiryDate: true,
      },
    });

    // Group by supplier
    const supplierGroups = this.groupBySupplier(rateCards);
    
    // Need at least 2 suppliers for consolidation
    if (supplierGroups.length < 2) {
      return null;
    }

    // Analyze each supplier
    const supplierInfos = supplierGroups.map((group) => this.analyzeSupplier(group));

    // Find best supplier (lowest average rate with good volume)
    const recommendedSupplier = this.selectRecommendedSupplier(supplierInfos);

    // Calculate consolidation savings
    const { currentCost, projectedCost, savings } = this.calculateConsolidationSavings(
      supplierInfos,
      recommendedSupplier
    );

    // Identify suppliers to consolidate
    const suppliersToConsolidate = supplierInfos
      .filter((s) => s.supplierId !== recommendedSupplier.supplierId)
      .map((s) => s.supplierId);

    // Assess risk
    const { riskLevel, riskFactors } = this.assessConsolidationRisk(
      supplierInfos,
      recommendedSupplier,
      cluster
    );

    // Determine implementation complexity
    const implementationComplexity = this.assessImplementationComplexity(
      supplierInfos.length,
      cluster.memberCount
    );

    // Generate action items
    const actionItems = this.generateActionItems(
      recommendedSupplier,
      suppliersToConsolidate,
      cluster
    );

    // Calculate confidence and data quality
    const confidence = this.calculateConfidence(rateCards, supplierInfos);
    const dataQuality = this.calculateDataQuality(rateCards);

    return {
      id: `consolidation-${clusterId}`,
      clusterId,
      clusterName: cluster.name,
      currentSuppliers: supplierInfos,
      recommendedSupplier,
      suppliersToConsolidate,
      currentAnnualCost: currentCost,
      projectedAnnualCost: projectedCost,
      annualSavings: savings,
      savingsPercentage: (savings / currentCost) * 100,
      totalVolume: cluster.memberCount,
      volumeBySupplier: this.calculateVolumeBySupplier(supplierInfos),
      riskLevel,
      riskFactors,
      implementationComplexity,
      estimatedTimeframe: this.estimateTimeframe(implementationComplexity),
      actionItems,
      confidence,
      dataQuality,
    };
  }

  /**
   * Rank consolidation opportunities by savings potential
   */
  async rankConsolidationOpportunities(
    opportunities: ConsolidationOpportunity[]
  ): Promise<ConsolidationRanking> {
    // Sort by annual savings (descending)
    const rankedOpportunities = opportunities.sort(
      (a, b) => b.annualSavings - a.annualSavings
    );

    // Calculate totals
    const totalPotentialSavings = opportunities.reduce(
      (sum, opp) => sum + opp.annualSavings,
      0
    );

    return {
      opportunities: rankedOpportunities,
      totalPotentialSavings,
      totalOpportunities: opportunities.length,
    };
  }

  /**
   * Calculate potential savings from consolidating to a single supplier
   */
  calculateConsolidationSavings(
    suppliers: SupplierInfo[],
    recommendedSupplier: SupplierInfo
  ): { currentCost: number; projectedCost: number; savings: number } {
    // Current annual cost (sum of all suppliers)
    const currentCost = suppliers.reduce((sum, s) => sum + s.totalAnnualCost, 0);

    // Projected cost if consolidated to recommended supplier
    const totalVolume = suppliers.reduce((sum, s) => s.rateCardCount, 0);
    const projectedCost = recommendedSupplier.averageRate * totalVolume * 200; // 200 days/year

    // Apply volume discount (5-15% based on volume)
    const volumeDiscountRate = Math.min(0.05 + (totalVolume / 100) * 0.01, 0.15);
    const projectedCostWithDiscount = projectedCost * (1 - volumeDiscountRate);

    const savings = currentCost - projectedCostWithDiscount;

    return {
      currentCost,
      projectedCost: projectedCostWithDiscount,
      savings: Math.max(savings, 0),
    };
  }

  /**
   * Group rate cards by supplier
   */
  private groupBySupplier(rateCards: any[]): any[][] {
    const groups = new Map<string, any[]>();

    for (const rc of rateCards) {
      const supplierId = rc.supplierId;
      if (!groups.has(supplierId)) {
        groups.set(supplierId, []);
      }
      groups.get(supplierId)!.push(rc);
    }

    return Array.from(groups.values());
  }

  /**
   * Analyze a supplier's performance
   */
  private analyzeSupplier(rateCards: any[]): SupplierInfo {
    const rates = rateCards.map((rc) => parseFloat(rc.dailyRateUSD.toString()));
    const averageRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;

    // Estimate annual cost (assuming 200 working days per resource)
    const totalAnnualCost = averageRate * rateCards.length * 200;

    return {
      supplierId: rateCards[0].supplierId,
      supplierName: rateCards[0].supplierName,
      supplierTier: rateCards[0].supplierTier,
      rateCardCount: rateCards.length,
      averageRate,
      totalAnnualCost,
    };
  }

  /**
   * Select the recommended supplier for consolidation
   */
  private selectRecommendedSupplier(suppliers: SupplierInfo[]): SupplierInfo {
    // Score each supplier based on:
    // 1. Average rate (lower is better)
    // 2. Volume (higher is better - indicates capacity)
    // 3. Tier (higher tier may be more reliable)

    const scores = suppliers.map((supplier) => {
      const rateScore = 1 / supplier.averageRate; // Lower rate = higher score
      const volumeScore = supplier.rateCardCount / 10; // Normalize volume
      const tierScore = this.getTierScore(supplier.supplierTier);

      return {
        supplier,
        score: rateScore * 0.6 + volumeScore * 0.2 + tierScore * 0.2,
      };
    });

    // Return supplier with highest score
    return scores.sort((a, b) => b.score - a.score)[0].supplier;
  }

  /**
   * Get numeric score for supplier tier
   */
  private getTierScore(tier: string): number {
    const tierScores: Record<string, number> = {
      BIG_4: 1.0,
      TIER_2: 0.8,
      BOUTIQUE: 0.6,
      OFFSHORE: 0.4,
    };
    return tierScores[tier] || 0.5;
  }

  /**
   * Assess risk of consolidation
   */
  private assessConsolidationRisk(
    suppliers: SupplierInfo[],
    recommendedSupplier: SupplierInfo,
    cluster: RateCardCluster
  ): { riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; riskFactors: string[] } {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Risk: Consolidating to offshore supplier
    if (recommendedSupplier.supplierTier === 'OFFSHORE') {
      riskFactors.push('Recommended supplier is offshore - may have quality/communication risks');
      riskScore += 2;
    }

    // Risk: Large volume consolidation
    if (cluster.memberCount > 20) {
      riskFactors.push('Large volume consolidation - implementation may be complex');
      riskScore += 1;
    }

    // Risk: Consolidating from Big 4
    const hasBig4 = suppliers.some((s) => s.supplierTier === 'BIG_4');
    if (hasBig4 && recommendedSupplier.supplierTier !== 'BIG_4') {
      riskFactors.push('Moving away from Big 4 supplier - ensure quality standards are met');
      riskScore += 1;
    }

    // Risk: Recommended supplier has low volume
    if (recommendedSupplier.rateCardCount < 3) {
      riskFactors.push('Recommended supplier has limited current volume - capacity risk');
      riskScore += 1;
    }

    // Risk: High rate variance in cluster
    const rateRange = cluster.characteristics.maxRate - cluster.characteristics.minRate;
    const rateVariance = rateRange / cluster.characteristics.avgRate;
    if (rateVariance > 0.5) {
      riskFactors.push('High rate variance in cluster - consolidation may be challenging');
      riskScore += 1;
    }

    // Determine risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    if (riskScore <= 1) {
      riskLevel = 'LOW';
    } else if (riskScore <= 3) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'HIGH';
    }

    return { riskLevel, riskFactors };
  }

  /**
   * Assess implementation complexity
   */
  private assessImplementationComplexity(
    supplierCount: number,
    volumeCount: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (supplierCount <= 2 && volumeCount <= 10) {
      return 'LOW';
    } else if (supplierCount <= 4 && volumeCount <= 25) {
      return 'MEDIUM';
    } else {
      return 'HIGH';
    }
  }

  /**
   * Generate action items for consolidation
   */
  private generateActionItems(
    recommendedSupplier: SupplierInfo,
    suppliersToConsolidate: string[],
    cluster: RateCardCluster
  ): string[] {
    const actionItems: string[] = [];

    actionItems.push(
      `Initiate negotiation with ${recommendedSupplier.supplierName} for volume consolidation`
    );
    actionItems.push(
      `Request volume discount pricing for ${cluster.memberCount} resources`
    );
    actionItems.push(
      `Assess capacity and capability of ${recommendedSupplier.supplierName} for increased volume`
    );

    if (suppliersToConsolidate.length > 0) {
      actionItems.push(
        `Plan transition from ${suppliersToConsolidate.length} supplier(s) to ${recommendedSupplier.supplierName}`
      );
      actionItems.push(`Review and plan contract terminations or non-renewals`);
    }

    actionItems.push(`Establish KPIs and quality metrics for consolidated supplier`);
    actionItems.push(`Create transition timeline and communication plan`);

    return actionItems;
  }

  /**
   * Calculate volume by supplier
   */
  private calculateVolumeBySupplier(suppliers: SupplierInfo[]): Record<string, number> {
    return suppliers.reduce((acc, supplier) => {
      acc[supplier.supplierName] = supplier.rateCardCount;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Estimate implementation timeframe
   */
  private estimateTimeframe(complexity: 'LOW' | 'MEDIUM' | 'HIGH'): string {
    switch (complexity) {
      case 'LOW':
        return '1-2 months';
      case 'MEDIUM':
        return '3-4 months';
      case 'HIGH':
        return '6-9 months';
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(rateCards: any[], suppliers: SupplierInfo[]): number {
    let confidence = 100;

    // Reduce confidence if data is limited
    if (rateCards.length < 5) {
      confidence -= 20;
    }

    // Reduce confidence if only 2 suppliers
    if (suppliers.length === 2) {
      confidence -= 10;
    }

    // Reduce confidence if rate variance is high
    const rates = rateCards.map((rc: any) => parseFloat(rc.dailyRateUSD.toString()));
    const avg = rates.reduce((sum: number, r: number) => sum + r, 0) / rates.length;
    const variance =
      rates.reduce((sum: number, r: number) => sum + Math.pow(r - avg, 2), 0) / rates.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avg;

    if (coefficientOfVariation > 0.3) {
      confidence -= 15;
    }

    return Math.max(confidence, 0);
  }

  /**
   * Calculate data quality score
   */
  private calculateDataQuality(rateCards: any[]): number {
    let qualityScore = 100;

    // Check for missing contract values
    const missingValues = rateCards.filter((rc: any) => !rc.contractValue).length;
    qualityScore -= (missingValues / rateCards.length) * 20;

    // Check for missing volume commitments
    const missingVolume = rateCards.filter((rc: any) => !rc.volumeCommitted).length;
    qualityScore -= (missingVolume / rateCards.length) * 15;

    // Check for expired contracts
    const now = new Date();
    const expired = rateCards.filter(
      (rc: any) => rc.expiryDate && new Date(rc.expiryDate) < now
    ).length;
    qualityScore -= (expired / rateCards.length) * 10;

    return Math.max(qualityScore, 0);
  }
}

export const consolidationOpportunityService = new ConsolidationOpportunityService();
