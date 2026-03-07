/**
 * Similarity Calculator Service
 * 
 * Calculates multi-dimensional similarity scores between rate cards
 * using weighted feature comparison.
 */

import { prisma } from '../lib/prisma';


export interface SimilarityWeights {
  role: number;
  seniority: number;
  geography: number;
  rate: number;
  supplier: number;
  lineOfService: number;
}

export interface SimilarityScore {
  overallScore: number; // 0-100
  dimensionScores: {
    role: number;
    seniority: number;
    geography: number;
    rate: number;
    supplier: number;
    lineOfService: number;
  };
  explanation: string;
}

export interface PairwiseSimilarity {
  rateCard1Id: string;
  rateCard2Id: string;
  similarityScore: number;
  dimensionScores: Record<string, number>;
}

export class SimilarityCalculatorService {
  // Default weights for similarity calculation
  private defaultWeights: SimilarityWeights = {
    role: 0.25, // 25% - Role is very important
    seniority: 0.15, // 15% - Seniority matters
    geography: 0.20, // 20% - Geography is important for rates
    rate: 0.20, // 20% - Rate similarity
    supplier: 0.10, // 10% - Supplier tier
    lineOfService: 0.10, // 10% - Line of service
  };

  /**
   * Calculate similarity between two rate cards
   */
  async calculateSimilarity(
    rateCard1Id: string,
    rateCard2Id: string,
    weights?: Partial<SimilarityWeights>
  ): Promise<SimilarityScore> {
    const effectiveWeights = { ...this.defaultWeights, ...weights };

    // Fetch both rate cards
    const [rateCard1, rateCard2] = await Promise.all([
      prisma.rateCardEntry.findUnique({
        where: { id: rateCard1Id },
        select: {
          roleStandardized: true,
          roleCategory: true,
          seniority: true,
          country: true,
          region: true,
          dailyRateUSD: true,
          supplierTier: true,
          lineOfService: true,
          supplierName: true,
        },
      }),
      prisma.rateCardEntry.findUnique({
        where: { id: rateCard2Id },
        select: {
          roleStandardized: true,
          roleCategory: true,
          seniority: true,
          country: true,
          region: true,
          dailyRateUSD: true,
          supplierTier: true,
          lineOfService: true,
          supplierName: true,
        },
      }),
    ]);

    if (!rateCard1 || !rateCard2) {
      throw new Error('One or both rate cards not found');
    }

    // Calculate dimension scores
    const dimensionScores = {
      role: this.calculateRoleSimilarity(
        rateCard1.roleStandardized,
        rateCard2.roleStandardized,
        rateCard1.roleCategory,
        rateCard2.roleCategory
      ),
      seniority: this.calculateSenioritySimilarity(rateCard1.seniority, rateCard2.seniority),
      geography: this.calculateGeographySimilarity(
        rateCard1.country,
        rateCard2.country,
        rateCard1.region,
        rateCard2.region
      ),
      rate: this.calculateRateSimilarity(
        parseFloat(rateCard1.dailyRateUSD.toString()),
        parseFloat(rateCard2.dailyRateUSD.toString())
      ),
      supplier: this.calculateSupplierSimilarity(
        rateCard1.supplierTier,
        rateCard2.supplierTier
      ),
      lineOfService: this.calculateLineOfServiceSimilarity(
        rateCard1.lineOfService,
        rateCard2.lineOfService
      ),
    };

    // Calculate weighted overall score
    const overallScore =
      dimensionScores.role * effectiveWeights.role +
      dimensionScores.seniority * effectiveWeights.seniority +
      dimensionScores.geography * effectiveWeights.geography +
      dimensionScores.rate * effectiveWeights.rate +
      dimensionScores.supplier * effectiveWeights.supplier +
      dimensionScores.lineOfService * effectiveWeights.lineOfService;

    const explanation = this.generateExplanation(dimensionScores, overallScore);

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      dimensionScores,
      explanation,
    };
  }

  /**
   * Calculate pairwise similarities for a set of rate cards
   */
  async calculatePairwiseSimilarities(
    rateCardIds: string[],
    minSimilarityThreshold: number = 0.5
  ): Promise<PairwiseSimilarity[]> {
    const similarities: PairwiseSimilarity[] = [];

    // Fetch all rate cards at once
    const rateCards = await prisma.rateCardEntry.findMany({
      where: { id: { in: rateCardIds } },
      select: {
        id: true,
        roleStandardized: true,
        roleCategory: true,
        seniority: true,
        country: true,
        region: true,
        dailyRateUSD: true,
        supplierTier: true,
        lineOfService: true,
      },
    });

    const rateCardMap = new Map(rateCards.map((rc) => [rc.id, rc]));

    // Calculate pairwise similarities
    for (let i = 0; i < rateCardIds.length; i++) {
      for (let j = i + 1; j < rateCardIds.length; j++) {
        const rc1 = rateCardMap.get(rateCardIds[i]);
        const rc2 = rateCardMap.get(rateCardIds[j]);

        if (!rc1 || !rc2) continue;

        const dimensionScores = {
          role: this.calculateRoleSimilarity(
            rc1.roleStandardized,
            rc2.roleStandardized,
            rc1.roleCategory,
            rc2.roleCategory
          ),
          seniority: this.calculateSenioritySimilarity(rc1.seniority, rc2.seniority),
          geography: this.calculateGeographySimilarity(
            rc1.country,
            rc2.country,
            rc1.region,
            rc2.region
          ),
          rate: this.calculateRateSimilarity(
            parseFloat(rc1.dailyRateUSD.toString()),
            parseFloat(rc2.dailyRateUSD.toString())
          ),
          supplier: this.calculateSupplierSimilarity(rc1.supplierTier, rc2.supplierTier),
          lineOfService: this.calculateLineOfServiceSimilarity(
            rc1.lineOfService,
            rc2.lineOfService
          ),
        };

        const overallScore =
          dimensionScores.role * this.defaultWeights.role +
          dimensionScores.seniority * this.defaultWeights.seniority +
          dimensionScores.geography * this.defaultWeights.geography +
          dimensionScores.rate * this.defaultWeights.rate +
          dimensionScores.supplier * this.defaultWeights.supplier +
          dimensionScores.lineOfService * this.defaultWeights.lineOfService;

        if (overallScore >= minSimilarityThreshold) {
          similarities.push({
            rateCard1Id: rateCardIds[i],
            rateCard2Id: rateCardIds[j],
            similarityScore: Math.round(overallScore * 100) / 100,
            dimensionScores,
          });
        }
      }
    }

    return similarities.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  /**
   * Find similar rate cards for a given rate card
   */
  async findSimilarRateCards(
    rateCardId: string,
    tenantId: string,
    limit: number = 10,
    minSimilarity: number = 0.6
  ): Promise<Array<{ rateCardId: string; similarity: SimilarityScore }>> {
    // Get the target rate card
    const targetRateCard = await prisma.rateCardEntry.findUnique({
      where: { id: rateCardId },
      select: {
        roleStandardized: true,
        roleCategory: true,
        seniority: true,
        country: true,
        region: true,
        lineOfService: true,
      },
    });

    if (!targetRateCard) {
      throw new Error('Rate card not found');
    }

    // Find candidate rate cards (same role category and line of service)
    const candidates = await prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        id: { not: rateCardId },
        roleCategory: targetRateCard.roleCategory,
        lineOfService: targetRateCard.lineOfService,
        dataQuality: { in: ['HIGH', 'MEDIUM'] },
      },
      select: { id: true },
      take: 100, // Limit candidates for performance
    });

    // Calculate similarities
    const similarities = await Promise.all(
      candidates.map(async (candidate) => {
        const similarity = await this.calculateSimilarity(rateCardId, candidate.id);
        return {
          rateCardId: candidate.id,
          similarity,
        };
      })
    );

    // Filter and sort by similarity
    return similarities
      .filter((s) => s.similarity.overallScore >= minSimilarity * 100)
      .sort((a, b) => b.similarity.overallScore - a.similarity.overallScore)
      .slice(0, limit);
  }

  /**
   * Calculate role similarity (0-1)
   */
  private calculateRoleSimilarity(
    role1: string,
    role2: string,
    category1: string,
    category2: string
  ): number {
    // Exact match
    if (role1 === role2) return 1.0;

    // Same category
    if (category1 === category2) return 0.7;

    // Use Levenshtein distance for partial matching
    const distance = this.levenshteinDistance(role1.toLowerCase(), role2.toLowerCase());
    const maxLength = Math.max(role1.length, role2.length);
    const similarity = 1 - distance / maxLength;

    return Math.max(similarity, 0);
  }

  /**
   * Calculate seniority similarity (0-1)
   */
  private calculateSenioritySimilarity(seniority1: string, seniority2: string): number {
    if (seniority1 === seniority2) return 1.0;

    const seniorityOrder = ['JUNIOR', 'MID', 'SENIOR', 'PRINCIPAL', 'PARTNER'];
    const idx1 = seniorityOrder.indexOf(seniority1);
    const idx2 = seniorityOrder.indexOf(seniority2);

    if (idx1 === -1 || idx2 === -1) return 0.5;

    const distance = Math.abs(idx1 - idx2);
    return Math.max(1 - distance * 0.25, 0);
  }

  /**
   * Calculate geography similarity (0-1)
   */
  private calculateGeographySimilarity(
    country1: string,
    country2: string,
    region1: string,
    region2: string
  ): number {
    // Same country
    if (country1 === country2) return 1.0;

    // Same region
    if (region1 === region2) return 0.6;

    // Different region
    return 0.2;
  }

  /**
   * Calculate rate similarity (0-1)
   */
  private calculateRateSimilarity(rate1: number, rate2: number): number {
    const avgRate = (rate1 + rate2) / 2;
    const difference = Math.abs(rate1 - rate2);
    const percentDifference = difference / avgRate;

    // Similarity decreases as percentage difference increases
    // 0% diff = 1.0, 10% diff = 0.9, 20% diff = 0.8, etc.
    return Math.max(1 - percentDifference, 0);
  }

  /**
   * Calculate supplier similarity (0-1)
   */
  private calculateSupplierSimilarity(tier1: string, tier2: string): number {
    if (tier1 === tier2) return 1.0;

    const tierOrder = ['OFFSHORE', 'BOUTIQUE', 'TIER_2', 'BIG_4'];
    const idx1 = tierOrder.indexOf(tier1);
    const idx2 = tierOrder.indexOf(tier2);

    if (idx1 === -1 || idx2 === -1) return 0.5;

    const distance = Math.abs(idx1 - idx2);
    return Math.max(1 - distance * 0.3, 0);
  }

  /**
   * Calculate line of service similarity (0-1)
   */
  private calculateLineOfServiceSimilarity(los1: string, los2: string): number {
    if (los1 === los2) return 1.0;

    // Use string similarity for partial matches
    const distance = this.levenshteinDistance(los1.toLowerCase(), los2.toLowerCase());
    const maxLength = Math.max(los1.length, los2.length);
    const similarity = 1 - distance / maxLength;

    return Math.max(similarity, 0);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Generate explanation for similarity score
   */
  private generateExplanation(
    dimensionScores: Record<string, number>,
    overallScore: number
  ): string {
    const scorePercent = Math.round(overallScore * 100);

    if (scorePercent >= 90) {
      return 'Very high similarity - these rate cards are nearly identical';
    } else if (scorePercent >= 75) {
      return 'High similarity - strong consolidation candidate';
    } else if (scorePercent >= 60) {
      return 'Moderate similarity - potential consolidation opportunity';
    } else if (scorePercent >= 40) {
      return 'Low similarity - limited consolidation potential';
    } else {
      return 'Very low similarity - not recommended for consolidation';
    }
  }
}

export const similarityCalculatorService = new SimilarityCalculatorService();
