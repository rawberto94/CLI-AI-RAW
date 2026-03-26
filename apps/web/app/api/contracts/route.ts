/**
 * Contracts List API
 * GET /api/contracts - List contracts with filtering, sorting, and pagination
 *
 * OPTIMIZATIONS:
 * - Caches GET responses with Redis for reduced database load
 * - Uses selective field projection to minimize data transfer
 * - Implements efficient pagination with cursor-based approach
 * - Standardized error handling and response format
 * 
 * MULTI-TENANT: Uses getTenantIdFromRequest for proper tenant isolation
 */

import { NextRequest } from "next/server";
import { ContractStatus, type Prisma } from '@prisma/client';
import { contractService } from 'data-orchestration/services';
import { withCache, CacheKeys } from "@/lib/cache";
import { getTenantIdFromRequest } from "@/lib/tenant-server";
import { getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-middleware";
import { generateETag, checkETagMatch, CacheDuration } from '@/lib/api-cache-headers';
import { apiCache, etagHeaders } from '@/lib/cache/etag-cache';
import { logger } from '@/lib/logger';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

async function handler(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }

  // Use proper tenant resolution (session > header > query > demo in dev only)
  const tenantId = await getTenantIdFromRequest(request);
  const search = searchParams.get("search") || undefined;
  const statuses = searchParams.getAll("status");
  const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 20;
  
  // Enhanced sorting options
  const validSortFields = [
    "createdAt", "updatedAt", "uploadedAt", "totalValue", 
    "expirationDate", "effectiveDate", "contractTitle", 
    "clientName", "supplierName", "viewCount", "lastViewedAt"
  ];
  const requestedSortBy = searchParams.get("sortBy") || "createdAt";
  const sortBy = validSortFields.includes(requestedSortBy) ? requestedSortBy : "createdAt";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
  const cursor = searchParams.get('cursor') || undefined; // base64 encoded {createdAt, id}
  
  // Additional filter parameters
  const contractTypes = searchParams.getAll("contractType");
  const categories = searchParams.getAll("category");
  const clientNames = searchParams.getAll("clientName");
  const supplierNames = searchParams.getAll("supplierName");
  const minValue = searchParams.get("minValue") ? Number(searchParams.get("minValue")) : undefined;
  const maxValue = searchParams.get("maxValue") ? Number(searchParams.get("maxValue")) : undefined;
  const expiringBefore = searchParams.get("expiringBefore");
  const expiringAfter = searchParams.get("expiringAfter");
  const uploadedAfter = searchParams.get("uploadedAfter");
  const uploadedBefore = searchParams.get("uploadedBefore");

  // Validate pagination parameters
  if (page < 1) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Page must be greater than 0', 400);
  }
  if (limit < 1 || limit > 100) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Limit must be between 1 and 100', 400);
  }

  // Valid ContractStatus values from Prisma schema
  const VALID_STATUSES: ContractStatus[] = [
    ContractStatus.UPLOADED,
    ContractStatus.PROCESSING,
    ContractStatus.COMPLETED,
    ContractStatus.FAILED,
    ContractStatus.ARCHIVED,
  ];

  // Build where clause - always filter out deleted contracts
  const where: Prisma.ContractWhereInput = { 
    tenantId,
    isDeleted: false, // Exclude soft-deleted contracts
  };

  if (search) {
    where.OR = [
      { fileName: { contains: search, mode: "insensitive" } },
      { originalName: { contains: search, mode: "insensitive" } },
      { contractTitle: { contains: search, mode: "insensitive" } },
      { clientName: { contains: search, mode: "insensitive" } },
      { supplierName: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
      { contractType: { contains: search, mode: "insensitive" } },
    ];
  }

  // Filter to only valid status values
  const validStatuses = statuses.filter(
    (s): s is ContractStatus =>
      !!s && s !== 'undefined' && VALID_STATUSES.includes(s as ContractStatus)
  );
  if (validStatuses.length > 0) {
    where.status = { in: validStatuses };
  }

  // Contract type filter
  if (contractTypes.length > 0) {
    where.contractType = { in: contractTypes };
  }

  // Category filter
  if (categories.length > 0) {
    where.category = { in: categories };
  }

  // Party name filters
  if (clientNames.length > 0) {
    where.clientName = { in: clientNames };
  }
  if (supplierNames.length > 0) {
    where.supplierName = { in: supplierNames };
  }

  // Value range filter
  if (minValue !== undefined || maxValue !== undefined) {
    where.totalValue = {};
    if (minValue !== undefined) where.totalValue.gte = minValue;
    if (maxValue !== undefined) where.totalValue.lte = maxValue;
  }

  // Date filters
  if (expiringBefore || expiringAfter) {
    where.expirationDate = {};
    if (expiringBefore) where.expirationDate.lte = new Date(expiringBefore);
    if (expiringAfter) where.expirationDate.gte = new Date(expiringAfter);
  }

  if (uploadedAfter || uploadedBefore) {
    where.uploadedAt = {};
    if (uploadedAfter) where.uploadedAt.gte = new Date(uploadedAfter);
    if (uploadedBefore) where.uploadedAt.lte = new Date(uploadedBefore);
  }

  // Cursor-based pagination setup
  let skipAmount = (page - 1) * limit;
  if (cursor) {
    if (sortBy !== 'createdAt') {
      // Cursor only works cleanly with createdAt sort; fall back to offset and warn
      logger.warn('[ContractList] Cursor pagination requested with non-createdAt sort, falling back to offset', { sortBy });
    } else {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
        const { createdAt: cursorCreatedAt, id: cursorId } = decoded;
        const cursorWhere: Prisma.ContractWhereInput = {
          OR: sortOrder === 'desc'
            ? [
                { createdAt: { lt: new Date(cursorCreatedAt) } },
                { createdAt: new Date(cursorCreatedAt), id: { lt: cursorId } },
              ]
            : [
                { createdAt: { gt: new Date(cursorCreatedAt) } },
                { createdAt: new Date(cursorCreatedAt), id: { gt: cursorId } },
              ],
        };
        const existingAnd = where.AND;
        where.AND = existingAnd
          ? [...(Array.isArray(existingAnd) ? existingAnd : [existingAnd]), cursorWhere]
          : [cursorWhere];
        skipAmount = 0;
      } catch {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid cursor', 400);
      }
    }
  }

  // Build orderBy
  const orderBy: Record<string, string> = {};
  orderBy[sortBy] = sortOrder;

  // Build cache key
  const cacheKey = CacheKeys.contractsList({
    tenantId,
    page,
    limit,
    sortBy,
    sortOrder,
    search,
    statuses,
    contractTypes,
    categories,
  });

  // Try to get from cache or fetch from database
  const cachedResult = await withCache(
    cacheKey,
    async () => {
      // Dynamically import Prisma
      const { prisma } = await import("@/lib/prisma");

      // Execute query with pagination
      const [contracts, total] = await Promise.all([
        prisma.contract.findMany({
          where,
          orderBy,
          skip: skipAmount,
          take: limit,
          select: {
            id: true,
            tenantId: true,
            fileName: true,
            originalName: true,
            fileSize: true,
            mimeType: true,
            createdAt: true,
            updatedAt: true,
            uploadedAt: true,
            status: true,
            contractType: true,
            contractTitle: true,
            clientName: true,
            supplierName: true,
            category: true,
            categoryL1: true,
            categoryL2: true,
            totalValue: true,
            currency: true,
            effectiveDate: true,
            expirationDate: true,
            description: true,
            tags: true,
            viewCount: true,
            lastViewedAt: true,
            jurisdiction: true,
            paymentTerms: true,
            paymentFrequency: true,
            aiMetadata: true,
            // Contract hierarchy fields
            parentContractId: true,
            relationshipType: true,
            // Signature & Document Classification
            signatureStatus: true,
            signatureDate: true,
            signatureRequiredFlag: true,
            documentClassification: true,
            documentClassificationConf: true,
            documentClassificationWarning: true,
            parentContract: {
              select: {
                id: true,
                contractTitle: true,
                fileName: true,
                contractType: true,
              },
            },
            _count: {
              select: {
                childContracts: true,
                artifacts: true,
              },
            },
          },
        }),
        prisma.contract.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      // Fetch category details for contracts that have categories
      const categoryNames = [...new Set(contracts.filter(c => c.category || (c as any).categoryL1).map(c => c.category || (c as any).categoryL1!))];
      const categoryMap: Map<string, { id: string; name: string; color: string; icon: string; path: string }> = new Map();
      
      if (categoryNames.length > 0) {
        const taxonomyCategories = await prisma.taxonomyCategory.findMany({
          where: {
            tenantId,
            name: { in: categoryNames },
          },
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            path: true,
          },
        });
        
        for (const cat of taxonomyCategories) {
          categoryMap.set(cat.name, cat);
        }
      }

      // ── Detect & resolve stale PROCESSING contracts BEFORE building response ──
      // A contract is stale if:
      //  1. No artifacts generated AND idle for >90 seconds (worker never started), OR
      //  2. Processing for >10 minutes regardless (hard ceiling — worker crashed or stuck)
      // BUT: never auto-resolve if the processingJob is actively RUNNING.
      const STALE_NO_ARTIFACTS_MS = 90 * 1000;      // 90 seconds with 0 artifacts
      const STALE_HARD_CEILING_MS = 10 * 60 * 1000; // 10 minutes absolute max

      // Fetch running processing jobs to guard against resolving active work
      const runningJobContractIds = new Set<string>();
      try {
        const runningJobs = await prisma.processingJob.findMany({
          where: {
            tenantId,
            status: 'RUNNING',
            startedAt: { gte: new Date(Date.now() - 3 * 60 * 1000) }, // started within 3 min
          },
          select: { contractId: true },
        });
        for (const j of runningJobs) runningJobContractIds.add(j.contractId);
      } catch { /* non-fatal */ }

      const staleContractIds: string[] = [];
      for (const contract of contracts) {
        if (contract.status !== 'PROCESSING') continue;
        // Skip contracts whose processing job is actively running
        if (runningJobContractIds.has(contract.id)) continue;
        const meta = contract.aiMetadata as any;
        const expected = meta?.expectedArtifactCount || 15;
        const actual = (contract as any)._count?.artifacts || 0;
        const artifactProgress = Math.min(Math.round((actual / expected) * 100), 99);
        const lastTouch = contract.updatedAt || contract.createdAt;
        const staleSinceMs = Date.now() - new Date(lastTouch).getTime();
        const isStaleNoArtifacts = artifactProgress === 0 && staleSinceMs > STALE_NO_ARTIFACTS_MS;
        const isStaleHardCeiling = staleSinceMs > STALE_HARD_CEILING_MS;
        if (isStaleNoArtifacts || isStaleHardCeiling) {
          staleContractIds.push(contract.id);
        }
      }

      // Separate stale contracts into those with artifacts (COMPLETED) and without (FAILED)
      const staleWithArtifacts: string[] = [];
      const staleWithoutArtifacts: string[] = [];
      for (const contract of contracts) {
        if (!staleContractIds.includes(contract.id)) continue;
        const count = (contract as any)._count?.artifacts || 0;
        if (count > 0) staleWithArtifacts.push(contract.id);
        else staleWithoutArtifacts.push(contract.id);
      }

      if (staleWithArtifacts.length > 0) {
        try {
          await prisma.contract.updateMany({
            where: { id: { in: staleWithArtifacts }, tenantId, status: 'PROCESSING' },
            data: { status: 'COMPLETED', updatedAt: new Date() },
          });
        } catch (e) {
          logger.warn('Failed to auto-resolve stale contracts', { tenantId, staleContractIds: staleWithArtifacts, error: e });
        }
      }
      if (staleWithoutArtifacts.length > 0) {
        try {
          await prisma.contract.updateMany({
            where: { id: { in: staleWithoutArtifacts }, tenantId, status: 'PROCESSING' },
            data: { status: 'FAILED', updatedAt: new Date() },
          });
        } catch (e) {
          logger.warn('Failed to auto-resolve stale contracts as FAILED', { tenantId, staleContractIds: staleWithoutArtifacts, error: e });
        }
      }
      if (staleContractIds.length > 0) {
        logger.info(`Auto-resolved ${staleContractIds.length} stale processing contract(s)`, {
          tenantId, completed: staleWithArtifacts.length, failed: staleWithoutArtifacts.length,
        });
      }

      const staleIdSet = new Set(staleContractIds);
      const failedIdSet = new Set(staleWithoutArtifacts);

      const result = {
        success: true,
        data: {
          contracts: contracts.map((contract) => {
            const categoryInfo = (contract.category ? categoryMap.get(contract.category) : null) || ((contract as any).categoryL1 ? categoryMap.get((contract as any).categoryL1) : null);
            // If this contract was just auto-resolved, reflect the correct status immediately
            let effectiveStatus = contract.status.toLowerCase();
            if (staleIdSet.has(contract.id)) {
              effectiveStatus = failedIdSet.has(contract.id) ? 'failed' : 'completed';
            }
            return {
              id: contract.id,
              title: contract.contractTitle || contract.originalName || contract.fileName,
              filename: contract.fileName,
              originalName: contract.originalName || contract.fileName,
              status: effectiveStatus,
              fileSize: contract.fileSize.toString(),
              mimeType: contract.mimeType,
              uploadedAt: contract.uploadedAt?.toISOString() || contract.createdAt.toISOString(),
              createdAt: contract.createdAt.toISOString(),
              // Type field for frontend compatibility
              type: contract.contractType || "Unknown",
              contractType: contract.contractType || "Unknown",
              // Parties object for frontend compatibility
              parties: {
                client: contract.clientName || null,
                supplier: contract.supplierName || null,
              },
              clientName: contract.clientName,
              supplierName: contract.supplierName,
              // Map to vendor/counterparty for UI compatibility
              vendor: contract.supplierName || contract.clientName,
              counterparty: contract.clientName || contract.supplierName,
              category: categoryInfo ? {
                id: categoryInfo.id,
                name: categoryInfo.name,
                color: categoryInfo.color,
                icon: categoryInfo.icon,
                path: categoryInfo.path,
              } : null,
              // Value field for frontend compatibility
              value: contract.totalValue ? Number(contract.totalValue) : null,
              totalValue: contract.totalValue ? Number(contract.totalValue) : null,
              currency: contract.currency,
              effectiveDate: contract.effectiveDate?.toISOString(),
              expirationDate: contract.expirationDate?.toISOString(),
              description: contract.description,
              tags: contract.tags,
              viewCount: contract.viewCount,
              updatedAt: contract.updatedAt?.toISOString() || null,
              fileName: contract.fileName,
              lastViewedAt: contract.lastViewedAt?.toISOString(),
              // Enterprise metadata fields
              jurisdiction: contract.jurisdiction || (contract.aiMetadata as any)?.jurisdiction || null,
              paymentTerms: contract.paymentTerms || (contract.aiMetadata as any)?.payment_type || null,
              paymentFrequency: contract.paymentFrequency || (contract.aiMetadata as any)?.billing_frequency_type || null,
              autoRenewing: (contract.aiMetadata as any)?.auto_renewing ?? null,
              noticePeriod: (contract.aiMetadata as any)?.notice_period || null,
              // External parties from enterprise metadata
              externalParties: (contract.aiMetadata as any)?.external_parties || [],
              // Extraction confidence
              extractionConfidence: (contract.aiMetadata as any)?._confidence?.overall ?? null,
              // Contract hierarchy info
              parentContractId: (contract as any).parentContractId || null,
              relationshipType: (contract as any).relationshipType || null,
              parentContract: (contract as any).parentContract ? {
                id: (contract as any).parentContract.id,
                title: (contract as any).parentContract.originalName || (contract as any).parentContract.fileName,
                type: (contract as any).parentContract.contractType,
              } : null,
              childContractCount: (contract as any)._count?.childContracts || 0,
              hasHierarchy: !!(contract as any).parentContractId || ((contract as any)._count?.childContracts || 0) > 0,
              // Processing progress — only for PROCESSING contracts NOT already auto-resolved
              processing: (contract.status === 'PROCESSING' && !staleIdSet.has(contract.id)) ? (() => {
                const meta = contract.aiMetadata as any;
                const expected = meta?.expectedArtifactCount || 15;
                const actual = (contract as any)._count?.artifacts || 0;
                const artifactProgress = Math.min(Math.round((actual / expected) * 100), 99);
                const lastTouch = contract.updatedAt || contract.createdAt;
                const staleSinceMs = Date.now() - new Date(lastTouch).getTime();
                // Show time-based progress when no artifacts yet, so UX feels alive
                // Ramps from 5% to 80% over the first 90 seconds, slow-log curve
                const timeFraction = Math.min(staleSinceMs / (90 * 1000), 1);
                const timeProgress = Math.round(5 + 75 * (1 - Math.pow(1 - timeFraction, 2)));
                const progress = Math.max(artifactProgress, timeProgress);
                const stages = [
                  'Analyzing document structure…',
                  'Extracting key information…',
                  'Identifying contract clauses…',
                  'Building contract profile…',
                ];
                const stageIdx = Math.min(Math.floor(timeFraction * stages.length), stages.length - 1);
                return {
                  progress,
                  currentStage: meta?.currentStage || (actual > 0 ? `Generating artifacts (${actual}/${expected})` : stages[stageIdx]),
                  stale: false,
                  autoResolved: false,
                };
              })() : undefined,
              // Signature & Document Classification
              signatureStatus: (contract as any).signatureStatus || (contract.aiMetadata as any)?.signature_status || 'unknown',
              signatureDate: (contract as any).signatureDate?.toISOString() || (contract.aiMetadata as any)?.signature_date || null,
              signatureRequiredFlag: (contract as any).signatureRequiredFlag ?? false,
              documentClassification: (contract as any).documentClassification || (contract.aiMetadata as any)?.document_classification || 'contract',
              documentClassificationConfidence: (contract as any).documentClassificationConf || null,
              documentClassificationWarning: (contract as any).documentClassificationWarning || (contract.aiMetadata as any)?.document_classification_warning || null,
            };
          }),
          pagination: {
            total,
            limit,
            page,
            totalPages,
            hasMore: page < totalPages,
            hasPrevious: page > 1,
            nextCursor: contracts.length === limit
              ? Buffer.from(JSON.stringify({
                  createdAt: contracts[contracts.length - 1].createdAt.toISOString(),
                  id: contracts[contracts.length - 1].id,
                })).toString('base64')
              : null,
          },
          filters: {
            applied: {
              search: search || null,
              statuses: validStatuses,
              contractTypes,
              categories,
              clientNames,
              supplierNames,
              valueRange: minValue || maxValue ? { min: minValue, max: maxValue } : null,
            },
            sortBy,
            sortOrder,
          },
          meta: {
            cached: false,
            source: "database",
          },
        },
      };

      return result;
    },
    // Skip cache when PROCESSING contracts might exist (no status filter, or
    // status filter includes PROCESSING) so auto-resolve and progress updates
    // appear immediately on each poll.
    { ttl: (validStatuses.length === 0 || validStatuses.includes(ContractStatus.PROCESSING)) ? 0 : 120 }
  );

  const responseTime = Date.now() - startTime;

  // Build a deterministic cache key for server-side ETag memoization
  const listCacheKey = `contracts:${tenantId}:p${page}:l${limit}:s${sortBy}:${sortOrder}:${search || ''}`;

  const responseData = {
    ...cachedResult.data,
    meta: {
      ...cachedResult.data.meta,
      responseTime: `${responseTime}ms`,
      cached: responseTime < 100,
    },
  };

  // ETag-based conditional response — return 304 if unchanged
  const etag = apiCache.set(listCacheKey, responseData, CacheDuration.SHORT * 1000);
  if (apiCache.matches(listCacheKey, request.headers.get('If-None-Match'))) {
    return new Response(null, {
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': `private, max-age=${CacheDuration.SHORT}, stale-while-revalidate=${CacheDuration.MEDIUM}`,
      },
    });
  }

  // Return cached or fresh result
  return createSuccessResponse(ctx, 
    responseData,
    {
      status: 200,
      headers: {
        "X-Response-Time": `${responseTime}ms`,
        "X-Data-Source": responseTime < 100 ? "cache" : "database",
        ...etagHeaders(etag, { maxAge: CacheDuration.SHORT }),
      },
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    return await handler(request);
  } catch (error) {
    // Return proper error instead of silently serving mock data
    logger.error('Contracts GET error:', error);
    const ctx = getAuthenticatedApiContext(request);
    if (!ctx) {
      return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
    }
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch contracts. Please try again.', 500);
  }
}
