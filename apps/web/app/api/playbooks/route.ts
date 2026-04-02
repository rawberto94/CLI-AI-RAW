/**
 * Playbook Management API
 * 
 * CRUD operations for legal playbooks
 */

import { NextRequest } from 'next/server';
import { getLegalReviewService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

function normalizeRiskThresholds(riskThresholds: Record<string, unknown> = {}) {
  const criticalCount = Number(
    riskThresholds.criticalCount ?? riskThresholds.criticalCountThreshold ?? 2,
  );
  const highRiskScore = Number(
    riskThresholds.highRiskScore ?? riskThresholds.highRiskScoreThreshold ?? 70,
  );
  const overallAcceptable = Number(
    riskThresholds.overallAcceptable ?? riskThresholds.acceptableScoreThreshold ?? 40,
  );

  return {
    criticalCount: Number.isFinite(criticalCount) ? criticalCount : 2,
    highRiskScore: Number.isFinite(highRiskScore) ? highRiskScore : 70,
    overallAcceptable: Number.isFinite(overallAcceptable) ? overallAcceptable : 40,
  };
}

// ============================================================================
// GET - List all playbooks for tenant
// ============================================================================

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const legalReviewService = getLegalReviewService();
  const playbooks = await legalReviewService.listPlaybooks(tenantId);

  return createSuccessResponse(ctx, {
    success: true,
    playbooks,
    total: playbooks.length,
  });
});

// ============================================================================
// POST - Create new playbook
// ============================================================================

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const {
    name,
    description,
    contractTypes = [],
    clauses = [],
    fallbackPositions = {},
    riskThresholds = {},
    redFlags = [],
    isDefault = false,
  } = body;

  if (!name) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Playbook name is required', 400);
  }

  const tenantId = ctx.tenantId;

  const legalReviewService = getLegalReviewService();
  const playbook = await legalReviewService.createPlaybook({
    name,
    description,
    tenantId,
    contractTypes,
    clauses,
    fallbackPositions,
    riskThresholds: normalizeRiskThresholds(riskThresholds),
    redFlags,
    isDefault,
    createdBy: ctx.userId,
  });

  return createSuccessResponse(ctx, {
    success: true,
    playbook,
  });
});
