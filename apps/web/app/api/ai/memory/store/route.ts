/**
 * Memory Store API
 * 
 * Stores new memories in the EpisodicMemoryService
 * for long-term personalization
 */

import { NextRequest } from 'next/server';
import { getEpisodicMemoryService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { 
      tenantId, 
      userId, 
      type = 'conversation',
      content,
      context = {},
      importance = 0.5,
      metadata = {},
      expiresInDays } = body;

    if (!tenantId || !content) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'TenantId and content are required', 400);
    }

    const memoryService = getEpisodicMemoryService();
    
    // Store based on memory type
    let memoryId: string;
    
    switch (type) {
      case 'conversation':
        const conversationMemory = await memoryService.rememberConversation({
          tenantId,
          userId: userId || ctx.userId,
          userMessage: content.userMessage || content,
          assistantResponse: content.assistantResponse || '',
          intent: context.intent,
          entities: context.entities,
          contractId: context.contractId });
        memoryId = conversationMemory.id;
        break;
        
      case 'correction':
        const correctionMemory = await memoryService.rememberCorrection({
          tenantId,
          userId: userId || ctx.userId,
          contractId: context.contractId || '',
          artifactType: context.artifactType || 'general',
          originalValue: content.original || content,
          correctedValue: content.corrected || '',
          fieldPath: context.fieldPath || 'unknown' });
        memoryId = correctionMemory.id;
        break;
        
      case 'preference':
        const preferenceMemory = await memoryService.rememberPreference({
          tenantId,
          userId: userId || ctx.userId,
          preferenceType: context.category || 'general',
          value: content,
          context: context.description });
        memoryId = preferenceMemory.id;
        break;
        
      default:
        // Generic memory storage
        const memory = await memoryService.remember({
          tenantId,
          userId: userId || ctx.userId,
          type,
          content,
          context,
          importance,
          expiresAt: expiresInDays 
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            : undefined,
          metadata });
        memoryId = memory.id;
    }

    return createSuccessResponse(ctx, {
      memoryId,
      message: 'Memory stored successfully' });
  });
