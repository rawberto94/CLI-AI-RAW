/**
 * RAG Evaluation API
 * POST /api/ai/rag-eval — Run RAG quality evaluation
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json().catch(() => ({}));
  const { testQueries, sampleSize } = body;

  try {
    const { runBatchEvaluation } = await import('@/lib/rag/rag-evaluation.service');

    const summary = await runBatchEvaluation({
      tenantId: ctx.tenantId,
      sampleSize: sampleSize || 10,
      testQueries,
    });

    return createSuccessResponse({ evaluation: summary });
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : 'RAG evaluation failed',
      500
    );
  }
});
