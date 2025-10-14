import { Artifact, ArtifactType, Prisma } from "@prisma/client";
import { AbstractRepository } from "./base.repository";
import { DatabaseManager } from "../../index";

export type ArtifactCreateInput = Prisma.ArtifactCreateInput;
export type ArtifactUpdateInput = Prisma.ArtifactUpdateInput;
export type ArtifactWhereInput = Prisma.ArtifactWhereInput;

export class ArtifactRepository extends AbstractRepository<
  Artifact,
  ArtifactCreateInput,
  ArtifactUpdateInput,
  ArtifactWhereInput
> {
  protected modelName = "artifact";

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  async findByContract(contractId: string): Promise<Artifact[]> {
    return await this.prisma.artifact.findMany({
      where: { contractId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByContractAndType(
    contractId: string,
    type: ArtifactType
  ): Promise<Artifact | null> {
    return await this.prisma.artifact.findUnique({
      where: {
        contractId_type: {
          contractId,
          type,
        },
      },
    });
  }

  async findByTenant(
    tenantId: string,
    options?: {
      type?: ArtifactType[];
      limit?: number;
      offset?: number;
    }
  ): Promise<Artifact[]> {
    const where: Prisma.ArtifactWhereInput = { tenantId };

    if (options?.type) {
      where.type = { in: options.type };
    }

    return await this.prisma.artifact.findMany({
      where,
      take: options?.limit,
      skip: options?.offset,
      orderBy: { createdAt: "desc" },
    });
  }

  async createOrUpdate(
    contractId: string,
    tenantId: string,
    type: ArtifactType,
    data: any,
    options?: {
      schemaVersion?: string;
      processingTime?: number;
      confidence?: number;
    }
  ): Promise<Artifact> {
    const artifactData = {
      contractId,
      tenantId,
      type,
      data,
      schemaVersion: options?.schemaVersion || "v1",
      processingTime: options?.processingTime,
      confidence: options?.confidence,
      size: JSON.stringify(data).length,
      hash: this.generateHash(data),
    };

    return await this.prisma.artifact.upsert({
      where: {
        contractId_type: {
          contractId,
          type,
        },
      },
      create: artifactData,
      update: {
        data: artifactData.data,
        schemaVersion: artifactData.schemaVersion,
        processingTime: artifactData.processingTime,
        confidence: artifactData.confidence,
        size: artifactData.size,
        hash: artifactData.hash,
        updatedAt: new Date(),
      },
    });
  }

  async getArtifactsByType(
    tenantId: string,
    type: ArtifactType
  ): Promise<Artifact[]> {
    return await this.prisma.artifact.findMany({
      where: {
        tenantId,
        type,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getArtifactStats(
    tenantId: string
  ): Promise<Record<ArtifactType, number>> {
    const stats = await this.prisma.artifact.groupBy({
      by: ["type"],
      where: { tenantId },
      _count: { type: true },
    });

    const result: Record<string, number> = {};
    stats.forEach((item) => {
      result[item.type] = item._count.type;
    });

    return result as Record<ArtifactType, number>;
  }

  async deleteByContract(contractId: string): Promise<{ count: number }> {
    return await this.prisma.artifact.deleteMany({
      where: { contractId },
    });
  }

  async findRecentArtifacts(tenantId: string, limit = 10): Promise<Artifact[]> {
    return await this.prisma.artifact.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        contract: {
          select: {
            id: true,
            fileName: true,
          },
        },
      },
    });
  }

  async getArtifactSizeStats(tenantId: string): Promise<{
    totalSize: number;
    averageSize: number;
    largestArtifact: number;
  }> {
    const stats = await this.prisma.artifact.aggregate({
      where: { tenantId },
      _sum: { size: true },
      _avg: { size: true },
      _max: { size: true },
    });

    return {
      totalSize: stats._sum.size || 0,
      averageSize: Math.round(stats._avg.size || 0),
      largestArtifact: stats._max.size || 0,
    };
  }

  async findArtifactsWithLowConfidence(
    tenantId: string,
    threshold = 0.7,
    limit = 50
  ): Promise<Artifact[]> {
    return await this.prisma.artifact.findMany({
      where: {
        tenantId,
        confidence: {
          lt: threshold,
        },
      },
      orderBy: { confidence: "asc" },
      take: limit,
      include: {
        contract: {
          select: {
            id: true,
            fileName: true,
          },
        },
      },
    });
  }

  private generateHash(data: any): string {
    // Simple hash generation - in production, use a proper hashing library
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
