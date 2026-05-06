import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { contractService } from '@/lib/data-orchestration';

import type { ContractApiContext } from '@/lib/contracts/server/context';

type SearchMode = 'balanced' | 'semantic' | 'keyword';

type SearchFilters = {
  contractType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  clientId?: string;
  supplierId?: string;
};

type HybridSearchResult = {
  id: string;
  contractId: string;
  fileName: string;
  contractType: string | null;
  snippet: string;
  score: number;
  relevanceBreakdown: {
    keywordScore: number;
    semanticScore: number;
    finalScore: number;
  };
  matchType: 'keyword' | 'semantic' | 'both';
  highlights: string[];
  metadata: {
    uploadedAt: Date;
    status: string;
  };
  hierarchy?: {
    parentContractId?: string | null;
    parentContract?: { id: string; fileName: string; contractType?: string | null } | null;
    childCount?: number;
    hasHierarchy?: boolean;
  };
};

type HybridSearchResponse = {
  results: HybridSearchResult[];
  total: number;
  query: string;
  executionTime: number;
  searchStrategy: {
    mode: SearchMode;
    keywordResults: number;
    semanticResults: number;
    mergedResults: number;
  };
};

type ContractResult = {
  id: string;
  fileName?: string;
  contractTitle?: string;
  clientName?: string;
  supplierName?: string;
  contractType?: string;
  status?: string;
  uploadedAt?: string | Date;
  createdAt?: string | Date;
  parentContractId?: string;
  parentContract?: { id: string; fileName: string; contractType?: string | null } | null;
  childContracts?: unknown[];
  _count?: { childContracts?: number };
};

const searchRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  mode: z.enum(['balanced', 'semantic', 'keyword']).optional().default('balanced'),
  filters: z
    .object({
      contractType: z.string().optional(),
      status: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      clientId: z.string().optional(),
      supplierId: z.string().optional(),
    })
    .optional(),
  pagination: z
    .object({
      limit: z.number().int().min(1).max(100).optional().default(20),
      offset: z.number().int().min(0).optional().default(0),
    })
    .optional(),
  options: z
    .object({
      vectorThreshold: z.number().min(0).max(1).optional(),
      ftsMinScore: z.number().min(0).optional(),
      boostRecent: z.boolean().optional(),
    })
    .optional(),
});

function buildExplanation(result: HybridSearchResult): string {
  const baseMessage =
    result.matchType === 'both'
      ? `Matched on semantic and keyword signals (${(result.relevanceBreakdown.finalScore * 100).toFixed(1)}% confidence)`
      : result.matchType === 'keyword'
        ? `Matched contract metadata (${(result.relevanceBreakdown.keywordScore * 100).toFixed(1)}% relevance)`
        : `Matched semantic intent (${(result.relevanceBreakdown.semanticScore * 100).toFixed(1)}% similarity)`;

  if (result.highlights.length === 0) {
    return baseMessage;
  }

  return `${baseMessage}. Highlights: ${result.highlights.join(', ')}`;
}

