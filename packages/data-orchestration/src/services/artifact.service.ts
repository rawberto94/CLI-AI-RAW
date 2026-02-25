import { dbAdaptor } from "../dal/database.adaptor";
import { cacheAdaptor } from "../dal/cache.adaptor";
import { ArtifactSchema, CreateArtifactDTO, Artifact } from "../types";
import type { ServiceResponse } from "./contract.service";

export class ArtifactService {
  private static instance: ArtifactService;

  private constructor() {}

  static getInstance(): ArtifactService {
    if (!ArtifactService.instance) {
      ArtifactService.instance = new ArtifactService();
    }
    return ArtifactService.instance;
  }

  /**
   * Get artifacts for a contract with optional pagination and type filter.
   *
   * When `options` is omitted the behaviour is backwards-compatible and
   * returns *all* artifacts (the previous default).
   */
  async getContractArtifacts(
    contractId: string,
    tenantId: string,
    options?: { type?: string; page?: number; limit?: number }
  ): Promise<ServiceResponse<Artifact[]>> {
    try {
      const { type, page = 1, limit = 500 } = options ?? {};

      // Cache key includes pagination & filter to avoid stale mixes
      const cacheKey = `artifacts:${tenantId}:${contractId}:${type ?? 'all'}:p${page}:l${limit}`;
      const cached = await cacheAdaptor.get<Artifact[]>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
        };
      }

      // Build where clause
      const where: Record<string, unknown> = { contractId, tenantId };
      if (type) {
        where.type = type;
      }

      // Fetch from database with pagination
      const artifacts = await dbAdaptor.prisma.artifact.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Transform Prisma types to expected types (Decimal -> number, etc.)
      const transformedArtifacts = artifacts.map((artifact) => ({
        ...artifact,
        confidence: artifact.confidence ? Number(artifact.confidence) : null,
        processingTime: artifact.processingTime || null,
        size: artifact.size || null,
        hash: artifact.hash || null,
        location: artifact.location || null,
        storageProvider: artifact.storageProvider || "database",
      }));

      // Validate the transformed data
      const validatedArtifacts = transformedArtifacts.map((artifact) =>
        ArtifactSchema.parse(artifact)
      );

      // Cache the result
      await cacheAdaptor.set(cacheKey, validatedArtifacts, 300); // 5 min TTL

