/**
 * Word Add-in Clause Alternatives API
 */

import { NextRequest } from 'next/server';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiCtx = getApiContext(req);
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) {
      return createErrorResponse(apiCtx, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const { id } = await params;

    const clause = await prisma.clause.findFirst({
      where: {
        id,
      },
    });

    if (!clause) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Clause not found', 404);
    }

    // Parse alternatives if stored as JSON
    const clauseData = clause as Record<string, unknown>;
    const alternatives = Array.isArray(clauseData.alternatives)
      ? clauseData.alternatives
      : [];

    return createSuccessResponse(ctx, alternatives);
  } catch (error) {
    console.error('Word Add-in clause alternatives error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to fetch alternatives', 500);
  }
}
