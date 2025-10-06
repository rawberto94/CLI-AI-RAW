import { Party, PartyType, Prisma } from '@prisma/client';
import { AbstractRepository } from './base.repository';
import { DatabaseManager } from '../../index';

export type PartyCreateInput = Prisma.PartyCreateInput;
export type PartyUpdateInput = Prisma.PartyUpdateInput;
export type PartyWhereInput = Prisma.PartyWhereInput;

export class PartyRepository extends AbstractRepository<
  Party,
  PartyCreateInput,
  PartyUpdateInput,
  PartyWhereInput
> {
  protected modelName = 'party';

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  /**
   * Find party by name and type
   */
  async findByNameAndType(name: string, type: PartyType): Promise<Party | null> {
    return await this.prisma.party.findUnique({
      where: {
        name_type: {
          name,
          type,
        },
      },
    });
  }

  /**
   * Find or create party
   */
  async findOrCreate(
    name: string,
    type: PartyType,
    data?: {
      email?: string;
      phone?: string;
      address?: any;
    }
  ): Promise<Party> {
    const existing = await this.findByNameAndType(name, type);
    if (existing) {
      return existing;
    }

    return await this.prisma.party.create({
      data: {
        name,
        type,
        email: data?.email,
        phone: data?.phone,
        address: data?.address,
      },
    });
  }

  /**
   * Find parties by type
   */
  async findByType(type: PartyType): Promise<Party[]> {
    return await this.prisma.party.findMany({
      where: { type },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Search parties by name
   */
  async searchByName(query: string, type?: PartyType): Promise<Party[]> {
    return await this.prisma.party.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
        type,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get party with contract counts
   */
  async getWithContractCounts(id: string): Promise<Party & {
    clientContractCount: number;
    supplierContractCount: number;
  }> {
    const party = await this.prisma.party.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            clientContracts: true,
            supplierContracts: true,
          },
        },
      },
    });

    if (!party) {
      throw new Error(`Party ${id} not found`);
    }

    return {
      ...party,
      clientContractCount: party._count.clientContracts,
      supplierContractCount: party._count.supplierContracts,
    };
  }

  /**
   * Get all clients
   */
  async getClients(): Promise<Party[]> {
    return await this.findByType(PartyType.CLIENT);
  }

  /**
   * Get all suppliers
   */
  async getSuppliers(): Promise<Party[]> {
    return await this.findByType(PartyType.SUPPLIER);
  }

  /**
   * Update party contact information
   */
  async updateContactInfo(
    id: string,
    data: {
      email?: string;
      phone?: string;
      address?: any;
    }
  ): Promise<Party> {
    return await this.prisma.party.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Merge duplicate parties
   */
  async mergeDuplicates(
    keepId: string,
    mergeIds: string[]
  ): Promise<Party> {
    return await this.prisma.$transaction(async (tx) => {
      // Update all contracts to point to the kept party
      await tx.contract.updateMany({
        where: {
          OR: [
            { clientId: { in: mergeIds } },
            { supplierId: { in: mergeIds } },
          ],
        },
        data: {
          clientId: keepId,
          supplierId: keepId,
        },
      });

      // Delete the merged parties
      await tx.party.deleteMany({
        where: {
          id: { in: mergeIds },
        },
      });

      // Return the kept party
      const party = await tx.party.findUnique({
        where: { id: keepId },
      });

      if (!party) {
        throw new Error(`Party ${keepId} not found`);
      }

      return party;
    });
  }
}