      return {
        success: true,
        data: validatedArtifacts,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: "FETCH_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch artifacts",
        },
      };
    }
  }

  /**
   * Get a specific artifact by ID
   */
  async getArtifact(
    artifactId: string,
    tenantId: string
  ): Promise<ServiceResponse<Artifact>> {
    try {
      const artifact = await dbAdaptor.prisma.artifact.findFirst({
        where: {
          id: artifactId,
          tenantId,
        },
      });

      if (!artifact) {
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Artifact not found",
          },
        };
      }

      const validated = ArtifactSchema.parse(artifact);

      return {
        success: true,
        data: validated,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: "FETCH_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to fetch artifact",
        },
      };
    }
  }

  /**
   * Get artifact by type for a contract
   */
  async getArtifactByType(
    contractId: string,
    tenantId: string,
    type: string
  ): Promise<ServiceResponse<Artifact | null>> {
    try {
      // Try cache first
      const cacheKey = `artifact:${tenantId}:${contractId}:${type}`;
      const cached = await cacheAdaptor.get<Artifact>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
        };
      }

      // Fetch from database
      const artifact = await dbAdaptor.prisma.artifact.findFirst({
        where: {
          contractId,
          tenantId,
          type: type as any,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!artifact) {
        return {
          success: true,
          data: null,
        };
      }

      const validated = ArtifactSchema.parse(artifact);

      // Cache the result
      await cacheAdaptor.set(cacheKey, validated, 600); // 10 min TTL

      return {
        success: true,
        data: validated,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: "FETCH_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to fetch artifact",
        },
      };
    }
  }

  /**
   * Create a new artifact
   */
  async createArtifact(
    data: CreateArtifactDTO
  ): Promise<ServiceResponse<Artifact>> {
    try {
      // Create in database
      const artifact = await dbAdaptor.prisma.artifact.create({
        data: {
          contractId: data.contractId,
          tenantId: data.tenantId,
          type: data.type as any,
          data: data.data,
          // metadata field doesn't exist in Prisma schema, so we skip it
        },
      });

      const validated = ArtifactSchema.parse(artifact);

      // Invalidate caches
      await cacheAdaptor.delete(
        `artifacts:${data.tenantId}:${data.contractId}`
      );
      await cacheAdaptor.delete(
        `artifact:${data.tenantId}:${data.contractId}:${data.type}`
      );

      return {
        success: true,
        data: validated,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: "CREATE_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to create artifact",
        },
      };
    }
  }

  /**
   * Update an existing artifact
   */
  async updateArtifact(
    artifactId: string,
    tenantId: string,
    updates: Partial<CreateArtifactDTO>
  ): Promise<ServiceResponse<Artifact>> {
    try {
      // Get existing artifact to validate it exists
      const existing = await dbAdaptor.prisma.artifact.findFirst({
        where: {
          id: artifactId,
          tenantId,
        },
      });

      if (!existing) {
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Artifact not found",
          },
        };
      }

      // Update in database
      const artifact = await dbAdaptor.prisma.artifact.update({
        where: {
          id: artifactId,
        },
        data: {
          ...(updates.type && { type: updates.type as any }),
          ...(updates.data && { data: updates.data }),
          // metadata field doesn't exist in Prisma schema
        },
      });

      const validated = ArtifactSchema.parse(artifact);

      // Invalidate caches
      await cacheAdaptor.delete(`artifacts:${tenantId}:${existing.contractId}`);
      await cacheAdaptor.delete(
        `artifact:${tenantId}:${existing.contractId}:${existing.type}`
      );

      return {
        success: true,
        data: validated,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: "UPDATE_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to update artifact",
        },
      };
    }
  }

  /**
   * Delete an artifact
   */
  async deleteArtifact(
    artifactId: string,
    tenantId: string
  ): Promise<ServiceResponse<void>> {
    try {
      // Get artifact to invalidate caches
      const artifact = await dbAdaptor.prisma.artifact.findFirst({
        where: {
          id: artifactId,
          tenantId,
        },
      });

      if (!artifact) {
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Artifact not found",
          },
        };
      }

      // Delete from database
      await dbAdaptor.prisma.artifact.delete({
        where: {
          id: artifactId,
        },
      });

      // Invalidate caches
      await cacheAdaptor.delete(`artifacts:${tenantId}:${artifact.contractId}`);
      await cacheAdaptor.delete(
        `artifact:${tenantId}:${artifact.contractId}:${artifact.type}`
      );

      return {
        success: true,
        data: undefined,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: "DELETE_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to delete artifact",
        },
      };
    }
  }

  /**
   * Get artifacts summary for a contract
   */
  async getArtifactsSummary(
    contractId: string,
    tenantId: string
  ): Promise<
    ServiceResponse<{
      total: number;
      byType: Record<string, number>;
      lastUpdated?: Date;
    }>
  > {
    try {
      const artifacts = await dbAdaptor.prisma.artifact.findMany({
        where: {
          contractId,
          tenantId,
        },
        select: {
          type: true,
          createdAt: true,
        },
      });

      const byType: Record<string, number> = {};
      let lastUpdated: Date | undefined;

      artifacts.forEach((artifact) => {
        byType[artifact.type] = (byType[artifact.type] || 0) + 1;
        if (!lastUpdated || artifact.createdAt > lastUpdated) {
          lastUpdated = artifact.createdAt;
        }
      });

      return {
        success: true,
        data: {
          total: artifacts.length,
          byType,
          lastUpdated,
        },
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: "FETCH_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to fetch artifacts summary",
        },
      };
    }
  }
}

export const artifactService = ArtifactService.getInstance();
