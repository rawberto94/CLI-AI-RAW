import { PrismaClient, SeniorityLevel } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

interface SupplierBenchmarkInput {
  supplierId: string;
  tenantId: string;
  periodMonths?: number;
}

interface SupplierPerformanceMetrics {
  supplierId: string;
  supplierName: string;
  averageRate: number;
  medianRate: number;
  marketAverage: number;
  competitivenessScore: number;
  totalRoles: number;
  totalContracts: number;
  geographicCoverage: {
    countries: string[];
    regions: string[];
    coverageScore: number;
  };
  serviceLineCoverage: {
    linesOfService: string[];
    diversityScore: number;
  };
  rateStability: {
    averageChange: number;
    volatilityScore: number;
  };
  dataQualityScore: number;
  totalAnnualValue: number;
  potentialSavings: number;
  costRank?: number;
  qualityRank?: number;
  overallRank?: number;
}

export class SupplierBenchmarkService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calculate comprehensive benchmark for a supplier
   */
  async calculateSupplierBenchmark(
    input: SupplierBenchmarkInput
  ): Promise<SupplierPerformanceMetrics> {
    const { supplierId, tenantId, periodMonths = 12 } = input;

    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - periodMonths);
    const periodEnd = new Date();

    // Get supplier info
    const supplier = await this.prisma.rateCardSupplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new Error(`Supplier not found: ${supplierId}`);
    }

    // Get all rate cards for this supplier in the period
    const supplierRates = await this.prisma.rateCardEntry.findMany({
      where: {
        supplierId,
        tenantId,
        effectiveDate: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      orderBy: {
        effectiveDate: 'asc',
      },
    });

    if (supplierRates.length === 0) {
      throw new Error(`No rate data found for supplier: ${supplier.name}`);
    }

    // Calculate average and median rates
    const rates = supplierRates.map((r) => Number(r.dailyRateUSD));
    const averageRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    const sortedRates = [...rates].sort((a, b) => a - b);
    const medianRate =
      sortedRates.length % 2 === 0
        ? (sortedRates[sortedRates.length / 2 - 1] +
            sortedRates[sortedRates.length / 2]) /
          2
        : sortedRates[Math.floor(sortedRates.length / 2)];

    // Get market average for comparison
    const marketRates = await this.prisma.rateCardEntry.findMany({
      where: {
        tenantId,
        effectiveDate: {
          gte: periodStart,
          lte: periodEnd,
        },
        supplierId: {
          not: supplierId,
        },
      },
      select: {
        dailyRateUSD: true,
      },
    });

    const marketAverage =
      marketRates.length > 0
        ? marketRates.reduce((sum, r) => sum + Number(r.dailyRateUSD), 0) /
          marketRates.length
        : averageRate;

    // Calculate competitiveness score (0-100)
    // Lower rates = higher score
    const competitivenessScore = Math.max(
      0,
      Math.min(100, ((marketAverage - averageRate) / marketAverage) * 100 + 50)
    );

    // Calculate geographic coverage
    const countries = [...new Set(supplierRates.map((r) => r.country))];
    const regions = [...new Set(supplierRates.map((r) => r.region))];
    const coverageScore = Math.min(100, (countries.length / 10) * 100);

    // Calculate service line coverage
    const linesOfService = [
      ...new Set(supplierRates.map((r) => r.lineOfService)),
    ];
    const diversityScore = Math.min(100, (linesOfService.length / 5) * 100);

    // Calculate rate stability
    const rateChanges: number[] = [];
    for (let i = 1; i < supplierRates.length; i++) {
      const prevRate = Number(supplierRates[i - 1].dailyRateUSD);
      const currRate = Number(supplierRates[i].dailyRateUSD);
      if (prevRate > 0) {
        rateChanges.push(((currRate - prevRate) / prevRate) * 100);
      }
    }

    const averageChange =
      rateChanges.length > 0
        ? rateChanges.reduce((a, b) => a + b, 0) / rateChanges.length
        : 0;

    const volatility =
      rateChanges.length > 0
        ? Math.sqrt(
            rateChanges
              .map((x) => Math.pow(x - averageChange, 2))
              .reduce((a, b) => a + b, 0) / rateChanges.length
          )
        : 0;

    const volatilityScore = Math.max(0, 100 - volatility * 10);

    // Calculate data quality score
    const qualityFactors = supplierRates.map((r) => {
      let score = 0;
      if (r.roleStandardized) score += 25;
      if (r.confidence && Number(r.confidence) > 0.7) score += 25;
      if (r.validatedBy) score += 25;
      if (r.skills && Array.isArray(r.skills) && r.skills.length > 0)
        score += 25;
      return score;
    });

    const dataQualityScore =
      qualityFactors.reduce((a, b) => a + b, 0) / qualityFactors.length;

    // Calculate total annual value
    const totalAnnualValue = supplierRates.reduce((sum, r) => {
      const volume = r.volumeCommitted || 0;
      const rate = Number(r.dailyRateUSD);
      return sum + rate * volume;
    }, 0);

    // Calculate potential savings
    const potentialSavings = supplierRates.reduce((sum, r) => {
      const currentRate = Number(r.dailyRateUSD);
      const marketMedian = Number(r.marketRateMedian) || marketAverage;
      if (currentRate > marketMedian) {
        const volume = r.volumeCommitted || 0;
        return sum + (currentRate - marketMedian) * volume;
      }
      return sum;
    }, 0);

    // Get unique contracts
    const contractIds = new Set(
      supplierRates.filter((r) => r.contractId).map((r) => r.contractId!)
    );

    // Get unique roles
    const uniqueRoles = new Set(supplierRates.map((r) => r.roleStandardized));

    // Save benchmark snapshot
    await this.prisma.supplierBenchmark.create({
      data: {
        tenantId,
        supplierId,
        periodStart,
        periodEnd,
        averageRate: new Decimal(averageRate),
        medianRate: new Decimal(medianRate),
        marketAverage: new Decimal(marketAverage),
        competitivenessScore: new Decimal(competitivenessScore),
        totalRoles: uniqueRoles.size,
        totalContracts: contractIds.size,
        geographicCoverage: {
          countries,
          regions,
          coverageScore,
        },
        serviceLineCoverage: {
          linesOfService,
          diversityScore,
        },
        dataQualityScore: new Decimal(dataQualityScore),
        totalAnnualValue: new Decimal(totalAnnualValue),
        potentialSavings: new Decimal(potentialSavings),
      },
    });

    return {
      supplierId,
      supplierName: supplier.name,
      averageRate,
      medianRate,
      marketAverage,
      competitivenessScore,
      totalRoles: uniqueRoles.size,
      totalContracts: contractIds.size,
      geographicCoverage: {
        countries,
        regions,
        coverageScore,
      },
      serviceLineCoverage: {
        linesOfService,
        diversityScore,
      },
      rateStability: {
        averageChange,
        volatilityScore,
      },
      dataQualityScore,
      totalAnnualValue,
      potentialSavings,
    };
  }

  /**
   * Get latest benchmark for a supplier
   */
  async getLatestBenchmark(
    supplierId: string,
    tenantId: string
  ): Promise<SupplierPerformanceMetrics | null> {
    const benchmark = await this.prisma.supplierBenchmark.findFirst({
      where: {
        supplierId,
        tenantId,
      },
      orderBy: {
        calculatedAt: 'desc',
      },
      include: {
        supplier: true,
      },
    });

    if (!benchmark) {
      return null;
    }

    return {
      supplierId: benchmark.supplierId,
      supplierName: benchmark.supplier.name,
      averageRate: Number(benchmark.averageRate),
      medianRate: Number(benchmark.medianRate),
      marketAverage: Number(benchmark.marketAverage),
      competitivenessScore: Number(benchmark.competitivenessScore),
      totalRoles: benchmark.totalRoles,
      totalContracts: benchmark.totalContracts,
      geographicCoverage: benchmark.geographicCoverage as any,
      serviceLineCoverage: benchmark.serviceLineCoverage as any,
      rateStability: {
        averageChange: 0,
        volatilityScore: 0,
      },
      dataQualityScore: Number(benchmark.dataQualityScore),
      totalAnnualValue: Number(benchmark.totalAnnualValue),
      potentialSavings: Number(benchmark.potentialSavings),
      costRank: benchmark.costRank || undefined,
      qualityRank: benchmark.qualityRank || undefined,
      overallRank: benchmark.overallRank || undefined,
    };
  }

  /**
   * Rank all suppliers by competitiveness
   */
  async rankSuppliers(
    tenantId: string,
    periodMonths: number = 12
  ): Promise<SupplierPerformanceMetrics[]> {
    const periodStart = new Date();
    periodStart.setMonth(periodStart.getMonth() - periodMonths);

    // Get all suppliers with recent activity
    const suppliers = await this.prisma.rateCardSupplier.findMany({
      where: {
        tenantId,
        rateCardEntries: {
          some: {
            effectiveDate: {
              gte: periodStart,
            },
          },
        },
      },
    });

    // Calculate benchmarks for all suppliers
    const benchmarks: SupplierPerformanceMetrics[] = [];
    for (const supplier of suppliers) {
      try {
        const benchmark = await this.calculateSupplierBenchmark({
          supplierId: supplier.id,
          tenantId,
          periodMonths,
        });
        benchmarks.push(benchmark);
      } catch (error) {
        console.error(
          `Failed to calculate benchmark for supplier ${supplier.name}:`,
          error
        );
      }
    }

    // Rank by cost (lower is better)
    const sortedByCost = [...benchmarks].sort(
      (a, b) => a.averageRate - b.averageRate
    );
    sortedByCost.forEach((b, i) => {
      b.costRank = i + 1;
    });

    // Rank by quality (higher is better)
    const sortedByQuality = [...benchmarks].sort(
      (a, b) => b.dataQualityScore - a.dataQualityScore
    );
    sortedByQuality.forEach((b, i) => {
      b.qualityRank = i + 1;
    });

    // Calculate overall rank (weighted average)
    benchmarks.forEach((b) => {
      const costWeight = 0.6;
      const qualityWeight = 0.4;
      b.overallRank = Math.round(
        (b.costRank! * costWeight + b.qualityRank! * qualityWeight) * 100
      );
    });

    // Sort by overall rank
    benchmarks.sort((a, b) => a.overallRank! - b.overallRank!);

    // Update ranks in database
    for (const benchmark of benchmarks) {
      await this.prisma.supplierBenchmark.updateMany({
        where: {
          supplierId: benchmark.supplierId,
          tenantId,
        },
        data: {
          costRank: benchmark.costRank,
          qualityRank: benchmark.qualityRank,
          overallRank: benchmark.overallRank,
        },
      });
    }

    return benchmarks;
  }

  /**
   * Track supplier rate stability over time
   */
  async trackRateStability(
    supplierId: string,
    tenantId: string,
    months: number = 12
  ): Promise<{
    supplier: string;
    periods: Array<{
      month: string;
      averageRate: number;
      changePercent: number;
    }>;
    overallTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
    volatility: number;
  }> {
    const supplier = await this.prisma.rateCardSupplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new Error(`Supplier not found: ${supplierId}`);
    }

    const periods: Array<{
      month: string;
      averageRate: number;
      changePercent: number;
    }> = [];

    for (let i = months - 1; i >= 0; i--) {
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() - i);
      const periodStart = new Date(periodEnd);
      periodStart.setMonth(periodStart.getMonth() - 1);

      const rates = await this.prisma.rateCardEntry.findMany({
        where: {
          supplierId,
          tenantId,
          effectiveDate: {
            gte: periodStart,
            lt: periodEnd,
          },
        },
        select: {
          dailyRateUSD: true,
        },
      });

      if (rates.length > 0) {
        const avgRate =
          rates.reduce((sum, r) => sum + Number(r.dailyRateUSD), 0) /
          rates.length;

        const prevPeriod = periods[periods.length - 1];
        const changePercent = prevPeriod
          ? ((avgRate - prevPeriod.averageRate) / prevPeriod.averageRate) * 100
          : 0;

        periods.push({
          month: periodEnd.toISOString().substring(0, 7),
          averageRate: avgRate,
          changePercent,
        });
      }
    }

    // Calculate overall trend
    const changes = periods.slice(1).map((p) => p.changePercent);
    const avgChange =
      changes.length > 0
        ? changes.reduce((a, b) => a + b, 0) / changes.length
        : 0;

    let overallTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
    if (avgChange > 2) {
      overallTrend = 'INCREASING';
    } else if (avgChange < -2) {
      overallTrend = 'DECREASING';
    } else {
      overallTrend = 'STABLE';
    }

    // Calculate volatility
    const volatility =
      changes.length > 0
        ? Math.sqrt(
            changes
              .map((x) => Math.pow(x - avgChange, 2))
              .reduce((a, b) => a + b, 0) / changes.length
          )
        : 0;

    return {
      supplier: supplier.name,
      periods,
      overallTrend,
      volatility,
    };
  }

  /**
   * Identify best value suppliers by category
   */
  async findBestValueSuppliers(
    tenantId: string,
    criteria?: {
      roleCategory?: string;
      country?: string;
      lineOfService?: string;
    }
  ): Promise<
    Array<{
      supplierId: string;
      supplierName: string;
      category: string;
      averageRate: number;
      competitivenessScore: number;
      dataQualityScore: number;
      reason: string;
    }>
  > {
    const whereClause: any = {
      tenantId,
    };

    if (criteria?.roleCategory) {
      whereClause.roleCategory = criteria.roleCategory;
    }
    if (criteria?.country) {
      whereClause.country = criteria.country;
    }
    if (criteria?.lineOfService) {
      whereClause.lineOfService = criteria.lineOfService;
    }

    // Get all rate cards matching criteria
    const rates = await this.prisma.rateCardEntry.findMany({
      where: whereClause,
      include: {
        supplier: true,
      },
    });

    // Group by supplier
    const supplierGroups = new Map<string, typeof rates>();
    for (const rate of rates) {
      const existing = supplierGroups.get(rate.supplierId) || [];
      existing.push(rate);
      supplierGroups.set(rate.supplierId, existing);
    }

    // Calculate metrics for each supplier
    const results = Array.from(supplierGroups.entries()).map(
      ([supplierId, supplierRates]) => {
        const avgRate =
          supplierRates.reduce((sum, r) => sum + Number(r.dailyRateUSD), 0) /
          supplierRates.length;

        const qualityScore =
          supplierRates.reduce((sum, r) => sum + Number(r.confidence), 0) /
          supplierRates.length;

        // Calculate competitiveness (lower rate = higher score)
        const allRates = rates.map((r) => Number(r.dailyRateUSD));
        const marketAvg =
          allRates.reduce((a, b) => a + b, 0) / allRates.length;
        const competitiveness = Math.max(
          0,
          Math.min(100, ((marketAvg - avgRate) / marketAvg) * 100 + 50)
        );

        return {
          supplierId,
          supplierName: supplierRates[0].supplier.name,
          category: criteria?.roleCategory || 'All',
          averageRate: avgRate,
          competitivenessScore: competitiveness,
          dataQualityScore: qualityScore * 100,
          reason: this.generateBestValueReason(
            avgRate,
            marketAvg,
            competitiveness,
            qualityScore
          ),
        };
      }
    );

    // Sort by competitiveness score
    return results.sort(
      (a, b) => b.competitivenessScore - a.competitivenessScore
    );
  }

  private generateBestValueReason(
    avgRate: number,
    marketAvg: number,
    competitiveness: number,
    quality: number
  ): string {
    const priceDiff = ((marketAvg - avgRate) / marketAvg) * 100;

    if (competitiveness > 70 && quality > 0.8) {
      return `Excellent value: ${priceDiff.toFixed(1)}% below market average with high data quality`;
    } else if (competitiveness > 60) {
      return `Good value: ${priceDiff.toFixed(1)}% below market average`;
    } else if (quality > 0.8) {
      return `Reliable supplier with high data quality`;
    } else {
      return `Competitive rates with market average pricing`;
    }
  }
}
