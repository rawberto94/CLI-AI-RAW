import { Tenant, TenantStatus, Prisma } from '@prisma/client';
import { AbstractRepository } from './base.repository';
import { DatabaseManager } from '../../index';

export type TenantCreateInput = Prisma.TenantCreateInput;
export type TenantUpdateInput = Prisma.TenantUpdateInput;
export type TenantWhereInput = Prisma.TenantWhereInput;

export interface TenantWithRelations extends Tenant {
  configuration?: any;
  subscription?: any;
  usage?: unknown;
  _count?: {
    contracts?: number;
    users?: number;
  };
}

export class TenantRepository extends AbstractRepository<
  Tenant,
  TenantCreateInput,
  TenantUpdateInput,
  TenantWhereInput
> {
  protected modelName = 'tenant';

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return await this.prisma.tenant.findUnique({
      where: { slug },
    });
  }

  async findWithConfiguration(id: string): Promise<TenantWithRelations | null> {
    return await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        configuration: true,
        subscription: true,
        usage: true,
        _count: {
          select: {
            contracts: true,
            users: true,
          },
        },
      },
    });
  }

  async findActiveTenantsWithUsage(): Promise<TenantWithRelations[]> {
    return await this.prisma.tenant.findMany({
      where: { status: TenantStatus.ACTIVE },
      include: {
        usage: true,
        subscription: true,
      },
    });
  }

  async updateStatus(id: string, status: TenantStatus): Promise<Tenant> {
    return await this.prisma.tenant.update({
      where: { id },
      data: { status },
    });
  }

  async findByName(name: string): Promise<Tenant | null> {
    return await this.prisma.tenant.findUnique({
      where: { name },
    });
  }

  async searchTenants(query: string, limit = 10): Promise<Tenant[]> {
    return await this.prisma.tenant.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { slug: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { name: 'asc' },
    });
  }

  async getTenantStats(tenantId: string): Promise<{
    totalContracts: number;
    activeUsers: number;
    storageUsed: bigint;
    monthlyProcessed: number;
  }> {
    const [contractCount, userCount, usage] = await Promise.all([
      this.prisma.contract.count({ where: { tenantId, isDeleted: false } }),
      this.prisma.user.count({ 
        where: { 
          tenantId, 
          status: 'ACTIVE' 
        } 
      }),
      this.prisma.tenantUsage.findUnique({ where: { tenantId } }),
    ]);

    return {
      totalContracts: contractCount,
      activeUsers: userCount,
      storageUsed: usage?.storageUsed || BigInt(0),
      monthlyProcessed: usage?.contractsProcessed || 0,
    };
  }

  /**
   * Get tenant extraction settings with defaults
   */
  async getExtractionSettings(tenantId: string): Promise<TenantExtractionSettings> {
    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId },
    });

    const defaults: TenantExtractionSettings = {
      contractTypeConfidenceThreshold: 0.75,
      autoApplyContractType: true,
      gapFillingCompletenessThreshold: 0.85,
      alwaysRunGapFilling: false,
      aggressiveGapFilling: true,
      ocrProvider: 'openai',
      preferredModel: 'gpt-4o-mini',
    };

    if (!config?.extractionSettings) {
      return defaults;
    }

    // Merge with defaults to ensure all fields exist
    const settings = config.extractionSettings as Record<string, unknown>;
    return {
      contractTypeConfidenceThreshold: (settings.contractTypeConfidenceThreshold as number) ?? defaults.contractTypeConfidenceThreshold,
      autoApplyContractType: (settings.autoApplyContractType as boolean) ?? defaults.autoApplyContractType,
      gapFillingCompletenessThreshold: (settings.gapFillingCompletenessThreshold as number) ?? defaults.gapFillingCompletenessThreshold,
      alwaysRunGapFilling: (settings.alwaysRunGapFilling as boolean) ?? defaults.alwaysRunGapFilling,
      aggressiveGapFilling: (settings.aggressiveGapFilling as boolean) ?? defaults.aggressiveGapFilling,
      ocrProvider: (settings.ocrProvider as string) ?? defaults.ocrProvider,
      preferredModel: (settings.preferredModel as string) ?? defaults.preferredModel,
    };
  }

  /**
   * Update tenant extraction settings
   */
  async updateExtractionSettings(tenantId: string, settings: Partial<TenantExtractionSettings>): Promise<void> {
    const existing = await this.getExtractionSettings(tenantId);
    const updated = { ...existing, ...settings };

    await this.prisma.tenantConfig.upsert({
      where: { tenantId },
      update: { extractionSettings: updated },
      create: {
        tenantId,
        extractionSettings: updated,
      },
    });
  }
}

/**
 * Tenant extraction settings interface
 */
export interface TenantExtractionSettings {
  /** Minimum confidence for auto-applying detected contract type (0.0-1.0) */
  contractTypeConfidenceThreshold: number;
  /** Whether to automatically apply detected contract type */
  autoApplyContractType: boolean;
  /** Minimum completeness to skip gap filling (0.0-1.0) */
  gapFillingCompletenessThreshold: number;
  /** Whether to always run gap filling regardless of completeness */
  alwaysRunGapFilling: boolean;
  /** Enable aggressive gap filling with lower confidence thresholds */
  aggressiveGapFilling: boolean;
  /** Preferred OCR provider: 'openai' | 'mistral' */
  ocrProvider: string;
  /** Preferred AI model for extraction */
  preferredModel: string;
}