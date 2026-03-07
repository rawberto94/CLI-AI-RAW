import { PrismaClient } from '@prisma/client';
import { DatabaseManager } from '../../index';

export interface BaseRepository<T, CreateInput, UpdateInput, WhereInput> {
  create(data: CreateInput): Promise<T>;
  findById(id: string): Promise<T | null>;
  findMany(where?: WhereInput, options?: QueryOptions): Promise<T[]>;
  update(id: string, data: UpdateInput): Promise<T>;
  delete(id: string): Promise<T>;
  count(where?: WhereInput): Promise<number>;
}

export interface QueryOptions {
  skip?: number;
  take?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
  include?: Record<string, boolean | object>;
}

export abstract class AbstractRepository<T, CreateInput, UpdateInput, WhereInput> 
  implements BaseRepository<T, CreateInput, UpdateInput, WhereInput> {
  
  protected prisma: PrismaClient;
  protected abstract modelName: string;

  constructor(databaseManager: DatabaseManager) {
    this.prisma = databaseManager.getClient();
  }

  protected get model() {
    return (this.prisma as any)[this.modelName];
  }

  async create(data: CreateInput): Promise<T> {
    return await this.model.create({ data });
  }

  async findById(id: string): Promise<T | null> {
    return await this.model.findUnique({ where: { id } });
  }

  async findMany(where?: WhereInput, options?: QueryOptions): Promise<T[]> {
    return await this.model.findMany({
      where,
      skip: options?.skip,
      take: options?.take,
      orderBy: options?.orderBy,
      include: options?.include,
    });
  }

  async update(id: string, data: UpdateInput): Promise<T> {
    return await this.model.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<T> {
    return await this.model.delete({ where: { id } });
  }

  async count(where?: WhereInput): Promise<number> {
    return await this.model.count({ where });
  }

  async findFirst(where?: WhereInput, options?: QueryOptions): Promise<T | null> {
    return await this.model.findFirst({
      where,
      orderBy: options?.orderBy,
      include: options?.include,
    });
  }

  async upsert(where: unknown, create: CreateInput, update: UpdateInput): Promise<T> {
    return await this.model.upsert({
      where,
      create,
      update,
    });
  }

  async exists(where: WhereInput): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }

  async findByIds(ids: string[]): Promise<T[]> {
    return await this.model.findMany({
      where: { id: { in: ids } },
    });
  }

  async deleteMany(where: WhereInput): Promise<{ count: number }> {
    return await this.model.deleteMany({ where });
  }

  async updateMany(where: WhereInput, data: Partial<UpdateInput>): Promise<{ count: number }> {
    return await this.model.updateMany({ where, data });
  }
}