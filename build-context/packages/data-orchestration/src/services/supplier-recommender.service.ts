/**
 * Supplier Recommender Service
 * 
 * Identifies alternative suppliers and ranks them by competitiveness.
 * Provides switching recommendations based on multi-factor analysis.
 * 
 * Requirements: 4.4
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { SupplierScore, supplierIntelligenceService } from './supplier-intelligence.service';
import { SimilarityScore, similarityCalculatorService } from './similarity-calculator.service';


export interface SupplierRecommendation {
  supplierId: string;
  supplierName: string;
  supplierTier: string;
  
  // Competitiveness
  competitivenessScore: number; // 0-100
  ranking: number;
  
  // Comparison to current supplier
  rateDifference: number; // % difference (negative = cheaper)
  rateDifferenceUSD: number; // Absolute difference
  
  // Coverage
  geographicCoverage: number; // % of required geographies covered
  roleCoverage: number; // % of required roles covered
  coverageGaps: string[];
  
  // Switching analysis
  switchingRecommendation: 'highly_recommended' | 'recommended' | 'consider' | 'not_recommended';
  switchingScore: number; // 0-100, overall switching attractiveness
  estimatedSavings: number; // Annual savings estimate
  
  // Risk factors
  riskFactors: RiskFactor[];
  riskLevel: 'low' | 'medium' | 'high';
  
  // Strengths
  strengths: string[];
  
  // Detailed metrics
  metrics: {
    avgRate: number;
    currentSupplierAvgRate: number;
    rateStability: number;
    marketPosition: number; // Percentile
    trendDirection: 'improving' | 'declining' | 'stable';
  };
  
  // Matching
  similarityToCurrentSupplier: number; // 0-100
  
  calculatedAt: Date;
}

export interface RiskFactor {
  type: 'coverage_gap' | 'rate_volatility' | 'limited_history' | 'declining_trend' | 'quality_concerns';
  severity: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
}

export interface RecommendationCriteria {
  currentSupplierId: string;
  tenantId: string;
  
  // Required coverage
  requiredGeographies?: string[];
  requiredRoles?: string[];
  requiredLineOfService?: string;
  
  // Preferences
  maxRateDifference?: number; // % (e.g., 10 = within 10% of current)
  minCoveragePercent?: number; // % (e.g., 80 = must cover 80% of requirements)
  preferredTiers?: string[];
  
  // Constraints
  excludeSuppliers?: string[];
  minDataQuality?: string;
  
  // Limits
  maxRecommendations?: number;
}

export interface SwitchingAnalysis {
  currentSupplierId: string;
  currentSupplierName: string;
  currentMetrics: SupplierMetrics;
  
  recommendations: SupplierRecommendation[];
  
  summary: {
    totalAlternatives: number;
    highlyRecommended: number;
    averagePotentialSavings: number;
    bestAlternative: SupplierRecommendation | null;
  };
  
  analysisDate: Date;
}

export interface SupplierMetrics {
  avgRate: number;
  rateCount: number;
  geographies: string[];
  roles: string[];
  competitivenessScore: number;
}

export class SupplierRecommenderService {
  /**
   * Recommend alternative suppliers for a given supplier
   */
  async recommendAlternatives(
    criteria: RecommendationCriteria
  ): Promise<SwitchingAnalysis> {
    const {
      currentSupplierId,
      tenantId,
      requiredGeographies = [],
      requiredRoles = [],
      requiredLineOfService,
      maxRateDifference = 20,
      minCoveragePercent = 70,
      preferredTiers = [],
      excludeSuppliers = [],
      minDataQuality = 'MEDIUM',
      maxRecommendations = 10
    } = criteria;

    // Get current supplier metrics
    const currentSupplier = await this.getSupplierMetrics(
      currentSupplierId,
      tenantId
    );

    if (!currentSupplier) {
      throw new Error(`Current supplier not found: ${currentSupplierId}`);
    }

    // If no required geographies/roles specified, use current supplier's coverage
    const targetGeographies = requiredGeographies.length > 0 
      ? requiredGeographies 
      : currentSupplier.geographies;
    
    const targetRoles = requiredRoles.length > 0 
      ? requiredRoles 
      : currentSupplier.roles;

    // Find candidate suppliers
    const candidates = await this.findCandidateSuppliers(
      tenantId,
      currentSupplierId,
      requiredLineOfService,
      excludeSuppliers,
      minDataQuality
    );

    // Analyze each candidate
    const recommendations: SupplierRecommendation[] = [];

    for (const candidate of candidates) {
      try {
        const recommendation = await this.analyzeSupplierAlternative(
          candidate.id,
          currentSupplier,
          targetGeographies,
          targetRoles,
          tenantId
        );

        // Apply filters
        if (Math.abs(recommendation.rateDifference) <= maxRateDifference &&
            recommendation.geographicCoverage >= minCoveragePercent &&
            recommendation.roleCoverage >= minCoveragePercent) {
          
          // Apply tier preference if specified
          if (preferredTiers.length === 0 || 
              preferredTiers.includes(recommendation.supplierTier)) {
            recommendations.push(recommendation);
          }
        }
      } catch {
        // Skip this candidate on error
      }
    }

    // Sort by switching score (descending)
    recommendations.sort((a, b) => b.switchingScore - a.switchingScore);

    // Limit results
    const topRecommendations = recommendations.slice(0, maxRecommendations);

    // Calculate summary
    const summary = {
      totalAlternatives: recommendations.length,
      highlyRecommended: recommendations.filter(
        r => r.switchingRecommendation === 'highly_recommended'
      ).length,
      averagePotentialSavings: recommendations.length > 0
        ? recommendations.reduce((sum, r) => sum + r.estimatedSavings, 0) / recommendations.length
        : 0,
      bestAlternative: topRecommendations.length > 0 ? topRecommendations[0] : null
    };

    return {
      currentSupplierId,
      currentSupplierName: currentSupplier.name,
      currentMetrics: {
        avgRate: currentSupplier.avgRate,
        rateCount: currentSupplier.rateCount,
        geographies: currentSupplier.geographies,
        roles: currentSupplier.roles,
        competitivenessScore: currentSupplier.competitivenessScore
      },
      recommendations: topRecommendations,
      summary,
      analysisDate: new Date()
    };
  }

  /**
   * Get detailed metrics for a supplier
   */
  private async getSupplierMetrics(
    supplierId: string,
    tenantId: string
  ): Promise<(SupplierMetrics & { id: string; name: string }) | null> {
    // Get supplier info
    const supplierResult = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
    }>>`
      SELECT id, name
      FROM rate_card_suppliers
      WHERE id = ${supplierId}
      AND tenant_id = ${tenantId}
    `;

    if (supplierResult.length === 0) {
      return null;
    }

    const supplier = supplierResult[0];

    // Get rate cards for this supplier
    const rateCards = await prisma.$queryRaw<Array<{
      daily_rate_usd: number;
      country: string;
      role_standardized: string;
    }>>`
      SELECT daily_rate_usd, country, role_standardized
      FROM rate_card_entries
      WHERE supplier_id = ${supplierId}
      AND tenant_id = ${tenantId}
      AND data_quality IN ('HIGH', 'MEDIUM')
    `;

    if (rateCards.length === 0) {
      return null;
    }

    // Calculate average rate
    const avgRate = rateCards.reduce(
      (sum, rc) => sum + Number(rc.daily_rate_usd), 0
    ) / rateCards.length;

    // Get unique geographies and roles
    const geographies: string[] = [...new Set(rateCards.map(rc => rc.country))];
    const roles: string[] = [...new Set(rateCards.map(rc => rc.role_standardized))];

    // Get competitiveness score
    let competitivenessScore = 50; // Default
    try {
      const score = await supplierIntelligenceService.calculateCompetitivenessScore(
        supplierId,
        tenantId
      );
      competitivenessScore = score.overallScore;
    } catch {
      // Use default competitiveness score
    }

    return {
      id: supplierId,
      name: supplier.name,
      avgRate,
      rateCount: rateCards.length,
      geographies,
      roles,
      competitivenessScore
    };
  }

  /**
   * Find candidate suppliers for recommendation
   */
  private async findCandidateSuppliers(
    tenantId: string,
    currentSupplierId: string,
    lineOfService?: string,
    excludeSuppliers: string[] = [],
    minDataQuality: string = 'MEDIUM'
  ): Promise<Array<{ id: string; name: string }>> {
    const excludeList = [currentSupplierId, ...excludeSuppliers];

    const conditions: Prisma.Sql[] = [
      Prisma.sql`s.tenant_id = ${tenantId}`,
      Prisma.sql`s.id != ALL(${excludeList}::text[])`,
      Prisma.sql`e.data_quality IN ('HIGH', 'MEDIUM')`,
    ];

    if (lineOfService) {
      conditions.push(Prisma.sql`e.line_of_service = ${lineOfService}`);
    }

    const where = Prisma.join(conditions, Prisma.sql` AND `);

    const suppliers = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
      SELECT DISTINCT s.id, s.name
      FROM rate_card_suppliers s
      INNER JOIN rate_card_entries e ON e.supplier_id = s.id
      WHERE ${where}
      LIMIT 50
    `;

    return suppliers;
  }

  /**
   * Analyze a supplier as an alternative to the current supplier
   */
  private async analyzeSupplierAlternative(
    candidateSupplierId: string,
    currentSupplier: SupplierMetrics & { id: string; name: string },
    requiredGeographies: string[],
    requiredRoles: string[],
    tenantId: string
  ): Promise<SupplierRecommendation> {
    // Get candidate supplier metrics
    const candidate = await this.getSupplierMetrics(candidateSupplierId, tenantId);

    if (!candidate) {
      throw new Error(`Candidate supplier not found: ${candidateSupplierId}`);
    }

    // Get supplier score
    const supplierScore = await supplierIntelligenceService.calculateCompetitivenessScore(
      candidateSupplierId,
      tenantId
    );

    // Calculate rate difference
    const rateDifference = ((candidate.avgRate - currentSupplier.avgRate) / 
      currentSupplier.avgRate) * 100;
    const rateDifferenceUSD = candidate.avgRate - currentSupplier.avgRate;

    // Calculate coverage
    const geographicCoverage = this.calculateCoverage(
      candidate.geographies,
      requiredGeographies
    );
    const roleCoverage = this.calculateCoverage(
      candidate.roles,
      requiredRoles
    );

    // Identify coverage gaps
    const coverageGaps = this.identifyCoverageGaps(
      candidate.geographies,
      candidate.roles,
      requiredGeographies,
      requiredRoles
    );

    // Calculate estimated savings
    const estimatedSavings = this.calculateEstimatedSavings(
      currentSupplier.avgRate,
      candidate.avgRate,
      currentSupplier.rateCount
    );

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(
      candidate,
      supplierScore,
      geographicCoverage,
      roleCoverage
    );

    const riskLevel = this.calculateRiskLevel(riskFactors);

    // Identify strengths
    const strengths = this.identifyStrengths(
      candidate,
      supplierScore,
      rateDifference
    );

    // Calculate similarity to current supplier
    const similarity = await this.calculateSupplierSimilarity(
      currentSupplier.id,
      candidateSupplierId,
      tenantId
    );

    // Calculate switching score
    const switchingScore = this.calculateSwitchingScore(
      supplierScore.overallScore,
      rateDifference,
      geographicCoverage,
      roleCoverage,
      riskLevel,
      similarity
    );

    // Determine switching recommendation
    const switchingRecommendation = this.determineSwitchingRecommendation(
      switchingScore,
      riskLevel,
      estimatedSavings
    );

    // Get supplier tier
    const supplierTier = await this.getSupplierTier(candidateSupplierId);

    return {
      supplierId: candidateSupplierId,
      supplierName: candidate.name,
      supplierTier,
      competitivenessScore: supplierScore.overallScore,
      ranking: supplierScore.ranking,
      rateDifference,
      rateDifferenceUSD,
      geographicCoverage,
      roleCoverage,
      coverageGaps,
      switchingRecommendation,
      switchingScore,
      estimatedSavings,
      riskFactors,
      riskLevel,
      strengths,
      metrics: {
        avgRate: candidate.avgRate,
        currentSupplierAvgRate: currentSupplier.avgRate,
        rateStability: supplierScore.dimensions.rateStability,
        marketPosition: 100 - supplierScore.dimensions.priceCompetitiveness,
        trendDirection: supplierScore.trend
      },
      similarityToCurrentSupplier: similarity,
      calculatedAt: new Date()
    };
  }

  /**
   * Calculate coverage percentage
   */
  private calculateCoverage(
    supplierItems: string[],
    requiredItems: string[]
  ): number {
    if (requiredItems.length === 0) return 100;

    const covered = requiredItems.filter(item => 
      supplierItems.includes(item)
    ).length;

    return (covered / requiredItems.length) * 100;
  }

  /**
   * Identify coverage gaps
   */
  private identifyCoverageGaps(
    supplierGeographies: string[],
    supplierRoles: string[],
    requiredGeographies: string[],
    requiredRoles: string[]
  ): string[] {
    const gaps: string[] = [];

    // Geography gaps
    const missingGeographies = requiredGeographies.filter(
      geo => !supplierGeographies.includes(geo)
    );
    if (missingGeographies.length > 0) {
      gaps.push(`Missing geographies: ${missingGeographies.join(', ')}`);
    }

    // Role gaps
    const missingRoles = requiredRoles.filter(
      role => !supplierRoles.includes(role)
    );
    if (missingRoles.length > 0) {
      gaps.push(`Missing roles: ${missingRoles.join(', ')}`);
    }

    return gaps;
  }

  /**
   * Calculate estimated annual savings
   */
  private calculateEstimatedSavings(
    currentRate: number,
    candidateRate: number,
    rateCount: number
  ): number {
    const dailySavings = currentRate - candidateRate;
    
    // Assume 220 working days per year
    const annualSavings = dailySavings * rateCount * 220;

    return Math.max(0, annualSavings);
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(
    candidate: SupplierMetrics & { id: string; name: string },
    supplierScore: SupplierScore,
    geographicCoverage: number,
    roleCoverage: number
  ): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Coverage gaps
    if (geographicCoverage < 80 || roleCoverage < 80) {
      risks.push({
        type: 'coverage_gap',
        severity: geographicCoverage < 50 || roleCoverage < 50 ? 'high' : 'medium',
        description: 'Incomplete coverage of required geographies or roles',
        impact: 'May require multiple suppliers or limit flexibility'
      });
    }

    // Rate volatility
    if (supplierScore.dimensions.rateStability < 60) {
      risks.push({
        type: 'rate_volatility',
        severity: supplierScore.dimensions.rateStability < 40 ? 'high' : 'medium',
        description: 'High rate volatility detected',
        impact: 'Unpredictable future costs'
      });
    }

    // Limited history
    if (candidate.rateCount < 10) {
      risks.push({
        type: 'limited_history',
        severity: 'medium',
        description: 'Limited historical rate data',
        impact: 'Less confidence in performance predictions'
      });
    }

    // Declining trend
    if (supplierScore.trend === 'declining') {
      risks.push({
        type: 'declining_trend',
        severity: 'medium',
        description: 'Supplier competitiveness is declining',
        impact: 'May face increasing rates in the future'
      });
    }

    return risks;
  }

  /**
   * Calculate overall risk level
   */
  private calculateRiskLevel(riskFactors: RiskFactor[]): 'low' | 'medium' | 'high' {
    if (riskFactors.length === 0) return 'low';

    const highRisks = riskFactors.filter(r => r.severity === 'high').length;
    const mediumRisks = riskFactors.filter(r => r.severity === 'medium').length;

    if (highRisks >= 2 || (highRisks >= 1 && mediumRisks >= 2)) {
      return 'high';
    } else if (highRisks >= 1 || mediumRisks >= 2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Identify supplier strengths
   */
  private identifyStrengths(
    candidate: SupplierMetrics & { id: string; name: string },
    supplierScore: SupplierScore,
    rateDifference: number
  ): string[] {
    const strengths: string[] = [];

    // Price competitiveness
    if (rateDifference < -10) {
      strengths.push(`Significantly lower rates (${Math.abs(rateDifference).toFixed(1)}% cheaper)`);
    } else if (rateDifference < 0) {
      strengths.push(`Lower rates (${Math.abs(rateDifference).toFixed(1)}% cheaper)`);
    }

    // High competitiveness
    if (supplierScore.overallScore >= 80) {
      strengths.push('Highly competitive overall score');
    }

    // Geographic coverage
    if (supplierScore.dimensions.geographicCoverage >= 80) {
      strengths.push('Excellent geographic coverage');
    }

    // Rate stability
    if (supplierScore.dimensions.rateStability >= 80) {
      strengths.push('Very stable rates');
    }

    // Improving trend
    if (supplierScore.trend === 'improving') {
      strengths.push('Improving competitiveness trend');
    }

    // Large portfolio
    if (candidate.rateCount >= 50) {
      strengths.push('Extensive rate card portfolio');
    }

    return strengths;
  }

  /**
   * Calculate supplier similarity
   */
  private async calculateSupplierSimilarity(
    supplier1Id: string,
    supplier2Id: string,
    tenantId: string
  ): Promise<number> {
    try {
      // Get sample rate cards from each supplier
      const supplier1Cards = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM rate_card_entries
        WHERE supplier_id = ${supplier1Id}
        AND tenant_id = ${tenantId}
        AND data_quality IN ('HIGH', 'MEDIUM')
        LIMIT 5
      `;

      const supplier2Cards = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM rate_card_entries
        WHERE supplier_id = ${supplier2Id}
        AND tenant_id = ${tenantId}
        AND data_quality IN ('HIGH', 'MEDIUM')
        LIMIT 5
      `;

      if (supplier1Cards.length === 0 || supplier2Cards.length === 0) {
        return 50; // Default similarity
      }

      // Calculate average similarity across sample rate cards
      let totalSimilarity = 0;
      let comparisons = 0;

      for (const card1 of supplier1Cards) {
        for (const card2 of supplier2Cards) {
          try {
            const similarity = await similarityCalculatorService.calculateSimilarity(
              card1.id,
              card2.id
            );
            totalSimilarity += similarity.overallScore;
            comparisons++;
          } catch (error) {
            // Skip failed comparisons
          }
        }
      }

      return comparisons > 0 ? totalSimilarity / comparisons : 50;
    } catch {
      return 50; // Default
    }
  }

  /**
   * Calculate switching score (0-100)
   */
  private calculateSwitchingScore(
    competitivenessScore: number,
    rateDifference: number,
    geographicCoverage: number,
    roleCoverage: number,
    riskLevel: 'low' | 'medium' | 'high',
    similarity: number
  ): number {
    // Weights
    const weights = {
      competitiveness: 0.30,
      savings: 0.25,
      coverage: 0.25,
      risk: 0.15,
      similarity: 0.05
    };

    // Competitiveness score (0-100)
    const competitivenessComponent = competitivenessScore;

    // Savings score (0-100)
    // More negative = better (cheaper)
    const savingsScore = Math.min(100, Math.max(0, 50 - rateDifference * 2));

    // Coverage score (0-100)
    const coverageScore = (geographicCoverage + roleCoverage) / 2;

    // Risk score (0-100)
    const riskScore = riskLevel === 'low' ? 100 : riskLevel === 'medium' ? 60 : 30;

    // Similarity score (0-100)
    const similarityScore = similarity;

    // Calculate weighted score
    const switchingScore = 
      competitivenessComponent * weights.competitiveness +
      savingsScore * weights.savings +
      coverageScore * weights.coverage +
      riskScore * weights.risk +
      similarityScore * weights.similarity;

    return Math.round(switchingScore * 100) / 100;
  }

  /**
   * Determine switching recommendation
   */
  private determineSwitchingRecommendation(
    switchingScore: number,
    riskLevel: 'low' | 'medium' | 'high',
    estimatedSavings: number
  ): 'highly_recommended' | 'recommended' | 'consider' | 'not_recommended' {
    // High risk = not recommended
    if (riskLevel === 'high') {
      return 'not_recommended';
    }

    // High score + low risk = highly recommended
    if (switchingScore >= 80 && riskLevel === 'low' && estimatedSavings > 100000) {
      return 'highly_recommended';
    }

    // Good score = recommended
    if (switchingScore >= 70 && estimatedSavings > 50000) {
      return 'recommended';
    }

    // Moderate score = consider
    if (switchingScore >= 60) {
      return 'consider';
    }

    // Low score = not recommended
    return 'not_recommended';
  }

  /**
   * Get supplier tier
   */
  private async getSupplierTier(supplierId: string): Promise<string> {
    const result = await prisma.$queryRaw<Array<{ supplier_tier: string }>>`
      SELECT supplier_tier
      FROM rate_card_entries
      WHERE supplier_id = ${supplierId}
      LIMIT 1
    `;

    return result.length > 0 ? result[0].supplier_tier : 'UNKNOWN';
  }

  /**
   * Get quick recommendations for a supplier (simplified version)
   */
  async getQuickRecommendations(
    supplierId: string,
    tenantId: string,
    limit: number = 5
  ): Promise<SupplierRecommendation[]> {
    const criteria: RecommendationCriteria = {
      currentSupplierId: supplierId,
      tenantId,
      maxRecommendations: limit,
      minCoveragePercent: 60
    };

    const analysis = await this.recommendAlternatives(criteria);
    return analysis.recommendations;
  }
}

export const supplierRecommenderService = new SupplierRecommenderService();
