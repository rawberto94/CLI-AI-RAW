/**
 * Geographic Arbitrage Service
 * 
 * Detects rate variations across geographies within clusters
 * and identifies opportunities for cost savings through geographic shifts.
 */

import { PrismaClient } from '@prisma/client';
import { RateCardCluster } from './rate-card-clustering.service';

const prisma = new PrismaClient();

export interface GeographicArbitrageOpportunity {
  id: string;
  clusterId: string;
  clusterName: string;
  
  // Geographic Analysis
  sourceGeography: GeographyInfo;
  targetGeography: GeographyInfo;
  
  // Financial Impact
  currentAverageRate: number;
  targetAverageRate: number;
  rateDifference: number;
  savingsPercentage: number;
  annualSavingsPotential: number;
  
  // Volume Analysis
  affectedRoles: number;
  estimatedFTEs: number;
  
  // Quality & Risk
  qualityDifference: string; // 'SAME', 'BETTER', 'WORSE'
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: string[];
  
  // Implementation
  feasibility: 'HIGH' | 'MEDIUM' | 'LOW';
  considerations: string[];
  recommendations: string[];
  
  // Confidence
  confidence: number; // 0-100
  sampleSize: { source: number; target: number };
}

export interface GeographyInfo {
  country: string;
  region: string;
  averageRate: number;
  medianRate: number;
  rateCount: number;
  supplierCount: number;
  commonSuppliers: string[];
  qualityScore: number;
}

export interface ArbitrageRanking {
  opportunities: GeographicArbitrageOpportunity[];
  totalPotentialSavings: number;
  totalOpportunities: number;
}

export class GeographicArbitrageService {
  /**
   * Detect geographic arbitrage opportunities within a cluster
   */
  async detectArbitrageOpportunities(
    clusterId: string,
    cluster: RateCardCluster,
    tenantId: string
  ): Promise<GeographicArbitrageOpportunity[]> {
    // Fetch detailed rate card information with geography
    const rateCards = await prisma.rateCardEntry.findMany({
      where: {
        id: { in: cluster.members },
        tenantId,
      },
      select: {
        id: true,
        country: true,
        region: true,
        dailyRateUSD: true,
        supplierId: true,
        supplierName: true,
        supplierTier: true,
        dataQuality: true,
        remoteAllowed: true,
        volumeCommitted: true,
      },
    });

    // Group by geography
    const geographyGroups = this.groupByGeography(rateCards);

    // Need at least 2 geographies for arbitrage
    if (geographyGroups.length < 2) {
      return [];
    }

    // Analyze each geography
    const geographyInfos = geographyGroups.map((group) =>
      this.analyzeGeography(group.rateCards, group.country, group.region)
    );

    // Find arbitrage opportunities (compare all pairs)
    const opportunities: GeographicArbitrageOpportunity[] = [];

    for (let i = 0; i < geographyInfos.length; i++) {
      for (let j = i + 1; j < geographyInfos.length; j++) {
        const geo1 = geographyInfos[i];
        const geo2 = geographyInfos[j];

        // Determine source (higher cost) and target (lower cost)
        const [source, target] =
          geo1.averageRate > geo2.averageRate ? [geo1, geo2] : [geo2, geo1];

        // Calculate savings potential
        const rateDifference = source.averageRate - target.averageRate;
        const savingsPercentage = (rateDifference / source.averageRate) * 100;

        // Only consider if savings > 10%
        if (savingsPercentage < 10) continue;

        // Estimate annual savings
        const estimatedFTEs = Math.min(source.rateCount, 10); // Conservative estimate
        const annualSavings = rateDifference * estimatedFTEs * 200; // 200 days/year

        // Assess quality difference
        const qualityDifference = this.assessQualityDifference(source, target);

        // Assess risk
        const { riskLevel, riskFactors } = this.assessArbitrageRisk(source, target, cluster);

        // Assess feasibility
        const feasibility = this.assessFeasibility(source, target, rateCards);

        // Generate considerations and recommendations
        const considerations = this.generateConsiderations(source, target);
        const recommendations = this.generateRecommendations(source, target, feasibility);

        // Calculate confidence
        const confidence = this.calculateConfidence(source, target);

        opportunities.push({
          id: `arbitrage-${clusterId}-${source.country}-${target.country}`,
          clusterId,
          clusterName: cluster.name,
          sourceGeography: source,
          targetGeography: target,
          currentAverageRate: source.averageRate,
          targetAverageRate: target.averageRate,
          rateDifference,
          savingsPercentage,
          annualSavingsPotential: annualSavings,
          affectedRoles: source.rateCount,
          estimatedFTEs,
          qualityDifference,
          riskLevel,
          riskFactors,
          feasibility,
          considerations,
          recommendations,
          confidence,
          sampleSize: {
            source: source.rateCount,
            target: target.rateCount,
          },
        });
      }
    }

    return opportunities.sort((a, b) => b.annualSavingsPotential - a.annualSavingsPotential);
  }