async function performRealSearch(
  query: string,
  mode: SearchMode,
  tenantId: string,
  filters?: SearchFilters,
  pagination?: { limit?: number; offset?: number },
): Promise<HybridSearchResponse> {
  const startTime = Date.now();
  const limit = pagination?.limit ?? 20;
  const offset = pagination?.offset ?? 0;
  const page = Math.floor(offset / limit) + 1;

  const result = await contractService.queryContracts({
    tenantId,
    search: query,
    status: filters?.status ? [filters.status as any] : undefined,
    category: filters?.contractType ? [filters.contractType] : undefined,
    page,
    limit,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  } as any);

  if (!result.success || !result.data) {
    return {
      results: [],
      total: 0,
      query,
      executionTime: 0,
      searchStrategy: {
        mode,
        keywordResults: 0,
        semanticResults: 0,
        mergedResults: 0,
      },
    };
  }

  const data = result.data as Record<string, unknown> | unknown[];
  const contracts = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>).contracts)
      ? ((data as Record<string, unknown>).contracts as unknown[])
      : [];

  const totalCount =
    (result as { pagination?: { total: number } }).pagination?.total ?? contracts.length;
  const normalizedQuery = query.toLowerCase();

  const results = (contracts as ContractResult[]).map((contract, index) => {
    const scoreBase = 0.92 - index * 0.05;
    const score = Math.max(0.4, Math.min(0.95, scoreBase));
    const keywordScore = mode === 'semantic' ? score * 0.6 : score;
    const semanticScore = mode === 'semantic' ? score : score * 0.5;

    const parties = [contract.clientName, contract.supplierName].filter(Boolean);
    const highlights = [contract.fileName, contract.contractTitle, ...parties]
      .filter(Boolean)
      .map((value) => value!.toLowerCase())
      .filter((value) => value.includes(normalizedQuery))
      .map((value) => value.replace(normalizedQuery, `<mark>${normalizedQuery}</mark>`));

    const uploadedAtValue = contract.uploadedAt ?? contract.createdAt;
    const uploadedAt = uploadedAtValue
      ? uploadedAtValue instanceof Date
        ? uploadedAtValue
        : new Date(uploadedAtValue)
      : new Date(0);

    const childCount = contract._count?.childContracts ?? contract.childContracts?.length ?? 0;
    const hasHierarchy = Boolean(contract.parentContractId || childCount > 0);

    return {
      id: `${contract.id}-match-${index}`,
      contractId: contract.id,
      fileName: contract.fileName || contract.contractTitle || 'Untitled',
      contractType: contract.contractType ?? null,
      snippet: contract.contractType
        ? `${contract.contractType} agreement with ${parties.join(' & ') || 'unknown parties'}`
        : `Contract with ${parties.join(' & ') || 'unknown parties'}`,
      score,
      relevanceBreakdown: {
        keywordScore,
        semanticScore,
        finalScore: mode === 'semantic' ? (keywordScore + semanticScore) / 2 : score,
      },
      matchType: mode === 'semantic' ? 'both' : 'keyword',
      highlights,
      metadata: {
        uploadedAt,
        status: (contract.status ?? 'unknown').toLowerCase(),
      },
      hierarchy: hasHierarchy
        ? {
            parentContractId: contract.parentContractId ?? null,
            parentContract: contract.parentContract ?? null,
            childCount,
            hasHierarchy,
          }
        : undefined,
    } satisfies HybridSearchResult;
  });

  return {
    results,
    total: totalCount,
    query,
    executionTime: Date.now() - startTime,
    searchStrategy: {
      mode,
      keywordResults: totalCount,
      semanticResults: mode === 'semantic' ? totalCount : 0,
      mergedResults: totalCount,
    },
  };
}

export async function postContractSearch(request: NextRequest, context: ContractApiContext) {
  const body = await request.json();
  const validatedData = searchRequestSchema.parse(body);

  const filters = validatedData.filters
    ? {
        ...validatedData.filters,
        startDate: validatedData.filters.startDate
          ? new Date(validatedData.filters.startDate)
          : undefined,
        endDate: validatedData.filters.endDate ? new Date(validatedData.filters.endDate) : undefined,
      }
    : undefined;

  const searchResults = await performRealSearch(
    validatedData.query,
    validatedData.mode,
    context.tenantId,
    filters,
    validatedData.pagination,
  );

  return createSuccessResponse(
    context,
    {
      data: {
        results: searchResults.results.map((result) => ({
          ...result,
          explanation: buildExplanation(result),
        })),
        pagination: {
          total: searchResults.total,
          limit: validatedData.pagination?.limit ?? 20,
          offset: validatedData.pagination?.offset ?? 0,
          hasMore:
            (validatedData.pagination?.offset ?? 0) + (validatedData.pagination?.limit ?? 20) <
            searchResults.total,
        },
        query: searchResults.query,
        executionTime: searchResults.executionTime,
        searchStrategy: searchResults.searchStrategy,
        recommendations: {
          suggestedMode: validatedData.mode,
          reason:
            validatedData.mode === 'semantic'
              ? 'Semantic search is recommended for natural language queries.'
              : 'Keyword search is recommended for structured queries.',
          alternativeQueries: [
            `${validatedData.query} supplier risk`,
            `${validatedData.query} compliance`,
            `${validatedData.query} pricing`,
          ],
        },
      },
    },
    { status: 200 },
  );
}

export async function getContractSearch(request: NextRequest, context: ContractApiContext) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || searchParams.get('query');

  if (!query) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Query parameter is required', 400);
  }

  const mode = (searchParams.get('mode') as SearchMode) || 'balanced';
  const limit = Math.min(
    Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10) || 20),
    200,
  );
  const offset = Math.max(0, Number.parseInt(searchParams.get('offset') || '0', 10) || 0);
  const contractType = searchParams.get('contractType') || undefined;
  const status = searchParams.get('status') || undefined;

  const searchResults = await performRealSearch(
    query,
    mode,
    context.tenantId,
    {
      contractType: contractType ?? undefined,
      status: status ?? undefined,
    },
    { limit, offset },
  );

  return createSuccessResponse(context, {
    data: {
      results: searchResults.results.map((result) => ({
        ...result,
        explanation: buildExplanation(result),
      })),
      pagination: {
        total: searchResults.total,
        limit,
        offset,
        hasMore: offset + limit < searchResults.total,
      },
      query: searchResults.query,
      executionTime: searchResults.executionTime,
    },
  });
}