import { Prisma, RoleRate, SeniorityLevel, DataQualityLevel } from '@prisma/client';
import { AbstractRepository, QueryOptions } from './base.repository';
import { DatabaseManager } from '../../index';

export type RoleRateCreateInput = Prisma.RoleRateCreateInput;
export type RoleRateUpdateInput = Prisma.RoleRateUpdateInput;
export type RoleRateWhereInput = Prisma.RoleRateWhereInput;

export interface RoleRateFilters {
  rateCardId?: string;
  standardizedRole?: string | string[];
  seniorityLevel?: SeniorityLevel | SeniorityLevel[];
  country?: string | string[];
  serviceLine?: string | string[];
  minRate?: number;
  maxRate?: number;
  dataQuality?: DataQualityLevel | DataQualityLevel[];
}

export class RoleRateRepository extends AbstractRepository<
  RoleRate,
  RoleRateCreateInput,
  RoleRateUpdateInput,
  RoleRateWhereInput
> {
  protected modelName = 'roleRate';

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  /**
   * Find role rates with filters
   */
  async findWithFilters(
    filters: RoleRateFilters,
    options?: QueryOptions
  ): Promise<RoleRate[]> {
    const where: RoleRateWhereInput = {
      ...(filters.rateCardId && { rateCardId: filters.rateCardId }),
      ...(filters.standardizedRole && {
        standardizedRole: Array.isArray(filters.standardizedRole)
          ? { in: filters.standardizedRole }
          : filters.standardizedRole
      }),
      ...(filters.seniorityLevel && {
        seniorityLevel: Array.isArray(filters.seniorityLevel)
          ? { in: filters.seniorityLevel }
          : filters.seniorityLevel
      }),
      ...(filters.country && {
        country: Array.isArray(filters.country)
          ? { in: filters.country }
          : filters.country
      }),
      ...(filters.serviceLine && {
        serviceLine: Array.isArray(filters.serviceLine)
          ? { in: filters.serviceLine }
          : filters.serviceLine
      }),
      ...(filters.minRate || filters.maxRate ? {
        dailyRate: {
          ...(filters.minRate && { gte: filters.minRate }),
          ...(filters.maxRate && { lte: filters.maxRate }),
        }
      } : {}),
      ...(filters.dataQuality && {
        dataQuality: Array.isArray(filters.dataQuality)
          ? { in: filters.dataQuality }
          : filters.dataQuality
      }),
    };

    return this.findMany(where, options);
  }

  /**
   * Find rates by rate card
   */
  async findByRateCard(
    rateCardId: string,
    options?: QueryOptions
  ): Promise<RoleRate[]> {
    return this.findMany(
      { rateCardId },
      {
        ...options,
        orderBy: { standardizedRole: 'asc' },
      }
    );
  }

  /**
   * Find rates for benchmarking
   */
  async findForBenchmarking(
    role: string,
    seniorityLevel?: SeniorityLevel,
    country?: string,
    serviceLine?: string
  ): Promise<RoleRate[]> {
    return this.findMany(
      {
        standardizedRole: role,
        ...(seniorityLevel && { seniorityLevel }),
        ...(country && { country }),
        ...(serviceLine && { serviceLine }),
        dataQuality: { in: ['HIGH', 'MEDIUM'] },
      },
      {
        include: {
          rateCard: {
            select: {
              supplierId: true,
              supplierName: true,
              supplierTier: true,
              effectiveDate: true,
            },
          },
        },
      }
    );
  }

  /**
   * Get rate statistics for a role
   */
  async getRoleStatistics(
    role: string,
    filters?: {
      seniorityLevel?: SeniorityLevel;
      country?: string;
      serviceLine?: string;
    }
  ) {
    const rates = await this.findMany({
      standardizedRole: role,
      ...(filters?.seniorityLevel && { seniorityLevel: filters.seniorityLevel }),
      ...(filters?.country && { country: filters.country }),
      ...(filters?.serviceLine && { serviceLine: filters.serviceLine }),
      dataQuality: { in: ['HIGH', 'MEDIUM'] },
    });

    if (rates.length === 0) {
      return null;
    }

    const dailyRates = rates.map(r => Number(r.dailyRate)).sort((a, b) => a - b);
    const count = dailyRates.length;

    return {
      count,
      min: dailyRates[0],
      max: dailyRates[count - 1],
      mean: dailyRates.reduce((sum, rate) => sum + rate, 0) / count,
      median: count % 2 === 0
        ? (dailyRates[count / 2 - 1] + dailyRates[count / 2]) / 2
        : dailyRates[Math.floor(count / 2)],
      p25: dailyRates[Math.floor(count * 0.25)],
      p75: dailyRates[Math.floor(count * 0.75)],
      p90: dailyRates[Math.floor(count * 0.90)],
    };
  }

  /**
   * Find unique roles
   */
  async findUniqueRoles(filters?: {
    country?: string;
    serviceLine?: string;
  }): Promise<string[]> {
    const roles = await this.prisma.roleRate.findMany({
      where: {
        ...(filters?.country && { country: filters.country }),
        ...(filters?.serviceLine && { serviceLine: filters.serviceLine }),
      },
      select: { standardizedRole: true },
      distinct: ['standardizedRole'],
      orderBy: { standardizedRole: 'asc' },
    });

    return roles.map(r => r.standardizedRole);
  }

  /**
   * Find unique countries
   */
  async findUniqueCountries(): Promise<string[]> {
    const countries = await this.prisma.roleRate.findMany({
      select: { country: true },
      distinct: ['country'],
      orderBy: { country: 'asc' },
    });

    return countries.map(c => c.country);
  }

  /**
   * Find unique service lines
   */
  async findUniqueServiceLines(): Promise<string[]> {
    const serviceLines = await this.prisma.roleRate.findMany({
      select: { serviceLine: true },
      distinct: ['serviceLine'],
      orderBy: { serviceLine: 'asc' },
    });

    return serviceLines.map(s => s.serviceLine);
  }

  /**
   * Bulk create role rates
   */
  async bulkCreate(rates: RoleRateCreateInput[]): Promise<number> {
    const result = await this.prisma.roleRate.createMany({
      data: rates as any,
      skipDuplicates: true,
    });

    return result.count;
  }

  /**
   * Find rates with quality issues
   */
  async findWithQualityIssues(
    rateCardId?: string,
    minSeverity: DataQualityLevel = 'LOW'
  ): Promise<RoleRate[]> {
    const qualityLevels: DataQualityLevel[] = 
      minSeverity === 'HIGH' ? ['HIGH'] :
      minSeverity === 'MEDIUM' ? ['HIGH', 'MEDIUM'] :
      ['HIGH', 'MEDIUM', 'LOW'];

    return this.findMany(
      {
        ...(rateCardId && { rateCardId }),
        dataQuality: { notIn: qualityLevels },
      },
      {
        orderBy: { confidence: 'asc' },
      }
    );
  }

  /**
   * Update data quality
   */
  async updateQuality(
    id: string,
    quality: {
      confidence: number;
      dataQuality: DataQualityLevel;
      issues?: string[];
      warnings?: string[];
    }
  ): Promise<RoleRate> {
    return this.update(id, quality);
  }
}
