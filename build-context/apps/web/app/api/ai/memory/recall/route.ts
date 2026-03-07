/**
 * Memory Recall API
 * 
 * Retrieves relevant memories from the EpisodicMemoryService
 * for personalizing AI responses
 */

import { NextRequest } from 'next/server';
import { getEpisodicMemoryService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { 
      query, 
      tenantId, 
      userId, 
      contractId, 
      types,
      limit = 5, 
      recencyBias = 0.3,
      minImportance = 0.3 } = body;

    if (!query || !tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Query and tenantId are required', 400);
    }

    const memoryService = getEpisodicMemoryService();
    
    const memories = await memoryService.recall({
      query,
      tenantId,
      userId,
      contractId,
      types,
      limit,
      recencyBias,
      minImportance });

    return createSuccessResponse(ctx, {
      memories,
      count: memories.length });
  });
