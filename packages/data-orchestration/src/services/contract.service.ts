import { dbAdaptor } from "../dal/database.adaptor";
import { enhancedDbAdaptor } from "../dal/enhanced-database.adaptor";
import { smartCacheService } from "./smart-cache.service";
import { eventBus, Events } from "../events/event-bus";
import { fileIntegrityService } from "./file-integrity.service";
import pino from "pino";
import {
  Contract,
  ContractQuery,
  CreateContractDTO,
  UpdateContractDTO,
  ContractQueryResponse,
  ServiceResponse,
} from "../types";

export type { ServiceResponse }; // Re-export for other services

const logger = pino({ name: "contract-service" });

// Extended DTO with file integrity fields
export interface EnhancedCreateContractDTO
  extends Omit<CreateContractDTO, "fileSize" | "mimeType"> {
  filePath?: string;
  checksum?: string;
  fileSize?: bigint | number; // Allow both for flexibility
  mimeType: string; // Required
}

export class ContractService {
  private static instance: ContractService;
  private cacheTTL = 3600; // 1 hour

  private constructor() {}

  static getInstance(): ContractService {
    if (!ContractService.instance) {
      ContractService.instance = new ContractService();
    }
    return ContractService.instance;
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  async createContract(
    data: CreateContractDTO
  ): Promise<ServiceResponse<Contract>> {
    try {
      // Create in database
      const contract = await dbAdaptor.createContract(data);

      // Cache the contract using smart cache
      await smartCacheService.set(
        this.getCacheKey(contract.tenantId, contract.id),
        contract,
        this.cacheTTL
      );

      // Emit contract created event for intelligence processing (non-blocking)
      try {
        await eventBus.publish(Events.CONTRACT_CREATED, {
          contractId: contract.id,
          tenantId: contract.tenantId,
          contract,
        });
      } catch (eventError) {
        logger.warn(
          { error: eventError, contractId: contract.id },
          "Failed to publish contract created event, continuing anyway"
        );
      }

      logger.info({ contractId: contract.id }, "Contract created successfully");

      return {
        success: true,
        data: contract,
      };
    } catch (error) {
      logger.error({ error }, "Failed to create contract");
      return {
        success: false,
        error: {
          code: "CREATE_FAILED",
          message: "Failed to create contract",
          details: error,
        },
      };
    }
  }

  /**
   * Create contract with enhanced integrity checks and transaction support
   * This is the production-grade version with file validation, duplicate detection,
   * and automatic processing job creation
   */
  async createContractWithIntegrity(
    data: EnhancedCreateContractDTO
  ): Promise<ServiceResponse<{ contract: Contract; jobId?: string }>> {
    const startTime = Date.now();

    try {
      logger.info(
        { fileName: data.fileName, tenantId: data.tenantId },
        "Creating contract with integrity checks"
      );

      // Step 1: Calculate checksum if file path provided
      let checksum = data.checksum;
      let fileMetadata: any = {};

      if (data.filePath) {
        logger.debug({ filePath: data.filePath }, "Calculating file checksum");

        // Calculate checksum
        const checksumResult = await fileIntegrityService.calculateChecksum(
          data.filePath
        );
        checksum = checksumResult.checksum;

        // Extract file metadata
        fileMetadata = await fileIntegrityService.extractFileMetadata(
          data.filePath
        );

        logger.info(
          { checksum, fileSize: fileMetadata.size },
          "File integrity data calculated"
        );

        // Step 2: Validate file format
        const validation = await fileIntegrityService.validateFileFormat(
          data.filePath,
          data.mimeType || fileMetadata.mimeType
        );

        if (!validation.valid) {
          logger.warn({ errors: validation.errors }, "File validation failed");
          return {
            success: false,
            error: {
              code: "VALIDATION_FAILED",
              message: "File validation failed",
              details: validation.errors,
            },
          };
        }

        if (validation.warnings.length > 0) {
          logger.warn(
            { warnings: validation.warnings },
            "File validation warnings"
          );
        }
      }

      // Step 3: Check for duplicates
      if (checksum) {
        const duplicate = await fileIntegrityService.findDuplicateByChecksum(
          checksum,
          data.tenantId
        );

        if (duplicate) {
          logger.info(
            { duplicateId: duplicate.id, checksum },
            "Duplicate contract detected"
          );

          return {
            success: false,
            error: {
              code: "DUPLICATE_DETECTED",
              message: "A contract with the same content already exists",
              details: {
                existingContractId: duplicate.id,
                existingFileName: duplicate.fileName,
                uploadedAt: duplicate.createdAt,
                uploadedBy: duplicate.uploadedBy,
              },
            },
          };
        }
      }

      // Step 4: Create contract and processing job in a transaction
      const result = await enhancedDbAdaptor.withTransaction(async (tx) => {
        // Create contract with integrity data
        // Remove filePath from data as it's not in the schema
        const { filePath, ...contractDataWithoutPath } = data;

        const contractData: any = {
          ...contractDataWithoutPath,
          checksum,
          checksumAlgorithm: "sha256",
          fileSize: BigInt(data.fileSize || fileMetadata.size || 0),
          mimeType: data.mimeType || fileMetadata.mimeType,
          status: "PROCESSING", // Use valid status from enum
        };

        const contract = await tx.contract.create({
          data: contractData,
        });

        logger.info(
          { contractId: contract.id },
          "Contract created in transaction"
        );

        // Create processing job
        // Note: Using 'as any' temporarily until Prisma client is regenerated with new schema
        const job = await (tx.processingJob as any).create({
          data: {
            contractId: contract.id,
            tenantId: contract.tenantId,
            status: "PENDING",
            progress: 0,
            currentStep: "Queued",
            totalStages: 5, // text extraction, AI analysis, artifact generation, standardization, completion
            priority: 0,
            maxRetries: 3,
            retryCount: 0,
            metadata: {
              fileName: contract.fileName,
              fileSize: Number(contract.fileSize),
              mimeType: contract.mimeType,
            },
          },
        });

        logger.info(
          { contractId: contract.id, jobId: job.id },
          "Processing job created in transaction"
        );

        return { contract, job };
      });

      // Step 5: Cache the contract using smart cache
      await smartCacheService.set(
        this.getCacheKey(result.contract.tenantId, result.contract.id),
        result.contract,
        this.cacheTTL
      );

      // Step 6: Emit events (non-blocking)
      try {
        await eventBus.publish(Events.CONTRACT_CREATED, {
          contractId: result.contract.id,
          tenantId: result.contract.tenantId,
          contract: result.contract,
          jobId: result.job.id,
        });

        await eventBus.publish(Events.JOB_CREATED, {
          jobId: result.job.id,
          contractId: result.contract.id,
          tenantId: result.contract.tenantId,
        });
      } catch (eventError) {
        logger.warn(
          { error: eventError, contractId: result.contract.id },
          "Failed to publish events, continuing anyway"
        );
      }

      const duration = Date.now() - startTime;
      logger.info(
        {
          contractId: result.contract.id,
          jobId: result.job.id,
          duration,
          checksum,
        },
        "Contract created successfully with integrity checks"
      );

      return {
        success: true,
        data: {
          contract: {
            ...result.contract,
            totalValue: result.contract.totalValue
              ? Number(result.contract.totalValue)
              : null,
          } as Contract,
          jobId: result.job.id,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        { error, duration, fileName: data.fileName },
        "Failed to create contract with integrity checks"
      );

      return {
        success: false,
        error: {
          code: "CREATE_FAILED",
          message: "Failed to create contract",
          details: error,
        },
      };
    }
  }

  async getContract(
    id: string,
    tenantId: string,
    includeRelations = false
  ): Promise<ServiceResponse<Contract>> {
    try {
      // Try smart cache first (only for basic contract, not with relations)
      if (!includeRelations) {
        const cacheKey = this.getCacheKey(tenantId, id);
        const cached = await smartCacheService.get<Contract>(cacheKey);
        if (cached) {
          logger.debug({ contractId: id }, "Contract retrieved from cache");
          // Track view asynchronously (don't wait)
          this.incrementViewCount(id, tenantId).catch((err) =>
            logger.error({ err }, "Failed to increment view count")
          );
          return {
            success: true,
            data: cached,
          };
        }
      }

      // Fetch from database
      const contract = await dbAdaptor.getContract(id, tenantId);

      if (!contract) {
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Contract not found",
          },
        };
      }

      // Cache if found and not with relations
      if (!includeRelations) {
        await smartCacheService.set(
          this.getCacheKey(tenantId, id),
          contract,
          this.cacheTTL
        );
      }

      // Track view
      try {
        await this.incrementViewCount(id, tenantId);
      } catch (viewError) {
        logger.warn(
          { error: viewError, contractId: id },
          "Failed to increment view count"
        );
      }

      // Emit contract viewed event for analytics (non-blocking) - DISABLED FOR NOW
      // try {
      //   await eventBus.publish(Events.CONTRACT_VIEWED, {
      //     contractId: id,
      //     tenantId,
      //     timestamp: new Date(),
      //   });
      // } catch (eventError) {
      //   logger.warn({ error: eventError, contractId: id }, "Failed to publish contract viewed event, continuing anyway");
      // }

      logger.debug({ contractId: id }, "Contract retrieved from database");

      return {
        success: true,
        data: contract,
      };
    } catch (error) {
      logger.error({ error, contractId: id }, "Failed to get contract");
      return {
        success: false,
        error: {
          code: "GET_FAILED",
          message: "Failed to retrieve contract",
          details: error,
        },
      };
    }
  }

