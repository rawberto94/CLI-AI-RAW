/**
 * Legal Review API
 * 
 * Comprehensive legal review and redlining endpoints
 */

import { NextRequest } from 'next/server';
import { getLegalReviewService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

// ============================================================================
// GET - List legal reviews for a contract
// ============================================================================

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId') || undefined;
  const requestedLimit = Number(searchParams.get('limit') || '10');
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 10;

  const reviews = await prisma.legalReview.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(contractId ? { contractId } : {}),
    },
    include: {
      playbook: {
        select: {
          id: true,
          name: true,
          isDefault: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return createSuccessResponse(ctx, {
    success: true,
    reviews: reviews.map((review) => ({
      id: review.id,
      contractId: review.contractId,
      playbookId: review.playbookId,
      overallRiskScore: review.overallRiskScore,
      overallRiskLevel: review.overallRiskLevel,
      recommendation: review.recommendation,
      recommendationReason: review.recommendationReason,
      clauseAssessments: review.clauseAssessments,
      redlines: review.redlines,
      redFlagsFound: review.redFlagsFound,
      summary: review.summary,
      status: review.status,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      playbook: review.playbook ? {
        id: review.playbook.id,
        name: review.playbook.name,
        isDefault: review.playbook.isDefault,
      } : null,
    })),
    total: reviews.length,
  });
});

// ============================================================================
// POST - Perform legal review against playbook
// ============================================================================

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { 
    contractId,
    contractText,
    playbookId = 'default_playbook',
    contractType,
    counterpartyName: _counterpartyName,
    includePatternAnalysis: _includePatternAnalysis = false,
    includePrecedents: _includePrecedents = false,
  } = body;

  if (!contractText) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract text is required', 400);
  }

  const tenantId = ctx.tenantId;

  const legalReviewService = getLegalReviewService();
  const result = await legalReviewService.reviewContract(contractText, {
    tenantId,
    contractId,
    playbookId,
    contractType,
    userId: ctx.userId,
  });

  return createSuccessResponse(ctx, {
    success: true,
    review: result,
    ...result,
  });
});
