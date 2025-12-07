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
      this.prisma.contract.count({ where: { tenantId, status: { not: 'DELETED' } } }),
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
}