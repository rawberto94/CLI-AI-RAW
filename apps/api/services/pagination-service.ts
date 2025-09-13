import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { listContracts, getContract } from '../store';
import { hash } from '../../../packages/utils/src';
import { logger } from '../../../packages/utils/src/logging';
import { cache } from '../cache';

// Pagination schemas
const OffsetPaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  filters: z.record(z.any()).optional()
});

const CursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  direction: z.enum(['forward', 'backward']).default('forward'),
  filters: z.record(z.any()).optional()
});

const KeysetPaginationSchema = z.object({
  lastId: z.string().optional(),
  lastTimestamp: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  filters: z.record(z.any()).optional()
});

interface PaginationResult<T> {
  items: T[];
  pagination: {
    type: 'offset' | 'cursor' | 'keyset';
    [key: string]: any;
  };
  metadata: {
    totalFiltered?: number;
    cacheHit: boolean;
    queryTime: number;
  };
}

interface ContractFilter {
  status?: string | string[];
  tenantId?: string;
  clientId?: string;
  supplierId?: string;
  archived?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  search?: string;
}

class ContractPaginationService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;
  private queryCache = new Map<string, { data: any; timestamp: number }>();

  /**
   * Offset-based pagination (traditional page/pageSize)
   */
  async paginateWithOffset(
    params: z.infer<typeof OffsetPaginationSchema>,
    tenantId?: string
  ): Promise<PaginationResult<any>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('offset', params, tenantId);
    
    // Check cache first
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return {
        ...cached,
        metadata: { ...cached.metadata, cacheHit: true, queryTime: Date.now() - startTime }
      };
    }

    // Get all contracts (in real app, this would be a database query)
    let allContracts = listContracts(tenantId, { archived: params.filters?.archived });
    
    // Apply filters
    allContracts = this.applyFilters(allContracts, params.filters);
    
    // Sort contracts
    allContracts = this.sortContracts(allContracts, params.sortBy, params.sortOrder);
    
    // Calculate pagination
    const total = allContracts.length;
    const offset = (params.page - 1) * params.pageSize;
    const items = allContracts.slice(offset, offset + params.pageSize);
    const totalPages = Math.ceil(total / params.pageSize);

    const result: PaginationResult<any> = {
      items: items.map(this.serializeContract),
      pagination: {
        type: 'offset',
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages,
        hasNext: params.page < totalPages,
        hasPrev: params.page > 1,
        nextPage: params.page < totalPages ? params.page + 1 : null,
        prevPage: params.page > 1 ? params.page - 1 : null
      },
      metadata: {
        totalFiltered: total,
        cacheHit: false,
        queryTime: Date.now() - startTime
      }
    };

    // Cache result
    await this.setToCache(cacheKey, result);
    
    return result;
  }

  /**
   * Cursor-based pagination (for real-time data)
   */
  async paginateWithCursor(
    params: z.infer<typeof CursorPaginationSchema>,
    tenantId?: string
  ): Promise<PaginationResult<any>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('cursor', params, tenantId);
    
    // Check cache (shorter TTL for cursor pagination)
    const cached = await this.getFromCache(cacheKey, 60); // 1 minute cache
    if (cached) {
      return {
        ...cached,
        metadata: { ...cached.metadata, cacheHit: true, queryTime: Date.now() - startTime }
      };
    }

    let allContracts = listContracts(tenantId, { archived: params.filters?.archived });
    
    // Apply filters
    allContracts = this.applyFilters(allContracts, params.filters);
    
    // Sort by creation date and ID for consistency
    allContracts.sort((a, b) => {
      const timeCompare = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (timeCompare !== 0) return timeCompare;
      return b.id.localeCompare(a.id);
    });

    let items: any[] = [];
    let hasMore = false;
    let nextCursor: string | null = null;
    let prevCursor: string | null = null;

    if (params.cursor) {
      // Decode cursor
      const cursorData = this.decodeCursor(params.cursor);
      if (!cursorData) {
        throw new Error('Invalid cursor');
      }

      const { timestamp, id } = cursorData;
      
      if (params.direction === 'forward') {
        // Find contracts after the cursor
        const startIndex = allContracts.findIndex(contract => {
          const contractTime = new Date(contract.createdAt).getTime();
          return contractTime < timestamp || (contractTime === timestamp && contract.id.localeCompare(id) < 0);
        });
        
        if (startIndex !== -1) {
          items = allContracts.slice(startIndex, startIndex + params.limit);
          hasMore = startIndex + params.limit < allContracts.length;
        }
      } else {
        // Find contracts before the cursor
        const endIndex = allContracts.findIndex(contract => {
          const contractTime = new Date(contract.createdAt).getTime();
          return contractTime > timestamp || (contractTime === timestamp && contract.id.localeCompare(id) > 0);
        });
        
        if (endIndex !== -1) {
          const startIndex = Math.max(0, endIndex - params.limit);
          items = allContracts.slice(startIndex, endIndex);
          hasMore = startIndex > 0;
        }
      }
    } else {
      // No cursor, start from beginning
      items = allContracts.slice(0, params.limit);
      hasMore = allContracts.length > params.limit;
    }

    // Generate cursors
    if (items.length > 0) {
      if (params.direction === 'forward' && hasMore) {
        const lastItem = items[items.length - 1];
        nextCursor = this.encodeCursor(lastItem);
      }
      
      if (params.direction === 'backward' && hasMore) {
        const firstItem = items[0];
        prevCursor = this.encodeCursor(firstItem);
      }
      
      // For bidirectional navigation
      if (params.cursor) {
        if (params.direction === 'forward') {
          prevCursor = params.cursor;
        } else {
          nextCursor = params.cursor;
        }
      }
    }

    const result: PaginationResult<any> = {
      items: items.map(this.serializeContract),
      pagination: {
        type: 'cursor',
        nextCursor,
        prevCursor,
        hasMore,
        limit: params.limit,
        direction: params.direction
      },
      metadata: {
        cacheHit: false,
        queryTime: Date.now() - startTime
      }
    };

    // Cache result with shorter TTL
    await this.setToCache(cacheKey, result, 60);
    
    return result;
  }

  /**
   * Keyset pagination (for consistent ordering)
   */
  async paginateWithKeyset(
    params: z.infer<typeof KeysetPaginationSchema>,
    tenantId?: string
  ): Promise<PaginationResult<any>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('keyset', params, tenantId);
    
    let allContracts = listContracts(tenantId, { archived: params.filters?.archived });
    
    // Apply filters
    allContracts = this.applyFilters(allContracts, params.filters);
    
    // Sort by creation date and ID for consistency
    allContracts.sort((a, b) => {
      const timeCompare = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (timeCompare !== 0) return timeCompare;
      return a.id.localeCompare(b.id);
    });

    let items: any[] = [];
    let nextKeyset: { lastId: string; lastTimestamp: string } | null = null;

    if (params.lastId && params.lastTimestamp) {
      // Find contracts after the last keyset
      const lastTimestamp = new Date(params.lastTimestamp).getTime();
      const startIndex = allContracts.findIndex(contract => {
        const contractTime = new Date(contract.createdAt).getTime();
        return contractTime > lastTimestamp || 
               (contractTime === lastTimestamp && contract.id.localeCompare(params.lastId!) > 0);
      });
      
      if (startIndex !== -1) {
        items = allContracts.slice(startIndex, startIndex + params.limit);
      }
    } else {
      // No keyset, start from beginning
      items = allContracts.slice(0, params.limit);
    }

    // Generate next keyset
    if (items.length === params.limit && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextKeyset = {
        lastId: lastItem.id,
        lastTimestamp: lastItem.createdAt.toISOString()
      };
    }

    const result: PaginationResult<any> = {
      items: items.map(this.serializeContract),
      pagination: {
        type: 'keyset',
        nextKeyset,
        limit: params.limit,
        count: items.length
      },
      metadata: {
        cacheHit: false,
        queryTime: Date.now() - startTime
      }
    };

    return result;
  }

  /**
   * Smart pagination that chooses the best strategy based on use case
   */
  async smartPaginate(
    type: 'offset' | 'cursor' | 'keyset' | 'auto',
    params: any,
    tenantId?: string
  ): Promise<PaginationResult<any>> {
    if (type === 'auto') {
      // Choose pagination strategy based on parameters
      if (params.cursor || params.direction) {
        type = 'cursor';
      } else if (params.lastId && params.lastTimestamp) {
        type = 'keyset';
      } else {
        type = 'offset';
      }
    }

    switch (type) {
      case 'cursor':
        return this.paginateWithCursor(CursorPaginationSchema.parse(params), tenantId);
      case 'keyset':
        return this.paginateWithKeyset(KeysetPaginationSchema.parse(params), tenantId);
      default:
        return this.paginateWithOffset(OffsetPaginationSchema.parse(params), tenantId);
    }
  }

  private applyFilters(contracts: any[], filters?: ContractFilter): any[] {
    if (!filters) return contracts;

    return contracts.filter(contract => {
      // Status filter
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        if (!statuses.includes(contract.status)) return false;
      }

      // Client ID filter
      if (filters.clientId && contract.clientId !== filters.clientId) {
        return false;
      }

      // Supplier ID filter
      if (filters.supplierId && contract.supplierId !== filters.supplierId) {
        return false;
      }

      // Date range filters
      if (filters.createdAfter) {
        const afterDate = new Date(filters.createdAfter);
        if (new Date(contract.createdAt) < afterDate) return false;
      }

      if (filters.createdBefore) {
        const beforeDate = new Date(filters.createdBefore);
        if (new Date(contract.createdAt) > beforeDate) return false;
      }

      // Text search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const searchableText = [
          contract.name,
          contract.id,
          contract.clientId,
          contract.supplierId
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(searchTerm)) return false;
      }

      return true;
    });
  }

  private sortContracts(contracts: any[], sortBy: string, sortOrder: 'asc' | 'desc'): any[] {
    return contracts.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // Handle date sorting
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      // Handle string sorting
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Handle numeric sorting
      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  }

  private encodeCursor(contract: any): string {
    const cursorData = {
      id: contract.id,
      timestamp: new Date(contract.createdAt).getTime()
    };
    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  private decodeCursor(cursor: string): { id: string; timestamp: number } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  private serializeContract(contract: any): any {
    return {
      id: contract.id,
      name: contract.name,
      status: contract.status,
      createdAt: contract.createdAt.toISOString(),
      updatedAt: contract.updatedAt?.toISOString(),
      clientId: contract.clientId,
      supplierId: contract.supplierId,
      tenantId: contract.tenantId,
      archived: contract.archived || false
    };
  }

  private generateCacheKey(type: string, params: any, tenantId?: string): string {
    const keyData = {
      type,
      params: JSON.stringify(params),
      tenantId: tenantId || 'default'
    };
    const key = Buffer.from(JSON.stringify(keyData)).toString('base64');
    return `pagination:${key}`;
  }

  private async getFromCache(key: string, ttl: number = this.CACHE_TTL): Promise<any> {
    // Check in-memory cache first
    const memCached = this.queryCache.get(key);
    if (memCached && Date.now() - memCached.timestamp < ttl * 1000) {
      return memCached.data;
    }

    // Check Redis cache
    try {
      const cached = await cache.get(key);
      if (cached) {
        // Update in-memory cache
        this.queryCache.set(key, { data: cached, timestamp: Date.now() });
        this.cleanMemoryCache();
        return cached;
      }
    } catch (error) {
      console.warn('Cache get error:', error);
    }

    return null;
  }

  private async setToCache(key: string, data: any, ttl: number = this.CACHE_TTL): Promise<void> {
    // Set in-memory cache
    this.queryCache.set(key, { data, timestamp: Date.now() });
    this.cleanMemoryCache();

    // Set Redis cache
    try {
      await cache.set(key, data, ttl);
    } catch (error) {
      console.warn('Cache set error:', error);
    }
  }

  private cleanMemoryCache(): void {
    if (this.queryCache.size > this.MAX_CACHE_SIZE) {
      // Remove oldest entries
      const entries = Array.from(this.queryCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.2));
      toRemove.forEach(([key]) => this.queryCache.delete(key));
    }
  }

  /**
   * Invalidate pagination cache for a tenant
   */
  async invalidateCache(tenantId?: string): Promise<void> {
    // Clear in-memory cache
    if (tenantId) {
      for (const [key, value] of this.queryCache.entries()) {
        if (key.includes(`"tenantId":"${tenantId}"`)) {
          this.queryCache.delete(key);
        }
      }
    } else {
      this.queryCache.clear();
    }

    // Clear Redis cache (would need pattern matching in real Redis implementation)
    try {
      const pattern = tenantId ? `pagination:*${tenantId}*` : 'pagination:*';
      // In a real implementation, you'd use Redis SCAN with pattern matching
      console.log(`Would invalidate cache pattern: ${pattern}`);
    } catch (error) {
      console.warn('Cache invalidation error:', error);
    }
  }
}