  /**
   * Calculate arbitrage savings potential
   */
  calculateArbitrageSavings(
    sourceRate: number,
    targetRate: number,
    volume: number
  ): { savings: number; percentage: number } {
    const rateDifference = sourceRate - targetRate;
    const annualSavings = rateDifference * volume * 200; // 200 working days

    return {
      savings: Math.max(annualSavings, 0),
      percentage: (rateDifference / sourceRate) * 100,
    };
  }

  /**
   * Recommend geographic shifts for a cluster
   */
  async recommendGeographicShifts(
    clusterId: string,
    cluster: RateCardCluster,
    tenantId: string,
    minSavingsPercentage: number = 15
  ): Promise<string[]> {
    const opportunities = await this.detectArbitrageOpportunities(clusterId, cluster, tenantId);

    const recommendations: string[] = [];

    for (const opp of opportunities) {
      if (opp.savingsPercentage >= minSavingsPercentage && opp.feasibility !== 'LOW') {
        recommendations.push(
          `Consider shifting ${opp.affectedRoles} roles from ${opp.sourceGeography.country} to ${opp.targetGeography.country} ` +
            `for ${opp.savingsPercentage.toFixed(1)}% savings ($${Math.round(opp.annualSavingsPotential).toLocaleString()}/year)`
        );
      }
    }

    return recommendations;
  }

