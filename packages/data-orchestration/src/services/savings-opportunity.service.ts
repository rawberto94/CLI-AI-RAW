
import { PrismaClient, SavingsCategory, EffortLevel, RiskLevel, OpportunityStatus } from '@prisma/client';

interface DetectionOptions {
  minSavingsAmount?: number;
  minSavingsPercent?: number;
  categories?: SavingsCategory[];
  maxRisk?: RiskLevel;
}

interface OpportunityDetails {
  id: string;
  title: string;
  description: string;
  category: SavingsCategory;
  currentAnnualCost: number;
  projectedAnnualCost: number;
  annualSavings: number;
  savingsPercentage: number;
  effort: EffortLevel;
  risk: RiskLevel;
  confidence: number;
  recommendedAction: string;
  alternativeSuppliers?: any;
  negotiationPoints?: any;
  implementationTime?: string;
  status: OpportunityStatus;
  rateCardEntry: any;
  benchmarkData?: any;
}

export class SavingsOpportunityService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Detect all savings opportunities for a tenant
   */
  async detectOpportunities(
    tenantId: string,
    options: DetectionOptions = {}
  ): Promise<any[]> {
    const {
      minSavingsAmount = 0,
      minSavingsPercent = 0,
      categories,
      maxRisk,
    } = options;

    // Get all rate card entries with benchmark data
    const rateCards = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        lastBenchmarkedAt: { not: null },
      },
      include: {
        supplier: true,
        benchmarkSnapshots: {
          orderBy: { snapshotDate: 'desc' },
          take: 1,
        },
      },
    });

    const opportunities: any[] = [];

    for (const rateCard of rateCards) {
      const latestBenchmark = rateCard.benchmarkSnapshots[0];
      if (!latestBenchmark) continue;

      // Detect rate reduction opportunities (rates above 75th percentile)
      if (rateCard.percentileRank && rateCard.percentileRank >= 75) {
        const opportunity = await this.detectRateReductionOpportunity(
          rateCard,
          latestBenchmark,
          tenantId
        );
        if (opportunity) opportunities.push(opportunity);
      }

      // Detect volume discount opportunities
      if (rateCard.volumeCommitted && rateCard.volumeCommitted >= 10) {
        const opportunity = await this.detectVolumeDiscountOpportunity(
          rateCard,
          tenantId
        );
        if (opportunity) opportunities.push(opportunity);
      }

      // Detect geographic arbitrage opportunities
      const geoOpportunity = await this.detectGeographicArbitrageOpportunity(
        rateCard,
        tenantId
      );
      if (geoOpportunity) opportunities.push(geoOpportunity);

      // Detect supplier consolidation opportunities
      const consolidationOpp = await this.detectSupplierConsolidationOpportunity(
        rateCard,
        tenantId
      );
      if (consolidationOpp) opportunities.push(consolidationOpp);
    }

    // Filter by options
    let filtered = opportunities.filter(
      (opp) =>
        opp.annualSavings >= minSavingsAmount &&
        opp.savingsPercentage >= minSavingsPercent
    );

    if (categories && categories.length > 0) {
      filtered = filtered.filter((opp) => categories.includes(opp.category));
    }

    if (maxRisk) {
      const riskOrder = { LOW: 1, MEDIUM: 2, HIGH: 3 };
      filtered = filtered.filter(
        (opp) => riskOrder[opp.risk] <= riskOrder[maxRisk]
      );
    }

    return filtered;
  }

  /**
   * Detect rate reduction opportunity for rates above market
   */
  private async detectRateReductionOpportunity(
    rateCard: any,
    benchmark: any,
    tenantId: string
  ): Promise<any | null> {
    const savingsToMedian = parseFloat(rateCard.dailyRateUSD.toString()) - parseFloat(benchmark.median.toString());
    
    if (savingsToMedian <= 0) return null;

    const volumeCommitted = rateCard.volumeCommitted || 220; // Default 220 days/year
    const annualSavings = savingsToMedian * volumeCommitted;
    const savingsPercentage = (savingsToMedian / parseFloat(rateCard.dailyRateUSD.toString())) * 100;

    // Check if opportunity already exists
    const existing = await this.prisma.rateSavingsOpportunity.findFirst({
      where: {
        tenantId,
        rateCardEntryId: rateCard.id,
        category: 'RATE_REDUCTION',
        status: { in: ['IDENTIFIED', 'UNDER_REVIEW', 'APPROVED', 'IN_PROGRESS'] },
      },
    });

    if (existing) return null;

    return {
      tenantId,
      rateCardEntryId: rateCard.id,
      title: `Reduce ${rateCard.roleStandardized} rate with ${rateCard.supplierName}`,
      description: `Current rate of $${rateCard.dailyRateUSD}/day is at the ${rateCard.percentileRank}th percentile. Market median is $${benchmark.median}/day.`,
      category: 'RATE_REDUCTION' as SavingsCategory,
      currentAnnualCost: parseFloat(rateCard.dailyRateUSD.toString()) * volumeCommitted,
      projectedAnnualCost: parseFloat(benchmark.median.toString()) * volumeCommitted,
      annualSavings,
      savingsPercentage,
      effort: this.calculateEffort(savingsPercentage),
      risk: this.calculateRisk(rateCard, benchmark),
      confidence: this.calculateConfidence(benchmark.cohortSize),
      recommendedAction: `Negotiate rate reduction to market median of $${benchmark.median}/day`,
      alternativeSuppliers: await this.findAlternativeSuppliers(rateCard, tenantId),
      negotiationPoints: this.generateNegotiationPoints(rateCard, benchmark),
      implementationTime: '1-3 months',
      status: 'IDENTIFIED' as OpportunityStatus,
    };
  }

  /**
   * Detect volume discount opportunity
   */
  private async detectVolumeDiscountOpportunity(
    rateCard: any,
    tenantId: string
  ): Promise<any | null> {
    // Check if supplier offers volume discounts
    const supplier = await this.prisma.rateCardSupplier.findUnique({
      where: { id: rateCard.supplierId },
    });

    if (!supplier?.volumeDiscounts) return null;

    const volumeCommitted = rateCard.volumeCommitted || 220;
    const potentialDiscount = 0.05; // Assume 5% discount for volume
    const annualSavings = parseFloat(rateCard.dailyRateUSD.toString()) * volumeCommitted * potentialDiscount;

    return {
      tenantId,
      rateCardEntryId: rateCard.id,
      title: `Volume discount opportunity with ${rateCard.supplierName}`,
      description: `With ${volumeCommitted} days committed, negotiate volume discount`,
      category: 'VOLUME_DISCOUNT' as SavingsCategory,
      currentAnnualCost: parseFloat(rateCard.dailyRateUSD.toString()) * volumeCommitted,
      projectedAnnualCost: parseFloat(rateCard.dailyRateUSD.toString()) * volumeCommitted * (1 - potentialDiscount),
      annualSavings,
      savingsPercentage: potentialDiscount * 100,
      effort: 'LOW' as EffortLevel,
      risk: 'LOW' as RiskLevel,
      confidence: 0.7,
      recommendedAction: 'Negotiate volume discount based on committed days',
      implementationTime: '1-2 months',
      status: 'IDENTIFIED' as OpportunityStatus,
    };
  }

  /**
   * Detect geographic arbitrage opportunity
   */
  private async detectGeographicArbitrageOpportunity(
    rateCard: any,
    tenantId: string
  ): Promise<any | null> {
    // Find similar roles in lower-cost geographies
    const lowerCostRates = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        roleStandardized: rateCard.roleStandardized,
        seniority: rateCard.seniority,
        country: { not: rateCard.country },
        dailyRateUSD: { lt: rateCard.dailyRateUSD },
      },
      orderBy: { dailyRateUSD: 'asc' },
      take: 3,
    });

    if (lowerCostRates.length === 0) return null;

    const lowestRate = lowerCostRates[0];
    const savingsPerDay = parseFloat(rateCard.dailyRateUSD.toString()) - parseFloat(lowestRate.dailyRateUSD.toString());
    const volumeCommitted = rateCard.volumeCommitted || 220;
    const annualSavings = savingsPerDay * volumeCommitted;
    const savingsPercentage = (savingsPerDay / parseFloat(rateCard.dailyRateUSD.toString())) * 100;

    if (savingsPercentage < 15) return null; // Only flag if savings > 15%

    return {
      tenantId,
      rateCardEntryId: rateCard.id,
      title: `Geographic arbitrage: ${rateCard.roleStandardized} in ${lowestRate.country}`,
      description: `Similar role available in ${lowestRate.country} at $${lowestRate.dailyRateUSD}/day vs current $${rateCard.dailyRateUSD}/day in ${rateCard.country}`,
      category: 'GEOGRAPHIC_ARBITRAGE' as SavingsCategory,
      currentAnnualCost: parseFloat(rateCard.dailyRateUSD.toString()) * volumeCommitted,
      projectedAnnualCost: parseFloat(lowestRate.dailyRateUSD.toString()) * volumeCommitted,
      annualSavings,
      savingsPercentage,
      effort: 'MEDIUM' as EffortLevel,
      risk: 'MEDIUM' as RiskLevel,
      confidence: 0.65,
      recommendedAction: `Consider sourcing ${rateCard.roleStandardized} from ${lowestRate.country}`,
      alternativeSuppliers: lowerCostRates.map((r) => ({
        name: r.supplierName,
        country: r.country,
        rate: r.dailyRateUSD,
      })),
      implementationTime: '3-6 months',
      status: 'IDENTIFIED' as OpportunityStatus,
    };
  }

  /**
   * Detect supplier consolidation opportunity
   */
  private async detectSupplierConsolidationOpportunity(
    rateCard: any,
    tenantId: string
  ): Promise<any | null> {
    // Find if we have multiple suppliers for similar roles
    const similarRoles = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        roleStandardized: rateCard.roleStandardized,
        seniority: rateCard.seniority,
        supplierId: { not: rateCard.supplierId },
      },
      distinct: ['supplierId'],
    });

    if (similarRoles.length < 2) return null; // Need at least 2 other suppliers

    const totalVolume = rateCard.volumeCommitted || 220;
    const potentialDiscount = 0.08; // Assume 8% discount for consolidation
    const annualSavings = parseFloat(rateCard.dailyRateUSD.toString()) * totalVolume * potentialDiscount;

    return {
      tenantId,
      rateCardEntryId: rateCard.id,
      title: `Consolidate ${rateCard.roleStandardized} suppliers`,
      description: `Currently using ${similarRoles.length + 1} suppliers for ${rateCard.roleStandardized}. Consolidation could yield volume discounts.`,
      category: 'SUPPLIER_SWITCH' as SavingsCategory,
      currentAnnualCost: parseFloat(rateCard.dailyRateUSD.toString()) * totalVolume,
      projectedAnnualCost: parseFloat(rateCard.dailyRateUSD.toString()) * totalVolume * (1 - potentialDiscount),
      annualSavings,
      savingsPercentage: potentialDiscount * 100,
      effort: 'HIGH' as EffortLevel,
      risk: 'MEDIUM' as RiskLevel,
      confidence: 0.6,
      recommendedAction: 'Consolidate suppliers and negotiate volume discount',
      implementationTime: '6-12 months',
      status: 'IDENTIFIED' as OpportunityStatus,
    };
  }

  /**
   * Get opportunity details with full context
   */
  async getOpportunityDetails(opportunityId: string): Promise<OpportunityDetails | null> {
    const opportunity = await this.prisma.rateSavingsOpportunity.findUnique({
      where: { id: opportunityId },
      include: {
        rateCardEntry: {
          include: {
            supplier: true,
            benchmarkSnapshots: {
              orderBy: { snapshotDate: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!opportunity) return null;

    return {
      ...opportunity,
      currentAnnualCost: parseFloat(opportunity.currentAnnualCost.toString()),
      projectedAnnualCost: parseFloat(opportunity.projectedAnnualCost.toString()),
      annualSavings: parseFloat(opportunity.annualSavingsPotential.toString()),
      savingsPercentage: parseFloat(opportunity.savingsPercentage.toString()),
      confidence: parseFloat(opportunity.confidence.toString()),
      benchmarkData: opportunity.rateCardEntry.benchmarkSnapshots[0] || null,
    } as OpportunityDetails;
  }

  /**
   * Update opportunity status
   */
  async updateOpportunityStatus(
    opportunityId: string,
    status: OpportunityStatus,
    notes?: string,
    assignedTo?: string
  ): Promise<void> {
    await this.prisma.rateSavingsOpportunity.update({
      where: { id: opportunityId },
      data: {
        status,
        ...(assignedTo && { assignedTo }),
        ...(status === 'UNDER_REVIEW' && { reviewedAt: new Date() }),
        ...(status === 'IMPLEMENTED' && { implementedAt: new Date() }),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Track realized savings
   */
  async trackRealizedSavings(
    opportunityId: string,
    actualSavings: number
  ): Promise<void> {
    await this.prisma.rateSavingsOpportunity.update({
      where: { id: opportunityId },
      data: {
        actualSavingsRealized: actualSavings,
        status: 'IMPLEMENTED',
        implementedAt: new Date(),
      },
    });
  }

  /**
   * Create opportunities from detection results
   */
  async createOpportunities(opportunities: any[]): Promise<void> {
    for (const opp of opportunities) {
      await this.prisma.rateSavingsOpportunity.create({
        data: opp,
      });
    }
  }

  // Helper methods

  private calculateEffort(savingsPercentage: number): EffortLevel {
    if (savingsPercentage > 20) return 'HIGH';
    if (savingsPercentage > 10) return 'MEDIUM';
    return 'LOW';
  }

  private calculateRisk(rateCard: any, benchmark: any): RiskLevel {
    const cohortSize = benchmark.cohortSize;
    const percentileRank = rateCard.percentileRank;

    if (cohortSize < 5 || percentileRank < 80) return 'HIGH';
    if (cohortSize < 10 || percentileRank < 85) return 'MEDIUM';
    return 'LOW';
  }

  private calculateConfidence(cohortSize: number): number {
    if (cohortSize >= 20) return 0.9;
    if (cohortSize >= 10) return 0.75;
    if (cohortSize >= 5) return 0.6;
    return 0.4;
  }

  private async findAlternativeSuppliers(rateCard: any, tenantId: string): Promise<any[]> {
    const alternatives = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        roleStandardized: rateCard.roleStandardized,
        seniority: rateCard.seniority,
        country: rateCard.country,
        supplierId: { not: rateCard.supplierId },
        dailyRateUSD: { lt: rateCard.dailyRateUSD },
      },
      include: { supplier: true },
      orderBy: { dailyRateUSD: 'asc' },
      take: 3,
    });

    return alternatives.map((alt) => ({
      supplierId: alt.supplierId,
      supplierName: alt.supplierName,
      rate: parseFloat(alt.dailyRateUSD.toString()),
      savings: parseFloat(rateCard.dailyRateUSD.toString()) - parseFloat(alt.dailyRateUSD.toString()),
      tier: alt.supplierTier,
    }));
  }

  private generateNegotiationPoints(rateCard: any, benchmark: any): any[] {
    return [
      {
        point: `Current rate is at ${rateCard.percentileRank}th percentile`,
        data: `Market median: $${benchmark.median}/day`,
        priority: 1,
      },
      {
        point: `Market average is $${benchmark.average}/day`,
        data: `${benchmark.cohortSize} comparable rates in database`,
        priority: 2,
      },
      {
        point: `Top quartile rate is $${benchmark.percentile25}/day`,
        data: `Potential savings: $${parseFloat(rateCard.dailyRateUSD.toString()) - parseFloat(benchmark.percentile25.toString())}/day`,
        priority: 3,
      },
    ];
  }
}

// Export singleton placeholder
export const savingsOpportunityService = {
  detectOpportunities: async (...args: any[]) => { throw new Error('Service needs Prisma injection'); },
  getOpportunityDetails: async (...args: any[]) => { throw new Error('Service needs Prisma injection'); },
};