  async updateContract(
    id: string,
    tenantId: string,
    data: UpdateContractDTO
  ): Promise<ServiceResponse<Contract>> {
    try {
      // Update in database
      const contract = await dbAdaptor.updateContract(id, tenantId, data);

      // Selective cache invalidation based on what changed
      await smartCacheService.invalidateContract(tenantId, id, data);

      // Emit contract updated event for intelligence processing
      await eventBus.publish(Events.CONTRACT_UPDATED, {
        contractId: id,
        tenantId,
        changes: data,
        contract,
      });

      logger.info({ contractId: id }, "Contract updated successfully");

      return {
        success: true,
        data: contract,
      };
    } catch (error) {
      logger.error({ error, contractId: id }, "Failed to update contract");
      return {
        success: false,
        error: {
          code: "UPDATE_FAILED",
          message: "Failed to update contract",
          details: error,
        },
      };
    }
  }

  async deleteContract(
    id: string,
    tenantId: string
  ): Promise<ServiceResponse<void>> {
    try {
      // Soft delete
      await dbAdaptor.deleteContract(id, tenantId);

      // Selective cache invalidation
      await smartCacheService.invalidateContract(tenantId, id, {
        status: "DELETED",
      });

      logger.info({ contractId: id }, "Contract deleted successfully");

      return {
        success: true,
      };
    } catch (error) {
      logger.error({ error, contractId: id }, "Failed to delete contract");
      return {
        success: false,
        error: {
          code: "DELETE_FAILED",
          message: "Failed to delete contract",
          details: error,
        },
      };
    }
  }

