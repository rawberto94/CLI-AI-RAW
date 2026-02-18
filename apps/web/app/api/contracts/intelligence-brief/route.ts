/**
 * Contract Intelligence Brief API
 * 
 * GET  /api/contracts/intelligence-brief?contractId=xxx — Fetch existing brief
 * POST /api/contracts/intelligence-brief — Generate/regenerate brief
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const contractId = request.nextUrl.searchParams.get('contractId');
  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required', 400);
  }

  const tenantId = ctx.tenantId;

  try {
    const artifact = await prisma.artifact.findUnique({
      where: {
        contractId_tenantId_type: {
          contractId,
          tenantId,
          type: 'INTELLIGENCE_BRIEF',
        },
      } as any,
    }) as any;

    if (!artifact) {
      return createSuccessResponse(ctx, { brief: null, status: 'not_generated' });
    }

    return createSuccessResponse(ctx, {
      brief: artifact?.content?.brief || null,
      comparisons: artifact?.content?.comparisons || [],
      generatedAt: artifact?.content?.generatedAt || null,
      model: artifact?.content?.model || null,
      processingTime: artifact?.content?.processingTime || null,
      status: 'ready',
    });
  } catch (error) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch intelligence brief', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { contractId } = body;
  
  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required', 400);
  }

  const tenantId = ctx.tenantId;

  try {
    // Lazy import to avoid edge runtime issues
    const { runIntelligencePipeline } = await import('@/lib/ai/intelligence-brief.service');
    
    const result = await runIntelligencePipeline({ contractId, tenantId });

    if (!result.success) {
      return createErrorResponse(ctx, 'PROCESSING_ERROR', result.error || 'Intelligence brief generation failed', 500);
    }

    return createSuccessResponse(ctx, {
      brief: result.brief,
      status: 'generated',
    });
  } catch (error) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to generate intelligence brief', 500);
  }
});