// Export singleton instance
export const paginationService = new ContractPaginationService();

/**
 * Register pagination routes with Fastify
 */
export function registerPaginationRoutes(fastify: FastifyInstance) {
  // List contracts with offset pagination
  fastify.get('/api/v1/contracts', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    const paginationType = (request.query as any).paginationType || 'offset';
    
    try {
      const result = await paginationService.smartPaginate(
        paginationType,
        request.query,
        tenantId
      );
      
      reply.send(result);
    } catch (error) {
      reply.code(400).send({ 
        error: 'Invalid pagination parameters',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // List contracts with cursor pagination
  fastify.get('/api/v1/contracts/cursor', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    
    try {
      const result = await paginationService.paginateWithCursor(
        CursorPaginationSchema.parse(request.query),
        tenantId
      );
      
      reply.send(result);
    } catch (error) {
      reply.code(400).send({ 
        error: 'Invalid cursor pagination parameters',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // List contracts with keyset pagination
  fastify.get('/api/v1/contracts/keyset', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    
    try {
      const result = await paginationService.paginateWithKeyset(
        KeysetPaginationSchema.parse(request.query),
        tenantId
      );
      
      reply.send(result);
    } catch (error) {
      reply.code(400).send({ 
        error: 'Invalid keyset pagination parameters',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Invalidate pagination cache
  fastify.delete('/api/v1/contracts/cache', async (request, reply) => {
    const tenantId = request.headers['x-tenant-id'] as string;
    
    await paginationService.invalidateCache(tenantId);
    
    reply.send({ success: true, message: 'Pagination cache invalidated' });
  });

  // Get pagination metrics
  fastify.get('/api/v1/contracts/pagination/metrics', async (request, reply) => {
    const cacheSize = (paginationService as any).queryCache.size;
    const cacheKeys = Array.from((paginationService as any).queryCache.keys());
    
    reply.send({
      memoryCacheSize: cacheSize,
      maxCacheSize: (paginationService as any).MAX_CACHE_SIZE,
      cacheUtilization: (cacheSize / (paginationService as any).MAX_CACHE_SIZE) * 100,
      sampleKeys: cacheKeys.slice(0, 5)
    });
  });
}
