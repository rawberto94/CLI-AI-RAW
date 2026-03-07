import { User, UserStatus, Prisma } from '@prisma/client';
import { AbstractRepository } from './base.repository';
import { DatabaseManager } from '../../index';

export type UserCreateInput = Prisma.UserCreateInput;
export type UserUpdateInput = Prisma.UserUpdateInput;
export type UserWhereInput = Prisma.UserWhereInput;

export interface UserWithRoles extends User {
  roles?: Array<{
    role: {
      id: string;
      name: string;
      description?: string | null;
    };
  }>;
}

export class UserRepository extends AbstractRepository<
  User,
  UserCreateInput,
  UserUpdateInput,
  UserWhereInput
> {
  protected modelName = 'user';

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findByEmailWithRoles(email: string): Promise<UserWithRoles | null> {
    return await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });
  }

  async findByTenant(tenantId: string, options?: {
    status?: UserStatus[];
    limit?: number;
    offset?: number;
  }): Promise<User[]> {
    const where: Prisma.UserWhereInput = { tenantId };
    
    if ((options?.status) != null) {
      where.status = { in: options.status };
    }

    return await this.prisma.user.findMany({
      where,
      take: options?.limit,
      skip: options?.offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  async updateLastLogin(id: string): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async verifyEmail(id: string): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data: { emailVerified: true },
    });
  }

  async updatePassword(id: string, passwordHash: string): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.create({
      data: {
        userId,
        roleId,
      },
    });
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });

    return userRoles.map(ur => ur.role.name);
  }

  async searchUsers(tenantId: string, query: string, limit = 10): Promise<User[]> {
    return await this.prisma.user.findMany({
      where: {
        tenantId,
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUsersByRole(tenantId: string, roleName: string): Promise<User[]> {
    return await this.prisma.user.findMany({
      where: {
        tenantId,
        roles: {
          some: {
            role: {
              name: roleName,
            },
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async getActiveUsers(tenantId: string): Promise<User[]> {
    return await this.prisma.user.findMany({
      where: {
        tenantId,
        status: UserStatus.ACTIVE,
      },
      orderBy: { lastLoginAt: 'desc' },
    });
  }

  async getUserStats(tenantId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    recentLogins: number;
  }> {
    const [total, active, inactive, suspended, recentLogins] = await Promise.all([
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.user.count({ where: { tenantId, status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { tenantId, status: UserStatus.INACTIVE } }),
      this.prisma.user.count({ where: { tenantId, status: UserStatus.SUSPENDED } }),
      this.prisma.user.count({
        where: {
          tenantId,
          lastLoginAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ]);

    return {
      total,
      active,
      inactive,
      suspended,
      recentLogins,
    };
  }
}