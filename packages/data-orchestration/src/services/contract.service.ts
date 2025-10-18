import { dbAdaptor } from "../dal/database.adaptor";
import { cacheAdaptor } from "../dal/cache.adaptor";
import { eventBus, Events } from "../events/event-bus";
import { contractIndexingService } from "./contract-indexing.service";
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

      // Cache the contract
      await cacheAdaptor.set(
        this.getCacheKey(contract.tenantId, contract.id),
        contract,
        this.cacheTTL
      );

      // Invalidate list caches for this tenant
      await cacheAdaptor.invalidatePattern(`contracts:${contract.tenantId}:*`);

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

  async getContract(
    id: string,
    tenantId: string,
    includeRelations = false
  ): Promise<ServiceResponse<Contract>> {
    try {
      // Try cache first (only for basic contract, not with relations)
      if (!includeRelations) {
        const cacheKey = this.getCacheKey(tenantId, id);
        const cached = await cacheAdaptor.get<Contract>(cacheKey);
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
        await cacheAdaptor.set(
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

      // Invalidate caches
      await cacheAdaptor.delete(this.getCacheKey(tenantId, id));
      await cacheAdaptor.invalidatePattern(`contracts:${tenantId}:*`);

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

      // Invalidate caches
      await cacheAdaptor.delete(this.getCacheKey(tenantId, id));
      await cacheAdaptor.invalidatePattern(`contracts:${tenantId}:*`);

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
      const cacheKey = this.getQueryCacheKey(query);

      // Try cache first
      const cached = await cacheAdaptor.get<ContractQueryResponse>(cacheKey);
      if (cached) {
        logger.debug("Contracts query retrieved from cache");
        return {
          success: true,
          data: cached,
        };
      }

      // Query database
      const result = await dbAdaptor.queryContracts(query);

      // Cache result (shorter TTL for lists)
      await cacheAdaptor.set(cacheKey, result, 300); // 5 minutes

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
}

export const contractService = ContractService.getInstance();
