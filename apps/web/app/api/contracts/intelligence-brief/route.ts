/**
 * Contract Intelligence Brief API
 * 
 * GET  /api/contracts/intelligence-brief?contractId=xxx — Fetch existing brief
 * POST /api/contracts/intelligence-brief — Generate/regenerate brief
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const contractId = request.nextUrl.searchParams.get('contractId');
  if (!contractId) {
    return createErrorResponse('contractId is required', 400);
  }

  const tenantId = ctx.tenantId;

  try {
    const artifact = await ctx.prisma.artifact.findUnique({
      where: {
        contractId_tenantId_type: {
          contractId,
          tenantId,
          type: 'INTELLIGENCE_BRIEF',
        },
      },
    });

    if (!artifact) {
      return createSuccessResponse({ brief: null, status: 'not_generated' });
    }

    return createSuccessResponse({
      brief: (artifact.content as any)?.brief || null,
      comparisons: (artifact.content as any)?.comparisons || [],
      generatedAt: (artifact.content as any)?.generatedAt || null,
      model: (artifact.content as any)?.model || null,
      processingTime: (artifact.content as any)?.processingTime || null,
      status: 'ready',
    });
  } catch (error) {
    return createErrorResponse('Failed to fetch intelligence brief', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { contractId } = body;
  
  if (!contractId) {
    return createErrorResponse('contractId is required', 400);
  }

  const tenantId = ctx.tenantId;

  try {
    // Lazy import to avoid edge runtime issues
    const { runIntelligencePipeline } = await import('@/lib/ai/intelligence-brief.service');
    
    const result = await runIntelligencePipeline({ contractId, tenantId });

    if (!result.success) {
      return createErrorResponse(result.error || 'Intelligence brief generation failed', 500);
    }

    return createSuccessResponse({
      brief: result.brief,
      status: 'generated',
    });
  } catch (error) {
    return createErrorResponse('Failed to generate intelligence brief', 500);
  }
});
