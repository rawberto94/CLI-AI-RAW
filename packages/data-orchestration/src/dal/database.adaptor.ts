import { PrismaClient, Prisma } from "@prisma/client";
import pino from "pino";
import {
  Contract,
  ContractQuery,
  CreateContractDTO,
  Artifact,
  CreateArtifactDTO,
  ContractQueryResponse,
} from "../types";

const logger = pino({ name: "database-adaptor" });

// ============================================================================
// TYPE CONVERSION HELPERS
// ============================================================================

/**
 * Convert Prisma Decimal type to JavaScript number
 * Handles null and undefined values properly
 */
function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  // Handle Prisma Decimal type
  return Number(value);
}

/**
 * Convert Prisma Contract to TypeScript Contract type
 * Handles Decimal to number conversion for totalValue
 */
function convertContract(prismaContract: any): Contract {
  return {
    ...prismaContract,
    totalValue: toNumber(prismaContract.totalValue),
  } as Contract;
}

/**
 * Convert Prisma Artifact to TypeScript Artifact type
 * Handles Decimal to number conversion for confidence
 */
function convertArtifact(prismaArtifact: any): Artifact {
  return {
    ...prismaArtifact,
    confidence: toNumber(prismaArtifact.confidence),
  } as Artifact;
}

// ============================================================================
// DATABASE ADAPTOR CLASS
// ============================================================================

export class DatabaseAdaptor {
  public prisma: PrismaClient; // Public so services can use it
  private static instance: DatabaseAdaptor;

  private constructor() {
    this.prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Note: Connection event handlers can be added if needed in the future
  }

  static getInstance(): DatabaseAdaptor {
    if (!DatabaseAdaptor.instance) {
      DatabaseAdaptor.instance = new DatabaseAdaptor();
    }
    return DatabaseAdaptor.instance;
  }

  // =========================================================================
  // CONTRACT OPERATIONS
  // =========================================================================

  async createContract(data: CreateContractDTO): Promise<Contract> {
    try {
      const contract = await this.prisma.contract.create({
        data: {
          ...data,
          fileSize: BigInt(data.fileSize),
        } as any, // Type assertion to handle Prisma's complex union types
      });
      logger.info({ contractId: contract.id }, "Contract created");
      return convertContract(contract);
    } catch (error) {
      logger.error({ error }, "Failed to create contract");
      throw error;
    }
  }

  async getContract(id: string, tenantId: string): Promise<Contract | null> {
    try {
      const contract = await this.prisma.contract.findFirst({
        where: {
          id,
          tenantId,
        },
      });

      return contract as unknown as Contract | null;
    } catch (error) {
      logger.error({ error, id, tenantId }, "Failed to get contract");
      throw error;
    }
  }

  async updateContract(
    id: string,
    tenantId: string,
    data: Partial<Contract>
  ): Promise<Contract> {
    try {
      const contract = await this.prisma.contract.updateMany({
        where: {
          id,
          tenantId,
        },
        data: data as any,
      });

      // Return the updated contract
      const updated = await this.getContract(id, tenantId);
      if (!updated) {
        throw new Error("Contract not found after update");
      }

      return updated;
    } catch (error) {
      logger.error({ error, id, tenantId }, "Failed to update contract");
      throw error;
    }
  }

  async deleteContract(id: string, tenantId: string): Promise<void> {
    try {
      await this.prisma.contract.deleteMany({
        where: {
          id,
          tenantId,
        },
      });
    } catch (error) {
      logger.error({ error, id, tenantId }, "Failed to delete contract");
      throw error;
    }
  }

  async queryContracts(query: ContractQuery): Promise<ContractQueryResponse> {
    try {
      const where: Prisma.ContractWhereInput = {
        tenantId: query.tenantId,
        status: { not: "DELETED" },
        ...(query.search && {
          OR: [
            {
              contractTitle: { contains: query.search, mode: "insensitive" },
            },
            { clientName: { contains: query.search, mode: "insensitive" } },
            { supplierName: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
          ],
        }),
        ...(query.status &&
          query.status.length > 0 && { status: { in: query.status as any } }),
        ...(query.clientName &&
          query.clientName.length > 0 && {
            clientName: { in: query.clientName },
          }),
        ...(query.supplierName &&
          query.supplierName.length > 0 && {
            supplierName: { in: query.supplierName },
          }),
        ...(query.category &&
          query.category.length > 0 && { category: { in: query.category } }),
        ...(query.minValue && { totalValue: { gte: query.minValue } }),
        ...(query.maxValue && { totalValue: { lte: query.maxValue } }),
        ...(query.startDateFrom && { startDate: { gte: query.startDateFrom } }),
        ...(query.startDateTo && { startDate: { lte: query.startDateTo } }),
      };

      const [contracts, total] = await Promise.all([
        this.prisma.contract.findMany({
          where,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          orderBy: { [query.sortBy]: query.sortOrder },
        }),
        this.prisma.contract.count({ where }),
      ]);

      const totalPages = Math.ceil(total / query.limit);
      const hasMore = query.page < totalPages;

      logger.info({ total, page: query.page }, "Contracts queried");

      return {
        contracts: contracts.map(convertContract),
        total,
        page: query.page,
        limit: query.limit,
        totalPages,
        hasMore,
      };
    } catch (error) {
      logger.error({ error }, "Failed to query contracts");
      throw error;
    }
  }

  // =========================================================================
  // ARTIFACT OPERATIONS
  // =========================================================================

  async createArtifact(data: CreateArtifactDTO): Promise<Artifact> {
    try {
      const artifact = await this.prisma.artifact.create({
        data: data as any, // Type assertion to handle Prisma's complex union types
      });
      logger.info(
        { artifactId: artifact.id, type: artifact.type },
        "Artifact created"
      );
      return convertArtifact(artifact);
    } catch (error) {
      logger.error({ error }, "Failed to create artifact");
      throw error;
    }
  }

  async getArtifact(
    contractId: string,
    type: string
  ): Promise<Artifact | null> {
    try {
      const artifact = await this.prisma.artifact.findFirst({
        where: {
          contractId,
          type: type as any, // Cast to Prisma's ArtifactType enum
        },
      });
      return artifact ? convertArtifact(artifact) : null;
    } catch (error) {
      logger.error({ error, contractId, type }, "Failed to get artifact");
      throw error;
    }
  }

  async getArtifacts(contractId: string): Promise<Artifact[]> {
    try {
      const artifacts = await this.prisma.artifact.findMany({
        where: { contractId },
        orderBy: { createdAt: "desc" },
      });
      return artifacts.map(convertArtifact);
    } catch (error) {
      logger.error({ error, contractId }, "Failed to get artifacts");
      throw error;
    }
  }

  // =========================================================================
  // TRANSACTION SUPPORT
  // =========================================================================

  async transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error({ error }, "Database health check failed");
      return false;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    logger.info("Database disconnected");
  }

  // Get Prisma client for advanced use cases
  getClient(): PrismaClient {
    return this.prisma;
  }
}

export const dbAdaptor = DatabaseAdaptor.getInstance();
