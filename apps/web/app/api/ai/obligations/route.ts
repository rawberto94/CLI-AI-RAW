import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { z } from 'zod';

const obligationsGetSchema = z.object({
  action: z.enum(['list', 'detail', 'alerts', 'summary', 'compliance', 'upcoming', 'overdue']).default('list'),
  contractId: z.string().optional(),
  obligationId: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueWithin: z.coerce.number().int().min(1).max(365).optional(),
});

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * GET /api/ai/obligations
 * Get obligations, alerts, or compliance status
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const parsed = obligationsGetSchema.safeParse({
      action: searchParams.get('action') || undefined,
      contractId: searchParams.get('contractId') || undefined,
      obligationId: searchParams.get('obligationId') || undefined,
      status: searchParams.get('status') || undefined,
      priority: searchParams.get('priority') || undefined,
      dueWithin: searchParams.get('dueWithin') || undefined,
    });
    if (!parsed.success) {
      return createErrorResponse(ctx, 'BAD_REQUEST', `Invalid parameters: ${parsed.error.issues.map(i => i.message).join(', ')}`, 400);
    }
    const { action, contractId, obligationId, status, priority, dueWithin } = parsed.data;

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const obligationService = (services as any).aiObligationTrackerService;

    if (!obligationService) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'AI Obligation Tracker service not available', 503);
    }

    let result;

    switch (action) {
      case 'list':
        result = await obligationService.getObligations({
          tenantId,
          contractId,
          status,
          priority,
          dueWithin });
        break;

      case 'detail':
        if (!obligationId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'obligationId is required', 400);
        }
        result = await obligationService.getObligation(obligationId);
        break;

      case 'alerts':
        if (!tenantId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId is required for alerts', 400);
        }
        result = await obligationService.getAlerts(tenantId);
        break;

      case 'summary':
        if (!tenantId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId is required for summary', 400);
        }
        result = await obligationService.getObligationSummary(tenantId, contractId);
        break;

      case 'compliance':
        if (!tenantId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId is required for compliance snapshot', 400);
        }
        result = await obligationService.getComplianceSnapshot(tenantId);
        break;

      case 'upcoming':
        if (!tenantId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId is required', 400);
        }
        result = await obligationService.getUpcomingDeadlines(tenantId, dueWithin ?? 30);
        break;

      case 'overdue':
        if (!tenantId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'tenantId is required', 400);
        }
        result = await obligationService.getOverdueObligations(tenantId);
        break;

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
    }

    return createSuccessResponse(ctx, {
      action,
      data: result });
  });

/**
 * POST /api/ai/obligations
 * Extract or create obligations
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();
    const { action = 'extract', ...data } = body;

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const obligationService = (services as any).aiObligationTrackerService;

    if (!obligationService) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'AI Obligation Tracker service not available', 503);
    }

    let result;

    switch (action) {
      case 'extract':
        const { contractId, contractText, existingArtifacts } = data;

        if (!contractId || !contractText) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId and contractText are required', 400);
        }

        result = await obligationService.extractObligations(
          tenantId,
          contractId,
          contractText,
          existingArtifacts
        );
        break;

      case 'create':
        const { obligation } = data;

        if (!obligation || !obligation.type || !obligation.description) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Complete obligation object with type and description is required', 400);
        }

        result = await obligationService.createObligation(obligation);
        break;

      case 'acknowledge-alert':
        const { alertId, userId } = data;

        if (!alertId || !userId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'alertId and userId are required', 400);
        }

        result = await obligationService.acknowledgeAlert(alertId, userId);
        break;

      case 'bulk-extract':
        const { contracts } = data;

        if (!contracts || !Array.isArray(contracts) || contracts.length === 0) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'contracts array is required with at least one contract', 400);
        }

        const results = [];
        for (const contract of contracts) {
          try {
            const extracted = await obligationService.extractObligations(
              contract.tenantId,
              contract.contractId,
              contract.contractText,
              contract.existingArtifacts
            );
            results.push({ contractId: contract.contractId, success: true, obligations: extracted });
          } catch (err) {
            results.push({ contractId: contract.contractId, success: false, error: String(err) });
          }
        }
        result = results;
        break;

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown action: ${action}`, 400);
    }

    return createSuccessResponse(ctx, {
      action,
      data: result });
  });

/**
 * PATCH /api/ai/obligations
 * Update obligation status or details
 */
export const PATCH = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { obligationId, updates } = body;

    if (!obligationId || !updates) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'obligationId and updates are required', 400);
    }

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const obligationService = (services as any).aiObligationTrackerService;

    if (!obligationService) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'AI Obligation Tracker service not available', 503);
    }

    const result = await obligationService.updateObligation(obligationId, updates);

    return createSuccessResponse(ctx, {
      data: result });
  });

/**
 * DELETE /api/ai/obligations
 * Remove an obligation
 */
export const DELETE = withAuthApiHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const obligationId = searchParams.get('obligationId');

    if (!obligationId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'obligationId is required', 400);
    }

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const obligationService = (services as any).aiObligationTrackerService;

    if (!obligationService) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'AI Obligation Tracker service not available', 503);
    }

    await obligationService.deleteObligation(obligationId);

    return createSuccessResponse(ctx, {
      message: `Obligation ${obligationId} deleted` });
  });