  async queryContracts(
    query: ContractQuery
  ): Promise<ServiceResponse<ContractQueryResponse>> {
    try {
      // Generate cache key from query (deterministic)
      const cacheKey = smartCacheService.generateQueryKey(
        query.tenantId,
        query
      );

      // Try smart cache first
      const cached = await smartCacheService.get<ContractQueryResponse>(
        cacheKey
      );
      if (cached) {
        logger.debug("Contracts query retrieved from cache");
        return {
          success: true,
          data: cached,
        };
      }

      // Query database
      const result = await dbAdaptor.queryContracts(query);

      // Cache result with dependencies
      await smartCacheService.cacheQueryResult(
        query.tenantId,
        query,
        result,
        300 // 5 minutes
      );

      logger.info(
        { total: result.total, page: result.page },
        "Contracts queried"
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error({ error }, "Failed to query contracts");
      return {
        success: false,
        error: {
          code: "QUERY_FAILED",
          message: "Failed to query contracts",
          details: error,
        },
      };
    }
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private getCacheKey(tenantId: string, contractId: string): string {
    return `contract:${tenantId}:${contractId}`;
  }

  private getQueryCacheKey(query: ContractQuery): string {
    // Create deterministic cache key from query parameters
    const sortedQuery = Object.keys(query)
      .sort()
      .reduce((acc, key) => {
        acc[key] = query[key as keyof ContractQuery];
        return acc;
      }, {} as any);

    return `contracts:${query.tenantId}:${JSON.stringify(sortedQuery)}`;
  }

  private async incrementViewCount(
    id: string,
    tenantId: string
  ): Promise<void> {
    try {
      // Get current contract first
      const contract = await dbAdaptor.getContract(id, tenantId);
      if (!contract) return;

      // Update with incremented view count
      await dbAdaptor.updateContract(id, tenantId, {
        viewCount: (contract.viewCount || 0) + 1,
        lastViewedAt: new Date(),
      });
    } catch (error) {
      logger.error({ error, contractId: id }, "Failed to increment view count");
      // Don't throw - view tracking is not critical
    }
  }

  /**
   * Health check for contract service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try a simple database query
      await dbAdaptor.queryContracts({
        tenantId: "health-check",
        page: 1,
        limit: 1,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      return true;
    } catch (error) {
      logger.error({ error }, "Contract service health check failed");
      return false;
    }
  }
}

export const contractService = ContractService.getInstance();