  /**
   * Group rate cards by geography
   */
  private groupByGeography(
    rateCards: any[]
  ): Array<{ country: string; region: string; rateCards: any[] }> {
    const groups = new Map<string, any[]>();

    for (const rc of rateCards) {
      const key = `${rc.country}|${rc.region}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(rc);
    }

    return Array.from(groups.entries()).map(([key, rateCards]) => {
      const [country, region] = key.split('|');
      return { country, region, rateCards };
    });
  }

  /**
   * Analyze a geography's characteristics
   */
  private analyzeGeography(rateCards: any[], country: string, region: string): GeographyInfo {
    const rates = rateCards.map((rc) => parseFloat(rc.dailyRateUSD.toString()));
    const averageRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;

    // Calculate median
    const sortedRates = [...rates].sort((a, b) => a - b);
    const medianRate =
      sortedRates.length % 2 === 0
        ? (sortedRates[sortedRates.length / 2 - 1] + sortedRates[sortedRates.length / 2]) / 2
        : sortedRates[Math.floor(sortedRates.length / 2)];

    // Get unique suppliers
    const suppliers = new Set(rateCards.map((rc) => rc.supplierId));
    const supplierNames = [...new Set(rateCards.map((rc) => rc.supplierName))];

    // Calculate quality score
    const qualityScore = this.calculateGeographyQualityScore(rateCards);

    return {
      country,
      region,
      averageRate,
      medianRate,
      rateCount: rateCards.length,
      supplierCount: suppliers.size,
      commonSuppliers: supplierNames.slice(0, 3),
      qualityScore,
    };
  }

  /**
   * Calculate quality score for a geography
   */
  private calculateGeographyQualityScore(rateCards: any[]): number {
    let score = 100;

    // Penalize for low data quality
    const lowQuality = rateCards.filter((rc) => rc.dataQuality === 'LOW').length;
    score -= (lowQuality / rateCards.length) * 30;

    // Penalize for small sample size
    if (rateCards.length < 3) {
      score -= 20;
    }

    // Bonus for remote work capability
    const remoteCapable = rateCards.filter((rc) => rc.remoteAllowed).length;
    score += (remoteCapable / rateCards.length) * 10;

    return Math.max(Math.min(score, 100), 0);
  }

  /**
   * Assess quality difference between geographies
   */
  private assessQualityDifference(
    source: GeographyInfo,
    target: GeographyInfo
  ): 'SAME' | 'BETTER' | 'WORSE' {
    const qualityDiff = target.qualityScore - source.qualityScore;

    if (Math.abs(qualityDiff) < 10) {
      return 'SAME';
    } else if (qualityDiff > 0) {
      return 'BETTER';
    } else {
      return 'WORSE';
    }
  }

  /**
   * Assess risk of geographic arbitrage
   */
  private assessArbitrageRisk(
    source: GeographyInfo,
    target: GeographyInfo,
    cluster: RateCardCluster
  ): { riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; riskFactors: string[] } {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Risk: Quality degradation
    if (target.qualityScore < source.qualityScore - 15) {
      riskFactors.push('Target geography has lower quality score - may impact delivery quality');
      riskScore += 2;
    }

    // Risk: Limited supplier options
    if (target.supplierCount < 2) {
      riskFactors.push('Limited supplier options in target geography - vendor lock-in risk');
      riskScore += 2;
    }

    // Risk: Small sample size
    if (target.rateCount < 3) {
      riskFactors.push('Limited data in target geography - rates may not be representative');
      riskScore += 1;
    }

    // Risk: Large rate difference (may indicate quality/capability gap)
    const rateDiff = ((source.averageRate - target.averageRate) / source.averageRate) * 100;
    if (rateDiff > 40) {
      riskFactors.push(
        'Very large rate difference - may indicate significant capability or quality gap'
      );
      riskScore += 2;
    }

    // Risk: Cross-region shift
    if (source.region !== target.region) {
      riskFactors.push('Cross-region shift - consider time zone and cultural differences');
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
   * Assess feasibility of geographic shift
   */
  private assessFeasibility(
    source: GeographyInfo,
    target: GeographyInfo,
    allRateCards: any[]
  ): 'HIGH' | 'MEDIUM' | 'LOW' {
    let feasibilityScore = 100;

    // Check for common suppliers
    const commonSuppliers = source.commonSuppliers.filter((s) =>
      target.commonSuppliers.includes(s)
    );
    if (commonSuppliers.length === 0) {
      feasibilityScore -= 30;
    }

    // Check for remote work capability
    const targetRemoteCapable = allRateCards.filter(
      (rc) => rc.country === target.country && rc.remoteAllowed
    ).length;
    if (targetRemoteCapable === 0) {
      feasibilityScore -= 20;
    }

    // Check quality difference
    if (target.qualityScore < source.qualityScore - 20) {
      feasibilityScore -= 25;
    }

    // Check supplier availability
    if (target.supplierCount < 2) {
      feasibilityScore -= 15;
    }

    if (feasibilityScore >= 70) {
      return 'HIGH';
    } else if (feasibilityScore >= 40) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * Generate considerations for geographic shift
   */
  private generateConsiderations(source: GeographyInfo, target: GeographyInfo): string[] {
    const considerations: string[] = [];

    considerations.push(`Time zone difference between ${source.country} and ${target.country}`);
    considerations.push('Language and cultural compatibility');
    considerations.push('Data privacy and regulatory compliance requirements');
    considerations.push('Infrastructure and connectivity requirements');

    if (target.supplierCount < source.supplierCount) {
      considerations.push('Reduced supplier competition in target geography');
    }

    if (source.region !== target.region) {
      considerations.push('Cross-regional coordination and management overhead');
    }

    return considerations;
  }

  /**
   * Generate recommendations for geographic shift
   */
  private generateRecommendations(
    source: GeographyInfo,
    target: GeographyInfo,
    feasibility: 'HIGH' | 'MEDIUM' | 'LOW'
  ): string[] {
    const recommendations: string[] = [];

    if (feasibility === 'HIGH') {
      recommendations.push(
        `Strong candidate for geographic shift from ${source.country} to ${target.country}`
      );
      recommendations.push('Conduct pilot program with 2-3 resources before full transition');
    } else if (feasibility === 'MEDIUM') {
      recommendations.push('Feasible with proper planning and risk mitigation');
      recommendations.push('Assess quality and capability thoroughly before proceeding');
    } else {
      recommendations.push('High risk - consider alternative cost reduction strategies');
      recommendations.push('If proceeding, implement extensive quality controls');
    }

    recommendations.push(`Negotiate volume pricing with suppliers in ${target.country}`);
    recommendations.push('Establish clear SLAs and quality metrics');
    recommendations.push('Plan for knowledge transfer and onboarding');

    return recommendations;
  }

  /**
   * Calculate confidence in arbitrage opportunity
   */
  private calculateConfidence(source: GeographyInfo, target: GeographyInfo): number {
    let confidence = 100;

    // Reduce confidence for small sample sizes
    if (source.rateCount < 5) {
      confidence -= 20;
    }
    if (target.rateCount < 5) {
      confidence -= 20;
    }

    // Reduce confidence for low quality scores
    if (source.qualityScore < 70) {
      confidence -= 10;
    }
    if (target.qualityScore < 70) {
      confidence -= 10;
    }

    // Reduce confidence if limited suppliers
    if (target.supplierCount < 2) {
      confidence -= 15;
    }

    return Math.max(confidence, 0);
  }
}

export const geographicArbitrageService = new GeographicArbitrageService();
